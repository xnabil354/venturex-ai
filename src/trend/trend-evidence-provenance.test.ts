import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  parseTrendEvidenceProvenanceInput,
  trendEvidenceProvenanceInputSchema,
  type TrendEvidenceProvenanceInput,
} from "../db/models/trend-evidence-provenance.model";

const trendsProvenance = (): TrendEvidenceProvenanceInput => ({
  trendEvidenceId: "a1200000-2025-5500-8000-000000000001",
  schemaVersion: 1,
  sourceId: "google_trends_trending_now_indonesia",
  originalPublisher: "GOOGLE",
  transportProvider: "BRIGHTDATA_SERP_API",
  sourceProduct: "GOOGLE_TRENDS_TRENDING_NOW",
  collectionTargetUrl: "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1",
  retrievedAt: new Date("2025-10-20T10:00:00.000Z"),
  observationPeriodStatus: "NOT_PROVIDED",
  observationPeriodStart: null,
  observationPeriodEnd: null,
  geographyCode: "ID",
  metricsAvailability: "PARTIAL",
  metrics: [
    { name: "volume", availability: "AVAILABLE", value: 1200, semanticAvailability: "UNKNOWN", semantic: null, unitAvailability: "UNKNOWN", unit: null },
    { name: "volume_change", availability: "UNAVAILABLE", value: null, semanticAvailability: "UNKNOWN", semantic: null, unitAvailability: "UNKNOWN", unit: null },
  ],
  completeness: "PARTIAL",
});

describe("Trend evidence provenance metadata contract", () => {
  it("keeps publisher, intermediary, retrieval time, observation period, and metric meaning distinct", () => {
    const parsed = parseTrendEvidenceProvenanceInput(trendsProvenance());
    expect(parsed).toMatchObject({
      originalPublisher: "GOOGLE",
      transportProvider: "BRIGHTDATA_SERP_API",
      retrievedAt: new Date("2025-10-20T10:00:00.000Z"),
      observationPeriodStatus: "NOT_PROVIDED",
      observationPeriodStart: null,
      observationPeriodEnd: null,
      metricsAvailability: "PARTIAL",
    });
    expect(parsed.metrics[0]).toMatchObject({ value: 1200, semanticAvailability: "UNKNOWN", semantic: null, unitAvailability: "UNKNOWN", unit: null });
  });

  it("keeps Year in Search source metadata explicit when transport and retrieval are unknown", () => {
    const parsed = parseTrendEvidenceProvenanceInput({
      ...trendsProvenance(),
      sourceId: "google_year_in_search_indonesia_2025",
      sourceProduct: "GOOGLE_YEAR_IN_SEARCH_2025",
      transportProvider: "UNKNOWN",
      collectionTargetUrl: null,
      retrievedAt: null,
      observationPeriodStatus: "KNOWN",
      observationPeriodStart: "2025-01-01",
      observationPeriodEnd: "2025-11-25",
      metricsAvailability: "AVAILABLE",
      metrics: [{ name: "rank", availability: "AVAILABLE", value: 1, semanticAvailability: "UNKNOWN", semantic: null, unitAvailability: "UNKNOWN", unit: null }],
      completeness: "COMPLETE",
    });
    expect(parsed.sourceId).toBe("google_year_in_search_indonesia_2025");
    expect(parsed.retrievedAt).toBeNull();
    expect(parsed.observationPeriodStart).toBe("2025-01-01");
  });

  it.each([
    ["unsupported schema version", { schemaVersion: 2 }],
    ["unapproved source", { sourceId: "another-provider" }],
    ["mismatched publisher", { originalPublisher: "BRIGHTDATA" }],
    ["mismatched source product", { sourceProduct: "GOOGLE_YEAR_IN_SEARCH_2025" }],
    ["non-HTTPS collection URL", { collectionTargetUrl: "http://trends.google.com/trending?geo=ID&hl=id&brd_json=1" }],
    ["target URL with credentials", { collectionTargetUrl: "https://user:pass@trends.google.com/trending?geo=ID&hl=id&brd_json=1" }],
    ["period status without boundaries", { observationPeriodStatus: "KNOWN" }],
    ["period start after end", { observationPeriodStatus: "KNOWN", observationPeriodStart: "2025-12-01", observationPeriodEnd: "2025-11-25" }],
    ["retrieval timestamp misrepresented as period", { observationPeriodStatus: "KNOWN", observationPeriodStart: null, observationPeriodEnd: null }],
    ["metric value invented for unavailable field", { metrics: [{ name: "volume", availability: "UNAVAILABLE", value: 1200, semanticAvailability: "UNKNOWN", semantic: null, unitAvailability: "UNKNOWN", unit: null }, trendsProvenance().metrics[1]] }],
    ["unapproved metric field", { metrics: [{ ...trendsProvenance().metrics[0], name: "query" }] }],
    ["extra raw provider field", { rawResponse: { query: "synthetic" } }],
  ] as const)("rejects %s", (_name, changes) => {
    expect(trendEvidenceProvenanceInputSchema.safeParse({ ...trendsProvenance(), ...changes }).success).toBe(false);
  });

  it("rejects duplicate metrics and oversized metric metadata", () => {
    const sample = trendsProvenance();
    expect(trendEvidenceProvenanceInputSchema.safeParse({
      ...sample,
      metrics: [sample.metrics[0]!, sample.metrics[0]!],
    }).success).toBe(false);
    expect(trendEvidenceProvenanceInputSchema.safeParse({
      ...sample,
      metrics: [{ ...sample.metrics[0]!, semanticAvailability: "KNOWN", semantic: "x".repeat(81) }],
    }).success).toBe(false);
  });
});
