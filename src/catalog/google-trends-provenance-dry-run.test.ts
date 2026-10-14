import { describe, expect, it } from "vitest";

import { genericTrendManifestPreparationSchema, type GenericTrendManifestPreparationInput } from "./generic-trend-manifest";
import { mapGoogleTrendsManifestToProvenanceDryRun } from "./google-trends-provenance-dry-run";
import { TREND_EVIDENCE_PROVENANCE_SOURCE_IDS } from "../trend/trend-evidence-provenance.schema";

const trendId = "20000000-0000-4000-8000-000000000001";
const evidenceId = "20000000-0000-4000-8000-000000000002";
const targetUrl = "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1";

// Synthetic shape-only data for isolated tests; it is not a provider response
// and must not be treated as source evidence or imported into a catalog.
function supportedManifest(): GenericTrendManifestPreparationInput {
  const manifest: GenericTrendManifestPreparationInput = {
    manifestType: "VENTUREX_GENERIC_TREND_PREPARATION",
    manifestVersion: 1,
    manifestId: "synthetic-mapping-test-only",
    evidenceMode: "EXTERNAL_SOURCE_CLAIM",
    trends: [{
      id: trendId,
      title: "Synthetic Trend for mapping tests",
      categoryCode: "CONSUMER_BEHAVIOR",
      subjectAreaCode: null,
      signal: {
        summary: "Synthetic summary used only to test field mapping.",
        summaryEvidenceIds: [evidenceId],
        description: "Synthetic description; no factual review or market claim.",
        descriptionEvidenceIds: [evidenceId],
        direction: null,
        directionEvidenceIds: [],
        observationPeriod: {
          requiredForCuration: false,
          start: null,
          end: null,
          evidenceIds: [],
        },
        metrics: [],
        unavailableFields: ["related_queries"],
      },
      evidence: [{
        id: evidenceId,
        sourceName: "Google Trends Trending Now",
        sourceReference: targetUrl,
        providerName: null,
        sourceDate: null,
        retrievalTimestamp: "2026-10-13T00:00:00.123Z",
        supportingDetail: "Synthetic test-only description of a source observation.",
        limitations: [
          "Synthetic fixture only; no Google Trends observation was reviewed.",
          "related_queries is unavailable in this synthetic fixture.",
        ],
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
            {
              name: "volume",
              availability: "AVAILABLE",
              value: 120,
              semanticAvailability: "UNKNOWN",
              semantic: null,
              unitAvailability: "UNKNOWN",
              unit: null,
            },
            {
              name: "volume_change",
              availability: "UNAVAILABLE",
              value: null,
              semanticAvailability: "UNKNOWN",
              semantic: null,
              unitAvailability: "UNKNOWN",
              unit: null,
            },
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
        evidenceLimitations: ["Synthetic tests do not establish factual support."],
      },
    }],
  };
  return manifest;
}

describe("Google Trends Bright Data provenance dry-run mapping", () => {
  it("maps only the explicitly approved publisher, product, transport, target, and geography", () => {
    const input = supportedManifest();
    const validation = genericTrendManifestPreparationSchema.safeParse(input);
    const result = mapGoogleTrendsManifestToProvenanceDryRun(input);

    expect(validation.success).toBe(true);
    expect(result.status).toBe("MAPPED");
    if (result.status !== "MAPPED") return;
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.provenanceRecordPreview).toMatchObject({
      schemaVersion: 1,
      sourceId: "google_trends_trending_now_indonesia",
      originalPublisher: "GOOGLE",
      transportProvider: "BRIGHTDATA_SERP_API",
      sourceProduct: "GOOGLE_TRENDS_TRENDING_NOW",
      collectionTargetUrl: targetUrl,
      geographyCode: "ID",
      metricsAvailability: "PARTIAL",
      completeness: "PARTIAL",
    });
    expect(result).toMatchObject({
      persistence: "NOT_PERFORMED",
      lifecycleTransition: "NONE",
      sourceAuthority: "NOT_VERIFIED",
      usageRightsReview: "NOT_APPROVED",
      importerReadiness: "NOT_READY_FOR_IMPORT",
    });
  });

  it.each([
    ["publisher", (provenance: Record<string, unknown>) => { provenance.originalPublisher = "BING"; }],
    ["transport", (provenance: Record<string, unknown>) => { provenance.transportProvider = "OTHER"; }],
    ["product", (provenance: Record<string, unknown>) => { provenance.sourceProduct = "OTHER"; }],
    ["source ID", (provenance: Record<string, unknown>) => { provenance.sourceId = "google_year_in_search_indonesia_2025"; }],
    ["collection target", (provenance: Record<string, unknown>) => { provenance.collectionTargetUrl = "https://example.com"; }],
  ])("rejects an unsupported or inconsistent %s without guessing", (_name, mutate) => {
    const input = supportedManifest();
    mutate(input.trends[0]!.evidence[0]!.sourceProvenance as unknown as Record<string, unknown>);

    expect(genericTrendManifestPreparationSchema.safeParse(input).success).toBe(false);
    expect(mapGoogleTrendsManifestToProvenanceDryRun(input).status).toBe("REJECTED");
  });

  it.each([
    ["original publisher", "originalPublisher"],
    ["transport provider", "transportProvider"],
  ])("requires explicit %s metadata", (_name, field) => {
    const input = supportedManifest();
    delete (input.trends[0]!.evidence[0]!.sourceProvenance as unknown as Record<string, unknown>)[field];

    expect(genericTrendManifestPreparationSchema.safeParse(input).success).toBe(false);
    expect(mapGoogleTrendsManifestToProvenanceDryRun(input).status).toBe("REJECTED");
  });

  it("rejects absent explicit provenance even when free-text names look plausible", () => {
    const input = supportedManifest();
    input.trends[0]!.evidence[0]!.sourceProvenance = undefined;
    input.trends[0]!.evidence[0]!.sourceName = "Google Trends Trending Now";
    input.trends[0]!.evidence[0]!.providerName = "Bright Data SERP API";

    expect(genericTrendManifestPreparationSchema.safeParse(input).success).toBe(true);
    const result = mapGoogleTrendsManifestToProvenanceDryRun(input);

    expect(result.status).toBe("REJECTED");
    if (result.status === "REJECTED") {
      expect(result.issues.map(({ code }) => code)).toContain(
        "EXPLICIT_GOOGLE_TRENDS_BRIGHTDATA_PROVENANCE_REQUIRED",
      );
    }
  });

  it("rejects an unstructured provider label beside explicit transport provenance", () => {
    const input = supportedManifest();
    input.trends[0]!.evidence[0]!.providerName = "Web Unlocker";

    const result = mapGoogleTrendsManifestToProvenanceDryRun(input);

    expect(result.status).toBe("REJECTED");
    if (result.status === "REJECTED") {
      expect(result.issues.map(({ code }) => code)).toContain(
        "PROVIDER_NAME_TEXT_NOT_MAPPED_USE_EXPLICIT_TRANSPORT_PROVIDER",
      );
    }
  });

  it("preserves a missing source date and missing retrieval time without inventing dates", () => {
    const input = supportedManifest();
    input.trends[0]!.evidence[0]!.retrievalTimestamp = null;

    const result = mapGoogleTrendsManifestToProvenanceDryRun(input);

    expect(result.status).toBe("MAPPED");
    if (result.status !== "MAPPED") return;
    expect(result.records[0]?.evidenceRecordPreview.sourceDate).toBeNull();
    expect(result.records[0]?.provenanceRecordPreview.retrievedAt).toBeNull();
    expect(result.records[0]?.retainedManifestContext.retrievalTimestamp).toBeNull();
  });

  it("rejects source dates and retrieval precision the existing source contract cannot justify or preserve", () => {
    const sourceDate = supportedManifest();
    sourceDate.trends[0]!.evidence[0]!.sourceDate = "2026-10-12";
    const preciseTimestamp = supportedManifest();
    preciseTimestamp.trends[0]!.evidence[0]!.retrievalTimestamp = "2026-10-13T00:00:00.123456Z";

    expect(genericTrendManifestPreparationSchema.safeParse(sourceDate).success).toBe(false);
    expect(genericTrendManifestPreparationSchema.safeParse(preciseTimestamp).success).toBe(false);
  });

  it("preserves source references, exact limitation items, and the explicit unknown period", () => {
    const input = supportedManifest();
    const result = mapGoogleTrendsManifestToProvenanceDryRun(input);

    expect(result.status).toBe("MAPPED");
    if (result.status !== "MAPPED") return;
    const record = result.records[0]!;
    expect(record.evidenceRecordPreview.sourceReference).toBe(targetUrl);
    expect(record.retainedManifestContext.limitationItems).toEqual(input.trends[0]!.evidence[0]!.limitations);
    expect(record.evidenceRecordPreview.limitationsText).toContain("related_queries is unavailable");
    expect(record.evidenceRecordPreview.limitationsText).toContain(
      "Provider field related_queries availability: UNAVAILABLE.",
    );
    expect(record.retainedManifestContext.unavailableTrendFields).toEqual(["related_queries"]);
    expect(record.provenanceRecordPreview.observationPeriodStatus).toBe("NOT_PROVIDED");
    expect(record.provenanceRecordPreview.observationPeriodStart).toBeNull();
    expect(record.provenanceRecordPreview.observationPeriodEnd).toBeNull();
    expect(record.retainedManifestContext.relatedQueriesAvailability).toBe("UNAVAILABLE");
    expect(record.provenanceRecordPreview.completeness).toBe("PARTIAL");
  });

  it("rejects missing auxiliary data that is hidden behind a COMPLETE label", () => {
    const input = supportedManifest();
    input.trends[0]!.evidence[0]!.sourceProvenance!.completeness = "COMPLETE";

    const result = mapGoogleTrendsManifestToProvenanceDryRun(input);

    expect(result.status).toBe("REJECTED");
    if (result.status === "REJECTED") {
      expect(result.issues.map(({ code }) => code)).toContain(
        "MISSING_RELATED_QUERIES_CANNOT_BE_LABELED_COMPLETE",
      );
    }
  });

  it("requires an explicit availability entry for both supported Google metric fields", () => {
    const input = supportedManifest();
    const provenance = input.trends[0]!.evidence[0]!.sourceProvenance!;
    provenance.metrics = provenance.metrics.filter(({ name }) => name === "volume");
    provenance.metricsAvailability = "AVAILABLE";

    const result = mapGoogleTrendsManifestToProvenanceDryRun(input);

    expect(result.status).toBe("REJECTED");
    if (result.status === "REJECTED") {
      expect(result.issues.map(({ code }) => code)).toContain(
        "GOOGLE_TRENDS_METRIC_AVAILABILITY_MUST_BE_EXPLICIT",
      );
    }
  });

  it("maps a known period only when Trend and provenance periods agree and cite the same evidence", () => {
    const input = supportedManifest();
    const provenance = input.trends[0]!.evidence[0]!.sourceProvenance!;
    provenance.observationPeriodStatus = "KNOWN";
    provenance.observationPeriodStart = "2025-01-01";
    provenance.observationPeriodEnd = "2025-01-31";
    input.trends[0]!.signal.observationPeriod = {
      requiredForCuration: true,
      start: "2025-01-01",
      end: "2025-01-31",
      evidenceIds: [evidenceId],
    };

    const result = mapGoogleTrendsManifestToProvenanceDryRun(input);

    expect(result.status).toBe("MAPPED");
    if (result.status === "MAPPED") {
      expect(result.records[0]?.provenanceRecordPreview.observationPeriodStart).toBe("2025-01-01");
      expect(result.records[0]?.retainedManifestContext.observationPeriod.end).toBe("2025-01-31");
    }
  });

  it("rejects contradictory source metric values instead of coercing them", () => {
    const input = supportedManifest();
    input.trends[0]!.signal.metrics = [{
      name: "volume",
      rawValue: 121,
      unit: null,
      evidenceId,
      limitation: "Synthetic test metric unit is unknown.",
    }];

    expect(genericTrendManifestPreparationSchema.safeParse(input).success).toBe(false);
    expect(mapGoogleTrendsManifestToProvenanceDryRun(input).status).toBe("REJECTED");
  });

  it("is deterministic and refuses the existing synthetic fixture mode", () => {
    const input = supportedManifest();

    expect(mapGoogleTrendsManifestToProvenanceDryRun(input)).toEqual(
      mapGoogleTrendsManifestToProvenanceDryRun(input),
    );
    input.evidenceMode = "SYNTHETIC_FIXTURE";
    const syntheticResult = mapGoogleTrendsManifestToProvenanceDryRun(input);

    expect(syntheticResult.status).toBe("REJECTED");
    expect(TREND_EVIDENCE_PROVENANCE_SOURCE_IDS).not.toContain("SYNTHETIC_FIXTURE");
  });

  it("keeps a present empty related-query list distinct from missing data", () => {
    const input = supportedManifest();
    input.trends[0]!.evidence[0]!.sourceProvenance!.relatedQueriesAvailability = "AVAILABLE";
    input.trends[0]!.signal.unavailableFields = [];

    const result = mapGoogleTrendsManifestToProvenanceDryRun(input);

    expect(result.status).toBe("MAPPED");
    if (result.status === "MAPPED") {
      expect(result.records[0]?.retainedManifestContext.relatedQueriesAvailability).toBe("AVAILABLE");
    }
  });
});
