import { describe, expect, it } from "vitest";

import {
  assertDisposableGoogleTrendsImportTarget,
  GoogleTrendsProvenanceImportError,
  planGoogleTrendsProvenanceImport,
  prepareGoogleTrendsProvenanceImport,
  type GenericTrendManifestForImport,
  type GoogleTrendsProvenanceImportSnapshot,
} from "./google-trends-provenance-import";

const trendId = "30000000-0000-4000-8000-000000000001";
const evidenceId = "30000000-0000-4000-8000-000000000002";
const targetUrl = "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1";

// Synthetic provider-shaped test data only; it is not a captured provider response.
function syntheticManifest(): GenericTrendManifestForImport {
  return {
    manifestType: "VENTUREX_GENERIC_TREND_PREPARATION",
    manifestVersion: 1,
    manifestId: "synthetic-google-trends-import-test",
    evidenceMode: "EXTERNAL_SOURCE_CLAIM",
    trends: [{
      id: trendId,
      title: "Synthetic beverage query trend",
      categoryCode: "CONSUMER_BEHAVIOR",
      subjectAreaCode: null,
      signal: {
        summary: "Synthetic summary for persistence tests.",
        summaryEvidenceIds: [evidenceId],
        description: "Synthetic detail; not a market fact.",
        descriptionEvidenceIds: [evidenceId],
        direction: null,
        directionEvidenceIds: [],
        observationPeriod: { requiredForCuration: false, start: null, end: null, evidenceIds: [] },
        metrics: [{
          name: "volume",
          rawValue: 120,
          unit: null,
          evidenceId,
          limitation: "Synthetic metric with unknown unit.",
        }],
        unavailableFields: ["related_queries"],
      },
      evidence: [{
        id: evidenceId,
        sourceName: "Google Trends Trending Now",
        sourceReference: targetUrl,
        providerName: null,
        sourceDate: null,
        retrievalTimestamp: "2026-10-13T00:00:00.123Z",
        supportingDetail: "Synthetic provider-shaped observation used for round-trip tests.",
        limitations: ["Synthetic test data; no factual observation was reviewed."],
        sourceProvenance: {
          schemaVersion: 1,
          sourceId: "google_trends_trending_now_indonesia",
          originalPublisher: "GOOGLE",
          transportProvider: "BRIGHTDATA_SERP_API",
          sourceProduct: "GOOGLE_TRENDS_TRENDING_NOW",
          collectionTargetUrl: targetUrl,
          observationPeriodStatus: "NOT_PROVIDED",
          observationPeriodStart: null,
          observationPeriodEnd: null,
          geographyCode: "ID",
          relatedQueriesAvailability: "UNAVAILABLE",
          metricsAvailability: "PARTIAL",
          metrics: [
            { name: "volume", availability: "AVAILABLE", value: 120, semanticAvailability: "UNKNOWN", semantic: null, unitAvailability: "UNKNOWN", unit: null },
            { name: "volume_change", availability: "UNAVAILABLE", value: null, semanticAvailability: "UNKNOWN", semantic: null, unitAvailability: "UNKNOWN", unit: null },
          ],
          completeness: "PARTIAL",
        },
      }],
      businessRelevanceExplanation: null,
      affectedUserTypes: [],
      factualReview: {
        decision: "PENDING",
        reviewerIdentity: null,
        reviewedAt: null,
        evidenceLimitations: ["Synthetic test data does not establish factual support."],
      },
    }],
  };
}

function emptySnapshot(): GoogleTrendsProvenanceImportSnapshot {
  return { categories: [], trends: [], evidences: [], provenances: [] };
}

