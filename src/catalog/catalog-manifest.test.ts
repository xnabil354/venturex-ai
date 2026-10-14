import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseCuratedCatalogManifest } from "./catalog-manifest";

const sourceManifest = JSON.parse(readFileSync(
  path.join(process.cwd(), "data/catalog/curated-fnb-2025-candidates.v1.json"),
  "utf8",
)) as unknown;

describe("curated catalog manifest", () => {
  it("validates traceable historical source facts and four linked business hypotheses", () => {
    const manifest = parseCuratedCatalogManifest(sourceManifest);

    expect(manifest.trends).toHaveLength(2);
    expect(manifest.opportunities).toHaveLength(4);
    expect(manifest.trends.every((trend) => trend.evidence.length >= 2)).toBe(true);
    expect(manifest.opportunities.every((opportunity) => opportunity.hypothesisLabel === "BUSINESS_HYPOTHESIS")).toBe(true);
    expect(manifest.opportunities.filter((opportunity) => opportunity.fnbCategoryCode === "BEVERAGES")).toHaveLength(2);
    expect(manifest.trends.every((trend) => trend.affectedUserTypes.includes("ENTREPRENEUR"))).toBe(true);
    expect(manifest.trends.every((trend) => trend.affectedUserTypes.includes("UMKM_EXISTING"))).toBe(true);
  });

  it("requires dated, limited, HTTPS evidence and rejects fabricated source dates", () => {
    const invalid = structuredClone(sourceManifest) as {
      trends: Array<{ evidence: Array<Record<string, unknown>> }>;
    };
    invalid.trends[0]!.evidence[0]!.sourceDate = "2025-12-01T00:00:00.000Z";

    expect(() => parseCuratedCatalogManifest(invalid)).toThrow();
  });

  it("keeps both signal periods within the methodology's documented 2025 window", () => {
    const invalid = structuredClone(sourceManifest) as {
      trends: Array<{ signal: { periodStart: string } }>;
    };
    invalid.trends[0]!.signal.periodStart = "2026-01-01";

    expect(() => parseCuratedCatalogManifest(invalid)).toThrow();
  });

  it("requires the official Year in Search list and methodology on every Trend", () => {
    const invalid = structuredClone(sourceManifest) as {
      trends: Array<{ evidence: Array<{ sourceReference: string }> }>;
    };
    invalid.trends[0]!.evidence[0]!.sourceReference = "https://example.com/source";

    expect(() => parseCuratedCatalogManifest(invalid)).toThrow(/official Google Trends domain|must cite the official/);
  });

  it("rejects unsupported score, financial, and fit fields instead of silently accepting them", () => {
    const invalid = structuredClone(sourceManifest) as {
      opportunities: Array<Record<string, unknown>>;
    };
    invalid.opportunities[0]!.executionFeasibility = 81;
    invalid.opportunities[0]!.estimatedRevenue = 100000;

    expect(() => parseCuratedCatalogManifest(invalid)).toThrow();
  });

  it("requires each proposal to link to an included Trend and match its proposed subject area", () => {
    const invalid = structuredClone(sourceManifest) as {
      opportunities: Array<Record<string, unknown>>;
    };
    invalid.opportunities[0]!.relatedTrendId = "b1200000-2025-5500-8000-000000009999";

    expect(() => parseCuratedCatalogManifest(invalid)).toThrow(/outside this manifest/);
  });

  it("keeps source review and Opportunity approval pending", () => {
    const invalid = structuredClone(sourceManifest) as {
      status: string;
      opportunities: Array<Record<string, unknown>>;
    };
    invalid.status = "APPROVED";
    invalid.opportunities[0]!.productOwnerReview = "APPROVED";

    expect(() => parseCuratedCatalogManifest(invalid)).toThrow();
  });

  it("requires both account types on each Trend because audience eligibility is Trend-level", () => {
    const invalid = structuredClone(sourceManifest) as {
      trends: Array<{ affectedUserTypes: string[] }>;
    };
    invalid.trends[0]!.affectedUserTypes = ["ENTREPRENEUR"];

    expect(() => parseCuratedCatalogManifest(invalid)).toThrow(/Each proposed Trend must include/);
  });
});
