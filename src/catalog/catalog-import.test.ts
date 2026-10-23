import { describe, expect, it } from "vitest";

import { parseCuratedCatalogManifest } from "./catalog-manifest";
import {
  assertApplyConfirmation,
  assertDatabaseIdentity,
  assertSafeCatalogTarget,
  CatalogImportError,
  planCatalogImport,
  targetFromDatabaseUrl,
  type CatalogEvidenceSnapshot,
  type CatalogOpportunitySnapshot,
  type CatalogSnapshot,
  type CatalogTrendSnapshot,
} from "./catalog-import";

const sourceManifest = JSON.parse(await import("node:fs/promises").then(({ readFile }) =>
  readFile("data/catalog/curated-fnb-2025-candidates.v1.json", "utf8"),
)) as unknown;
const manifest = parseCuratedCatalogManifest(sourceManifest);

function emptySnapshot(): CatalogSnapshot {
  return {
    categories: [
      { id: "10000000-0000-4000-8000-000000000001", code: "BEVERAGES", isActive: true },
      { id: "10000000-0000-4000-8000-000000000003", code: "SNACKS", isActive: true },
    ],
    trends: [],
    evidences: [],
    opportunities: [],
  };
}

function completeSnapshot(): CatalogSnapshot {
  const categories = emptySnapshot().categories;
  const categoryByCode = new Map(categories.map((category) => [category.code, category]));
  const trends: CatalogTrendSnapshot[] = manifest.trends.map((trend) => ({
    id: trend.id,
    title: trend.title,
    categoryCode: trend.categoryCode,
    subjectAreaId: categoryByCode.get(trend.subjectAreaCode)!.id,
    signalSummary: trend.signal.summary,
    signalDescription: trend.signal.description,
    direction: trend.signal.direction,
    periodStart: trend.signal.periodStart,
    periodEnd: trend.signal.periodEnd,
    businessRelevanceExplanation: trend.businessRelevanceExplanation,
    affectedUserTypes: trend.affectedUserTypes,
    lifecycleState: "DRAFT",
    archivedReason: null,
  }));
  const evidences: CatalogEvidenceSnapshot[] = manifest.trends.flatMap((trend) =>
    trend.evidence.map((evidence) => ({
      id: evidence.id,
      trendId: trend.id,
      sourceName: evidence.sourceName,
      sourceReference: evidence.sourceReference,
      supportingDetail: evidence.supportingDetail,
      sourceDate: null,
      limitations: evidence.limitations,
    })),
  );
  const opportunities: CatalogOpportunitySnapshot[] = manifest.opportunities.map((opportunity) => ({
    id: opportunity.id,
    relatedTrendId: opportunity.relatedTrendId,
    fnbCategoryId: categoryByCode.get(opportunity.fnbCategoryCode)!.id,
    name: opportunity.name,
    description: opportunity.description,
    opportunityType: opportunity.opportunityType,
    targetConsumerSummary: null,
    competitionLevel: null,
    competitionSummary: null,
    executionFeasibility: null,
    marketSustainability: null,
    additionalAttributes: {},
  }));
  return { categories, trends, evidences, opportunities };
}

describe("curated catalog import safety", () => {
  it("plans only the two Trends, their traceable evidence, and four Opportunities", () => {
    expect(planCatalogImport(manifest, emptySnapshot())).toEqual({
      action: "CREATE",
      trendCount: 2,
      evidenceCount: 4,
      opportunityCount: 4,
      databaseWrites: 10,
    });
  });

  it("is idempotent for an exact existing catalog and never proposes updates", () => {
    expect(planCatalogImport(manifest, completeSnapshot())).toEqual({
      action: "NO_OP",
      trendCount: 2,
      evidenceCount: 4,
      opportunityCount: 4,
      databaseWrites: 0,
    });
  });

  it("rejects changed content under a deterministic identifier", () => {
    const snapshot = completeSnapshot();
    const trends = [...snapshot.trends];
    trends[0] = { ...trends[0]!, signalSummary: "different content" };
    expect(() => planCatalogImport(manifest, { ...snapshot, trends })).toThrow(/conflicts with existing content/);
  });

  it("rejects a partial catalog rather than completing or updating it", () => {
    const snapshot = completeSnapshot();
    expect(() => planCatalogImport(manifest, {
      ...snapshot,
      opportunities: snapshot.opportunities.slice(0, 3),
    })).toThrow(/partial import/);
  });

  it("rejects duplicate provenance under an unrelated evidence identifier", () => {
    const snapshot = emptySnapshot();
    const evidence: CatalogEvidenceSnapshot = {
      id: "90000000-0000-4000-8000-000000000001",
      trendId: "90000000-0000-4000-8000-000000000002",
      sourceName: "existing",
      sourceReference: manifest.trends[0]!.evidence[0]!.sourceReference,
      supportingDetail: "existing",
      sourceDate: null,
      limitations: null,
    };
    expect(() => planCatalogImport(manifest, { ...snapshot, evidences: [evidence] })).toThrow(/source reference already exists/);
  });

  it("requires active reference categories and refuses inactive ones", () => {
    const snapshot = emptySnapshot();
    const categories = snapshot.categories.map((category) =>
      category.code === "BEVERAGES" ? { ...category, isActive: false } : category,
    );
    expect(() => planCatalogImport(manifest, { ...snapshot, categories })).toThrow(/active F&B category/);
  });

  it("allows only the confirmed local development database and user", () => {
    const target = targetFromDatabaseUrl("postgresql://venturex:masked@localhost:5432/venturex_dev", "development");
    expect(() => assertSafeCatalogTarget(target)).not.toThrow();
    expect(() => assertDatabaseIdentity(target, { database: "venturex_dev", user: "venturex" })).not.toThrow();
    expect(() => assertDatabaseIdentity(target, { database: "production", user: "venturex" })).toThrow(/identity does not match/);
  });

  it("rejects production mode, remote hosts, and unexpected database identities", () => {
    expect(() => assertSafeCatalogTarget({
      host: "localhost", port: 5432, database: "venturex_dev", user: "venturex", nodeEnv: "production",
    })).toThrow(/NODE_ENV is production/);
    expect(() => assertSafeCatalogTarget({
      host: "db.example.com", port: 5432, database: "venturex_dev", user: "venturex",
    })).toThrow(/target rejected/);
    expect(() => assertSafeCatalogTarget({
      host: "localhost", port: 5432, database: "venturex_prod", user: "venturex",
    })).toThrow(CatalogImportError);
  });

  it("requires both explicit confirmation values before apply", () => {
    expect(() => assertApplyConfirmation(false, {})).not.toThrow();
    expect(() => assertApplyConfirmation(true, {})).toThrow(/requires exact/);
    expect(() => assertApplyConfirmation(true, { database: "venturex_dev", user: "venturex" })).not.toThrow();
  });
});