describe("Google Trends provenance DRAFT import preparation", () => {
  it("maps only explicit source fields and persists availability as a limitation", () => {
    const prepared = prepareGoogleTrendsProvenanceImport(syntheticManifest());
    const trend = prepared.records[0]!;
    const evidence = trend.evidence[0]!;

    expect(prepared.manifestId).toBe("synthetic-google-trends-import-test");
    expect(trend).toMatchObject({
      id: trendId,
      categoryCode: "CONSUMER_BEHAVIOR",
      subjectAreaCode: null,
      direction: null,
      periodStart: null,
      periodEnd: null,
    });
    expect(evidence).toMatchObject({
      id: evidenceId,
      sourceName: "Google Trends Trending Now",
      sourceReference: targetUrl,
      provenance: {
        sourceId: "google_trends_trending_now_indonesia",
        originalPublisher: "GOOGLE",
        transportProvider: "BRIGHTDATA_SERP_API",
        sourceProduct: "GOOGLE_TRENDS_TRENDING_NOW",
        retrievedAt: new Date("2026-10-13T00:00:00.123Z"),
        observationPeriodStatus: "NOT_PROVIDED",
        metricsAvailability: "PARTIAL",
        completeness: "PARTIAL",
      },
    });
    expect("sourceDate" in evidence).toBe(false);
    expect(evidence.limitations).toContain("Provider field related_queries availability: UNAVAILABLE.");
    expect(evidence.limitations).toContain("Trend field related_queries is unavailable.");
    expect(evidence.limitations).toContain("Source date is unavailable for Google Trends Trending Now; retrieval time is recorded separately.");
    expect(evidence.provenance.metrics).toEqual([
      expect.objectContaining({ name: "volume", value: 120, unit: null, unitAvailability: "UNKNOWN" }),
      expect.objectContaining({ name: "volume_change", value: null, availability: "UNAVAILABLE" }),
    ]);
  });

  it("rejects synthetic fixture mode and unsupported or incomplete provenance before persistence", () => {
    const fixture = syntheticManifest();
    fixture.evidenceMode = "SYNTHETIC_FIXTURE";
    expect(() => prepareGoogleTrendsProvenanceImport(fixture)).toThrowError(
      expect.objectContaining({ code: "UNSUPPORTED_SOURCE" }),
    );

    const missingProvenance = syntheticManifest();
    delete missingProvenance.trends[0]!.evidence[0]!.sourceProvenance;
    expect(() => prepareGoogleTrendsProvenanceImport(missingProvenance)).toThrowError(GoogleTrendsProvenanceImportError);

    const unsupported = syntheticManifest();
    (unsupported.trends[0]!.evidence[0]!.sourceProvenance as unknown as { transportProvider: string }).transportProvider = "UNKNOWN";
    expect(() => prepareGoogleTrendsProvenanceImport(unsupported)).toThrowError(GoogleTrendsProvenanceImportError);
  });

  it("rejects missing Evidence and an incomplete observation period", () => {
    const missingEvidence = syntheticManifest();
    missingEvidence.trends[0]!.evidence = [];
    expect(() => prepareGoogleTrendsProvenanceImport(missingEvidence)).toThrowError(GoogleTrendsProvenanceImportError);

    const invalidPeriod = syntheticManifest();
    invalidPeriod.trends[0]!.signal.observationPeriod.start = "2026-01-01";
    expect(() => prepareGoogleTrendsProvenanceImport(invalidPeriod)).toThrowError(GoogleTrendsProvenanceImportError);
  });
});

