import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { parseCuratedCatalogManifest } from "../../src/catalog/catalog-manifest.ts";
import { SequelizeCatalogImportRepository } from "./sequelize-catalog-repository.mjs";

const manifest = parseCuratedCatalogManifest(JSON.parse(readFileSync(
  "data/catalog/curated-fnb-2025-candidates.v1.json",
  "utf8",
)));

const categories = [
  { id: "10000000-0000-4000-8000-000000000001", code: "BEVERAGES", isActive: true },
  { id: "10000000-0000-4000-8000-000000000003", code: "SNACKS", isActive: true },
];

function completeSnapshotRows() {
  const categoryByCode = new Map(categories.map((category) => [category.code, category]));
  return {
    trends: manifest.trends.map((trend) => ({
      id: trend.id,
      title: trend.title,
      categoryCode: trend.categoryCode,
      subjectAreaId: categoryByCode.get(trend.subjectAreaCode).id,
      signalSummary: trend.signal.summary,
      signalDescription: trend.signal.description,
      direction: trend.signal.direction,
      periodStart: trend.signal.periodStart,
      periodEnd: trend.signal.periodEnd,
      businessRelevanceExplanation: trend.businessRelevanceExplanation,
      affectedUserTypes: trend.affectedUserTypes,
      lifecycleState: "DRAFT",
      archivedReason: null,
    })),
    evidences: manifest.trends.flatMap((trend) => trend.evidence.map((evidence) => ({
      id: evidence.id,
      trendId: trend.id,
      sourceName: evidence.sourceName,
      sourceReference: evidence.sourceReference,
      supportingDetail: evidence.supportingDetail,
      sourceDate: null,
      limitations: evidence.limitations,
    }))),
    opportunities: manifest.opportunities.map((opportunity) => ({
      id: opportunity.id,
      relatedTrendId: opportunity.relatedTrendId,
      fnbCategoryId: categoryByCode.get(opportunity.fnbCategoryCode).id,
      name: opportunity.name,
      description: opportunity.description,
      opportunityType: opportunity.opportunityType,
      targetConsumerSummary: null,
      competitionLevel: null,
      competitionSummary: null,
      executionFeasibility: null,
      marketSustainability: null,
      additionalAttributes: {},
    })),
  };
}

function makeHarness({ existing = {}, failAtInsert } = {}) {
  const transaction = { marker: "mock transaction" };
  const statements = [];
  let rolledBack = false;
  const sequelize = {
    query: vi.fn(async (sql, options = {}) => {
      statements.push({ sql, options });
      if (sql.includes("current_database()")) {
        return [{ database_name: "venturex_dev", database_user: "venturex" }];
      }
      if (sql.includes('FROM "fnb_categories"')) return categories;
      if (sql.includes('FROM "trends"')) return existing.trends ?? [];
      if (sql.includes('FROM "trend_evidences"')) return existing.evidences ?? [];
      if (sql.includes('FROM "opportunities"')) return existing.opportunities ?? [];
      if (sql.includes("INSERT INTO")) {
        const insertCount = statements.filter((item) => item.sql.includes("INSERT INTO")).length;
        if (failAtInsert === insertCount) throw new Error("synthetic insert failure");
        return [];
      }
      throw new Error("Unexpected SQL in catalog repository test.");
    }),
    transaction: vi.fn(async (options, callback) => {
      try {
        return await callback(transaction);
      } catch (error) {
        rolledBack = true;
        throw error;
      }
    }),
    close: vi.fn(async () => undefined),
  };
  return {
    repository: new SequelizeCatalogImportRepository(sequelize),
    sequelize,
    statements,
    transaction,
    get rolledBack() { return rolledBack; },
  };
}

describe("SequelizeCatalogImportRepository", () => {
  it("dry-runs with SELECT statements only and never opens a transaction", async () => {
    const harness = makeHarness();
    const plan = await harness.repository.preview(manifest);

    expect(plan).toMatchObject({ action: "CREATE", trendCount: 2, evidenceCount: 4, opportunityCount: 4, databaseWrites: 10 });
    expect(harness.sequelize.transaction).not.toHaveBeenCalled();
    expect(harness.statements.every(({ sql }) => /^\s*SELECT\b/i.test(sql))).toBe(true);
    expect(harness.statements.some(({ sql }) => /\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP)\b/i.test(sql))).toBe(false);
  });

  it("applies only catalog inserts under one serializable transaction and forces DRAFT", async () => {
    const harness = makeHarness();
    const plan = await harness.repository.apply(manifest);
    const inserts = harness.statements.filter(({ sql }) => sql.includes("INSERT INTO"));

    expect(plan.action).toBe("CREATE");
    expect(harness.sequelize.transaction).toHaveBeenCalledOnce();
    expect(harness.sequelize.transaction.mock.calls[0][0].isolationLevel).toBe("SERIALIZABLE");
    expect(inserts).toHaveLength(10);
    expect(inserts.every(({ options }) => options.transaction === harness.transaction)).toBe(true);
    expect(inserts.every(({ sql }) => /INSERT INTO "(?:trends|trend_evidences|opportunities)"/.test(sql))).toBe(true);
    expect(inserts.every(({ sql }) => !/\b(UPDATE|DELETE|TRUNCATE|ALTER|DROP)\b/i.test(sql))).toBe(true);
    const trendInserts = inserts.filter(({ sql }) => sql.includes('INSERT INTO "trends"'));
    expect(trendInserts).toHaveLength(2);
    expect(trendInserts.every(({ sql }) => sql.includes("'DRAFT'"))).toBe(true);
    expect(harness.rolledBack).toBe(false);
  });

  it("rolls back the single transaction after a write failure", async () => {
    const harness = makeHarness({ failAtInsert: 8 });

    await expect(harness.repository.apply(manifest)).rejects.toThrow("synthetic insert failure");
    expect(harness.rolledBack).toBe(true);
    expect(harness.sequelize.transaction).toHaveBeenCalledOnce();
  });

  it("treats exact existing catalog content as a no-op", async () => {
    const harness = makeHarness({ existing: completeSnapshotRows() });
    const plan = await harness.repository.apply(manifest);

    expect(plan.action).toBe("NO_OP");
    expect(plan.databaseWrites).toBe(0);
    expect(harness.statements.some(({ sql }) => sql.includes("INSERT INTO"))).toBe(false);
  });
});
