import { describe, expect, it, vi } from "vitest";
import type { Sequelize } from "sequelize";

import {
  GoogleTrendsProvenanceImportError,
  prepareGoogleTrendsProvenanceImport,
  SequelizeGoogleTrendsProvenanceImportRepository,
  type GenericTrendManifestForImport,
} from "./google-trends-provenance-import";

const databaseUrl = "postgresql://venturex_catalog_test_a1b2c3d4:local-only@127.0.0.1:54329/venturex_catalog_import_test_a1b2c3d4";

function fixture(): GenericTrendManifestForImport {
  return {
    manifestType: "VENTUREX_GENERIC_TREND_PREPARATION",
    manifestVersion: 1,
    manifestId: "repository-adapter-test",
    evidenceMode: "EXTERNAL_SOURCE_CLAIM",
    trends: [{
      id: "50000000-0000-4000-8000-000000000001",
      title: "Synthetic repository adapter trend",
      categoryCode: "CONSUMER_BEHAVIOR",
      subjectAreaCode: null,
      signal: {
        summary: "Synthetic signal.", summaryEvidenceIds: ["50000000-0000-4000-8000-000000000002"],
        description: "Synthetic description.", descriptionEvidenceIds: ["50000000-0000-4000-8000-000000000002"],
        direction: null, directionEvidenceIds: [],
        observationPeriod: { requiredForCuration: false, start: null, end: null, evidenceIds: [] },
        metrics: [], unavailableFields: ["related_queries"],
      },
      evidence: [{
        id: "50000000-0000-4000-8000-000000000002",
        sourceName: "Google Trends Trending Now",
        sourceReference: "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1",
        providerName: null, sourceDate: null, retrievalTimestamp: "2026-10-13T00:00:00.123Z",
        supportingDetail: "Synthetic detail.", limitations: ["Synthetic fixture."],
        sourceProvenance: {
          schemaVersion: 1, sourceId: "google_trends_trending_now_indonesia", originalPublisher: "GOOGLE",
          transportProvider: "BRIGHTDATA_SERP_API", sourceProduct: "GOOGLE_TRENDS_TRENDING_NOW",
          collectionTargetUrl: "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1",
          observationPeriodStatus: "NOT_PROVIDED", observationPeriodStart: null, observationPeriodEnd: null,
          geographyCode: "ID", relatedQueriesAvailability: "UNAVAILABLE", metricsAvailability: "UNAVAILABLE",
          metrics: [
            { name: "volume", availability: "UNAVAILABLE", value: null, semanticAvailability: "UNKNOWN", semantic: null, unitAvailability: "UNKNOWN", unit: null },
            { name: "volume_change", availability: "UNAVAILABLE", value: null, semanticAvailability: "UNKNOWN", semantic: null, unitAvailability: "UNKNOWN", unit: null },
          ],
          completeness: "PARTIAL",
        },
      }],
      businessRelevanceExplanation: null, affectedUserTypes: [],
      factualReview: { decision: "PENDING", reviewerIdentity: null, reviewedAt: null, evidenceLimitations: ["Synthetic only."] },
    }],
  };
}

function makeHarness({ failAtInsert }: { failAtInsert?: number } = {}) {
  const transaction = { marker: "mock transaction" };
  const statements: { sql: string; options: Record<string, unknown> }[] = [];
  let rolledBack = false;
  const sequelize = {
    query: vi.fn(async (sql: string, options: Record<string, unknown> = {}) => {
      statements.push({ sql, options });
      if (sql.includes("current_database()")) {
        return [{
          database: "venturex_catalog_import_test_a1b2c3d4",
          user: "venturex_catalog_test_a1b2c3d4",
          owner: "venturex_catalog_test_a1b2c3d4",
        }];
      }
      if (sql.includes("pg_advisory_xact_lock")) return [];
      if (sql.includes('FROM "fnb_categories"')) return [];
      if (sql.includes('FROM "trends"')) return [];
      if (sql.includes('FROM "trend_evidences"')) return [];
      if (sql.includes('FROM "trend_evidence_provenances"')) return [];
      if (sql.includes("INSERT INTO")) {
        const count = statements.filter(({ sql: statement }) => statement.includes("INSERT INTO")).length;
        if (failAtInsert === count) throw new Error("synthetic persistence failure");
        return [];
      }
      throw new Error("Unexpected SQL in repository adapter test.");
    }),
    transaction: vi.fn(async (options: Record<string, unknown>, callback: (value: typeof transaction) => Promise<unknown>) => {
      try {
        return await callback(transaction);
      } catch (error) {
        rolledBack = true;
        throw error;
      }
    }),
  };
  return {
    repository: new SequelizeGoogleTrendsProvenanceImportRepository(sequelize as unknown as Sequelize, databaseUrl, "test"),
    sequelize,
    statements,
    transaction,
    get rolledBack() { return rolledBack; },
  };
}

