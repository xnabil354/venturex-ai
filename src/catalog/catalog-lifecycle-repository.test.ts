import { describe, expect, it, vi } from "vitest";
import type { Sequelize } from "sequelize";

import { fingerprintCatalogContentVersioned } from "./catalog-fingerprint";
import { loadVersionedCatalogLifecycleSnapshot } from "./catalog-lifecycle-repository";
import type { CatalogFingerprintVersion } from "./catalog-fingerprint";

const trendId = "11111111-1111-4111-8111-111111111111";
const evidenceWithoutProvenanceId = "22222222-2222-4222-8222-222222222222";
const evidenceWithProvenanceId = "33333333-3333-4333-8333-333333333333";

function createMockSequelize(resultSets: unknown[][]) {
  const query = vi.fn(async (..._arguments: unknown[]) => resultSets.shift() ?? []);
  return { sequelize: { query } as unknown as Sequelize, query };
}

function trendRow() {
  return {
    id: trendId,
    title: "Synthetic Trend",
    categoryCode: "PRODUCT_MENU",
    subjectAreaCode: "BEVERAGES",
    signalSummary: "Synthetic summary.",
    signalDescription: "Synthetic description for contract tests.",
    direction: "RISING",
    periodStart: new Date("2025-01-01T00:00:00.000Z"),
    periodEnd: new Date("2025-12-31T00:00:00.000Z"),
    businessRelevanceExplanation: "Synthetic explanation.",
    affectedUserTypes: ["UMKM_EXISTING", "ENTREPRENEUR"],
  };
}

function evidenceRow(id: string, provenance: Record<string, unknown> | null = null) {
  return {
    id,
    sourceName: "Synthetic source",
    sourceReference: "https://example.test/synthetic-source",
    supportingDetail: "Synthetic evidence detail.",
    sourceDate: new Date("2025-06-15T00:00:00.000Z"),
    limitations: "Synthetic fixture; not factual evidence.",
    provenanceSchemaVersion: provenance === null ? null : 1,
    provenanceSourceId: provenance?.sourceId ?? null,
    provenanceOriginalPublisher: provenance?.originalPublisher ?? null,
    provenanceTransportProvider: provenance?.transportProvider ?? null,
    provenanceSourceProduct: provenance?.sourceProduct ?? null,
    provenanceCollectionTargetUrl: provenance?.collectionTargetUrl ?? null,
    provenanceRetrievedAt: provenance?.retrievedAt ?? null,
    provenanceObservationPeriodStatus: provenance?.observationPeriodStatus ?? null,
    provenanceObservationPeriodStart: provenance?.observationPeriodStart ?? null,
    provenanceObservationPeriodEnd: provenance?.observationPeriodEnd ?? null,
    provenanceGeographyCode: provenance?.geographyCode ?? null,
    provenanceMetricsAvailability: provenance?.metricsAvailability ?? null,
    provenanceMetrics: provenance?.metrics ?? null,
    provenanceCompleteness: provenance?.completeness ?? null,
  };
}

function validProvenance() {
  return {
    sourceId: "google_trends_trending_now_indonesia",
    originalPublisher: "GOOGLE",
    transportProvider: "BRIGHTDATA_SERP_API",
    sourceProduct: "GOOGLE_TRENDS_TRENDING_NOW",
    collectionTargetUrl: "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1",
    retrievedAt: new Date("2025-06-15T09:30:00.000Z"),
    observationPeriodStatus: "NOT_PROVIDED",
    observationPeriodStart: null,
    observationPeriodEnd: null,
    geographyCode: "ID",
    metricsAvailability: "AVAILABLE",
    metrics: [
      {
        name: "volume_change",
        availability: "AVAILABLE",
        value: "+100%",
        semanticAvailability: "KNOWN",
        semantic: "Synthetic provider-reported change label",
        unitAvailability: "KNOWN",
        unit: "%",
      },
      {
        name: "volume",
        availability: "AVAILABLE",
        value: 1200,
        semanticAvailability: "KNOWN",
        semantic: "Synthetic provider-reported volume value",
        unitAvailability: "UNKNOWN",
        unit: null,
      },
    ],
    completeness: "PARTIAL",
  };
}

