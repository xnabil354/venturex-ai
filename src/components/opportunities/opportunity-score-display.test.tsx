import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  OPPORTUNITY_SCORE_COMPONENTS,
} from "@/scoring/opportunity-score";
import type {
  OpportunityScoreDisplayState,
  OpportunityScoreServiceResult,
} from "@/scoring/opportunity-score-service";
import { OpportunityScoreDisplay } from "./opportunity-score-display";

const sources: Extract<OpportunityScoreServiceResult, { readonly status: "INSUFFICIENT_DATA" }> ["sources"] = Object.fromEntries(OPPORTUNITY_SCORE_COMPONENTS.map((component) => [component, {
  status: component === "executionFeasibility" || component === "marketSustainability"
    ? "AVAILABLE"
    : "UNAVAILABLE",
  source: `Sumber ${component}`,
  explanation: component === "competition" ? "Data hanya kualitatif." : `Keterangan ${component}`,
}])) as Extract<OpportunityScoreServiceResult, { readonly status: "INSUFFICIENT_DATA" }> ["sources"];

const insufficientResult: OpportunityScoreDisplayState = {
  status: "INSUFFICIENT_DATA",
  modelType: "OPPORTUNITY_SCORE",
  modelVersion: "synthetic-v1",
  score: null,
  breakdown: OPPORTUNITY_SCORE_COMPONENTS.map((component) => ({
    component,
    normalizedValue: null,
    weight: null,
    weightedContribution: null,
  })),
  missingComponents: ["trendMomentum", "demandSignal", "competition", "consumerRelevance"],
  invalidComponents: [],
  reason: "COMPONENTS_UNAVAILABLE",
  sources,
  disclaimer: "Opportunity Score bukan jaminan keberhasilan bisnis.",
};

const availableResult: OpportunityScoreDisplayState = {
  status: "AVAILABLE",
  modelType: "OPPORTUNITY_SCORE",
  modelVersion: "approved-v2",
  score: 75.25,
  unroundedScore: 75.25,
  breakdown: OPPORTUNITY_SCORE_COMPONENTS.map((component) => ({
    component,
    normalizedValue: 75,
    weight: 1 / 6,
    weightedContribution: 12.5,
  })),
  policy: {
    modelType: "OPPORTUNITY_SCORE",
    version: "approved-v2",
    weights: Object.fromEntries(OPPORTUNITY_SCORE_COMPONENTS.map((component) => [component, 1 / 6])) as never,
    normalization: "PRE_NORMALIZED_0_TO_100",
    rounding: { mode: "HALF_UP", decimalPlaces: 2 },
  },
  sources: Object.fromEntries(OPPORTUNITY_SCORE_COMPONENTS.map((component) => [component, {
    status: "AVAILABLE",
    source: `Sumber ${component}`,
    explanation: "Nilai numerik terverifikasi untuk fixture sintetis.",
  }])) as Extract<OpportunityScoreServiceResult, { readonly status: "AVAILABLE" }> ["sources"],
  disclaimer: "Opportunity Score bukan jaminan keberhasilan bisnis.",
};

function render(result: OpportunityScoreDisplayState, compact = false): string {
  return renderToStaticMarkup(<OpportunityScoreDisplay compact={compact} result={result} />)
    .replace(/\s+/gu, " ");
}

describe("OpportunityScoreDisplay", () => {
  it("shows the required insufficient-data copy and safe input limitations", () => {
    const markup = render(insufficientResult);

    expect(markup).toContain("Data belum cukup untuk menghitung skor secara layak.");
    expect(markup).toContain("Trend Momentum");
    expect(markup).toContain("Demand Signal");
    expect(markup).toContain("kualitatif");
    expect(markup).toContain("Opportunity Score bukan jaminan keberhasilan bisnis.");
    expect(markup).not.toMatch(/>\s*(?:0|50|82)\s*<\/p>/u);
  });

  it("shows an available score, model version, approved weights, all components and sources", () => {
    const markup = render(availableResult);

    expect(markup).toContain("75,25");
    expect(markup).not.toContain("MVP scoring model");
    expect(markup).not.toContain("approved-v2");
    expect(markup).toContain("bukan probabilitas keberhasilan");
    expect(markup).toContain("Bobot yang disetujui");
    expect(markup).toContain("16,67%");
    for (const component of OPPORTUNITY_SCORE_COMPONENTS) {
      expect(markup).toContain(component);
      expect(markup).toContain(`Sumber ${component}`);
    }
  });

  it("keeps the Finder presentation compact and distinguishes service errors", () => {
    const compact = render(availableResult, true);
    const error = render({ status: "ERROR" });

    expect(compact).toContain("75,25");
    expect(compact).not.toContain("Bobot yang disetujui");
    expect(error).toContain("Opportunity Score sementara tidak dapat dimuat.");
    expect(error).not.toContain("database");
  });
});