describe("Sequelize Google Trends provenance DRAFT import repository", () => {
  it("writes only Trend, Trend Evidence and provenance in one transaction with DRAFT forced", async () => {
    const harness = makeHarness();
    const plan = await harness.repository.apply(fixture());
    const inserts = harness.statements.filter(({ sql }) => sql.includes("INSERT INTO"));

    expect(plan).toMatchObject({ action: "CREATE", trendCount: 1, evidenceCount: 1, provenanceCount: 1, databaseWrites: 3 });
    expect(harness.sequelize.transaction).toHaveBeenCalledOnce();
    expect(harness.sequelize.transaction.mock.calls[0]?.[0]).toMatchObject({ isolationLevel: "READ COMMITTED" });
    expect(inserts).toHaveLength(3);
    expect(inserts.every(({ options }) => options.transaction === harness.transaction)).toBe(true);
    expect(inserts.map(({ sql }) => sql.match(/INSERT INTO "([^"]+)"/)?.[1])).toEqual([
      "trends", "trend_evidences", "trend_evidence_provenances",
    ]);
    expect(inserts[0]?.sql).toContain("'DRAFT'");
    expect(inserts.every(({ sql }) => !/\b(UPDATE|DELETE|TRUNCATE|ALTER|DROP)\b/i.test(sql))).toBe(true);
    expect(harness.statements.some(({ sql }) => /INSERT INTO "opportunities"/i.test(sql))).toBe(false);
    expect(harness.rolledBack).toBe(false);
  });

  it("acquires transaction-scoped database identity locks before snapshot reads", async () => {
    const harness = makeHarness();
    await harness.repository.apply(fixture());
    const transactionIndex = harness.statements.findIndex(({ sql }) => sql.includes("pg_advisory_xact_lock"));
    const snapshotIndex = harness.statements.findIndex(({ sql }) => sql.includes('FROM "trends"'));
    expect(transactionIndex).toBeGreaterThan(-1);
    expect(snapshotIndex).toBeGreaterThan(transactionIndex);
    expect(harness.statements[transactionIndex]?.options.transaction).toBe(harness.transaction);
  });

  it("rolls back the transaction when a later Evidence insert fails", async () => {
    const harness = makeHarness({ failAtInsert: 2 });
    await expect(harness.repository.apply(fixture())).rejects.toMatchObject({ code: "PERSISTENCE_FAILED" });
    expect(harness.rolledBack).toBe(true);
  });

  it("rejects venturex_dev before any database query", async () => {
    const sequelize = { query: vi.fn(), transaction: vi.fn() } as unknown as Sequelize;
    expect(() => new SequelizeGoogleTrendsProvenanceImportRepository(
      sequelize,
      "postgresql://venturex:masked@127.0.0.1:5432/venturex_dev",
      "test",
    )).toThrowError(expect.objectContaining({ code: "TARGET_REJECTED" }));
    expect(sequelize.query).not.toHaveBeenCalled();
  });

  it("rejects invalid manifests before touching the database", async () => {
    const harness = makeHarness();
    const invalid = fixture();
    invalid.trends[0]!.evidence[0]!.sourceDate = "2026-10-12";
    await expect(harness.repository.apply(invalid)).rejects.toBeInstanceOf(GoogleTrendsProvenanceImportError);
    expect(harness.sequelize.query).not.toHaveBeenCalled();
    expect(harness.sequelize.transaction).not.toHaveBeenCalled();
  });

  it("keeps preparation independent of generated IDs and never persists Opportunity data", () => {
    expect(prepareGoogleTrendsProvenanceImport(fixture()).records).toHaveLength(1);
  });
});