describe("Google Trends provenance import planning", () => {
  it("plans one Trend, Evidence and provenance row, without Opportunity writes", () => {
    expect(planGoogleTrendsProvenanceImport(
      prepareGoogleTrendsProvenanceImport(syntheticManifest()),
      emptySnapshot(),
    )).toEqual({
      action: "CREATE",
      trendCount: 1,
      evidenceCount: 1,
      provenanceCount: 1,
      databaseWrites: 3,
    });
  });

  it("treats an exact Trend/Evidence/provenance snapshot as a no-op", () => {
    const prepared = prepareGoogleTrendsProvenanceImport(syntheticManifest());
    const trend = prepared.records[0]!;
    const evidence = trend.evidence[0]!;
    const provenance = evidence.provenance;
    const snapshot: GoogleTrendsProvenanceImportSnapshot = {
      categories: [],
      trends: [{
        id: trend.id,
        title: trend.title,
        categoryCode: trend.categoryCode,
        subjectAreaId: null,
        signalSummary: trend.signalSummary,
        signalDescription: trend.signalDescription,
        direction: trend.direction,
        periodStart: trend.periodStart,
        periodEnd: trend.periodEnd,
        businessRelevanceExplanation: trend.businessRelevanceExplanation,
        affectedUserTypes: trend.affectedUserTypes,
        lifecycleState: "DRAFT",
        archivedReason: null,
      }],
      evidences: [{
        id: evidence.id,
        trendId: trend.id,
        sourceName: evidence.sourceName,
        sourceReference: evidence.sourceReference,
        supportingDetail: evidence.supportingDetail,
        sourceDate: null,
        limitations: evidence.limitations,
      }],
      provenances: [provenance],
    };
    expect(planGoogleTrendsProvenanceImport(prepared, snapshot)).toMatchObject({ action: "NO_OP", databaseWrites: 0 });
  });

  it("rejects conflicting, partial, or already transitioned records without proposing updates", () => {
    const prepared = prepareGoogleTrendsProvenanceImport(syntheticManifest());
    const empty = emptySnapshot();
    const trend = prepared.records[0]!;
    const existingTrend = {
      id: trend.id,
      title: trend.title,
      categoryCode: trend.categoryCode,
      subjectAreaId: null,
      signalSummary: trend.signalSummary,
      signalDescription: trend.signalDescription,
      direction: trend.direction,
      periodStart: trend.periodStart,
      periodEnd: trend.periodEnd,
      businessRelevanceExplanation: trend.businessRelevanceExplanation,
      affectedUserTypes: trend.affectedUserTypes,
      lifecycleState: "DRAFT",
      archivedReason: null,
    } as const;
    expect(() => planGoogleTrendsProvenanceImport(prepared, {
      ...empty,
      trends: [{ ...existingTrend, signalSummary: "changed" }],
    })).toThrowError(expect.objectContaining({ code: "CATALOG_CONFLICT" }));
    expect(() => planGoogleTrendsProvenanceImport(prepared, { ...empty, trends: [existingTrend] }))
      .toThrowError(expect.objectContaining({ code: "PARTIAL_IMPORT" }));
    expect(() => planGoogleTrendsProvenanceImport(prepared, {
      ...empty,
      trends: [{ ...existingTrend, lifecycleState: "PUBLISHED" }],
    })).toThrowError(expect.objectContaining({ code: "CATALOG_CONFLICT" }));
  });

  it("rejects an inactive subject area rather than changing the Trend contract", () => {
    const manifest = syntheticManifest();
    manifest.trends[0]!.subjectAreaCode = "BEVERAGES";
    const prepared = prepareGoogleTrendsProvenanceImport(manifest);
    expect(() => planGoogleTrendsProvenanceImport(prepared, {
      ...emptySnapshot(),
      categories: [{ id: "40000000-0000-4000-8000-000000000001", code: "BEVERAGES", isActive: false }],
    })).toThrowError(expect.objectContaining({ code: "CATALOG_CONFLICT" }));
  });
});

describe("disposable import target guard", () => {
  it("accepts only a dynamically mapped local test target", () => {
    expect(assertDisposableGoogleTrendsImportTarget(
      "postgresql://venturex_catalog_test_a1b2c3d4:test-secret@127.0.0.1:54329/venturex_catalog_import_test_a1b2c3d4",
      "test",
    )).toEqual({
      host: "127.0.0.1",
      port: 54329,
      database: "venturex_catalog_import_test_a1b2c3d4",
      user: "venturex_catalog_test_a1b2c3d4",
    });
  });

  it.each([
    "postgresql://venturex:secret@127.0.0.1:5432/venturex_dev",
    "postgresql://venturex_catalog_test_a1b2c3d4:secret@127.0.0.1:5432/venturex_catalog_import_test_a1b2c3d4",
    "postgresql://venturex_catalog_test_a1b2c3d4:secret@db.example.test:54329/venturex_catalog_import_test_a1b2c3d4",
    "postgresql://venturex_catalog_test_a1b2c3d4:secret@127.0.0.1:54329/venturex_catalog_import_test_a1b2c3d4?sslmode=disable",
  ])("rejects an unsafe target shape", (url) => {
    expect(() => assertDisposableGoogleTrendsImportTarget(url, "test")).toThrowError(GoogleTrendsProvenanceImportError);
  });

  it("refuses production mode even when the URL has a disposable-looking name", () => {
    expect(() => assertDisposableGoogleTrendsImportTarget(
      "postgresql://venturex_catalog_test_a1b2c3d4:test-secret@127.0.0.1:54329/venturex_catalog_import_test_a1b2c3d4",
      "production",
    )).toThrowError(GoogleTrendsProvenanceImportError);
  });
});