describe("version-aware catalog lifecycle snapshot preparation", () => {
  it("keeps the historical v1 loader and Opportunity snapshot unchanged", async () => {
    const legacyTrend = { ...trendRow(), lifecycleState: "PUBLISHED" };
    const opportunity = {
      id: "44444444-4444-4444-8444-444444444444",
      relatedTrendId: trendId,
      fnbCategoryCode: "BEVERAGES",
      name: "Synthetic opportunity",
      description: "Legacy v1 fixture.",
      opportunityType: "PRODUCT",
      targetConsumerSummary: null,
      competitionLevel: null,
      competitionSummary: null,
      executionFeasibility: null,
      marketSustainability: null,
      additionalAttributes: {},
    };
    const { sequelize, query } = createMockSequelize([[legacyTrend], [], [opportunity]]);

    const result = await loadVersionedCatalogLifecycleSnapshot(sequelize, trendId, 1);

    expect(result?.fingerprintVersion).toBe(1);
    expect(result?.snapshot).toMatchObject({ trend: { id: trendId, lifecycleState: "PUBLISHED" }, opportunities: [opportunity] });
    expect(query).toHaveBeenCalledTimes(3);
    expect(String(query.mock.calls[2]?.[0])).toContain("FROM opportunities AS o");
  });

  it("loads strict v2 Trend and Evidence only, preserves missing provenance, and stabilizes ordering", async () => {
    const { sequelize, query } = createMockSequelize([
      [trendRow()],
      [
        evidenceRow(evidenceWithProvenanceId, validProvenance()),
        evidenceRow(evidenceWithoutProvenanceId),
      ],
    ]);

    const result = await loadVersionedCatalogLifecycleSnapshot(sequelize, trendId, 2);

    expect(result?.fingerprintVersion).toBe(2);
    if (!result || result.fingerprintVersion !== 2) throw new Error("Expected a v2 snapshot.");
    expect(result.snapshot.evidence.map(({ id }) => id)).toEqual([
      evidenceWithoutProvenanceId,
      evidenceWithProvenanceId,
    ]);
    expect(result.snapshot.evidence[0]?.provenance).toBeNull();
    expect(result.snapshot.evidence[1]?.provenance?.trendEvidenceId).toBe(evidenceWithProvenanceId);
    expect(result.snapshot.evidence[1]?.provenance?.metrics.map(({ name }) => name)).toEqual(["volume", "volume_change"]);
    expect(result.snapshot.affectedUserTypes).toEqual(["ENTREPRENEUR", "UMKM_EXISTING"]);
    expect(result.snapshot).not.toHaveProperty("opportunities");
    expect(fingerprintCatalogContentVersioned({ fingerprintVersion: 2, snapshot: result.snapshot }).fingerprintVersion).toBe(2);
    expect(query).toHaveBeenCalledTimes(2);
    expect(String(query.mock.calls[1]?.[0])).toContain("LEFT JOIN trend_evidence_provenances AS p");
    expect(String(query.mock.calls[1]?.[0])).toContain("ORDER BY e.id ASC");
    expect(String(query.mock.calls[1]?.[0])).not.toContain("FROM opportunities");
  });

  it("requires a known explicit version and performs no query for unknown versions", async () => {
    const { sequelize, query } = createMockSequelize([]);

    await expect(loadVersionedCatalogLifecycleSnapshot(sequelize, trendId, 3 as CatalogFingerprintVersion))
      .rejects.toThrow("Unsupported catalog fingerprint version.");
    expect(query).not.toHaveBeenCalled();
  });

  it("returns null for an absent Trend without loading related data", async () => {
    const { sequelize, query } = createMockSequelize([[]]);

    await expect(loadVersionedCatalogLifecycleSnapshot(sequelize, trendId, 2)).resolves.toBeNull();
    expect(query).toHaveBeenCalledOnce();
  });

  it("fails closed on malformed stored provenance rather than treating it as absent", async () => {
    const invalidProvenance = { ...validProvenance(), sourceId: "unsupported" };
    const { sequelize } = createMockSequelize([[trendRow()], [evidenceRow(evidenceWithProvenanceId, invalidProvenance)]]);

    await expect(loadVersionedCatalogLifecycleSnapshot(sequelize, trendId, 2))
      .rejects.toThrow("Version 2 lifecycle snapshot failed strict Trend and Evidence validation.");
  });

  it("rejects partial join data instead of converting it to missing provenance", async () => {
    const partialProvenance = {
      ...evidenceRow(evidenceWithProvenanceId),
      provenanceSourceId: "google_trends_trending_now_indonesia",
    };
    const { sequelize } = createMockSequelize([[trendRow()], [partialProvenance]]);

    await expect(loadVersionedCatalogLifecycleSnapshot(sequelize, trendId, 2))
      .rejects.toThrow("Version 2 lifecycle snapshot contains an incomplete provenance row.");
  });
});
