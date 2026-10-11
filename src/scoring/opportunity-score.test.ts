import { describe, expect, it } from "vitest";

import {
  calculateOpportunityScore,
  OPPORTUNITY_SCORE_COMPONENTS,
  OpportunityScoreInputError,
  type NormalizedOpportunityScoreComponents,
  type OpportunityScorePolicy,
} from "./opportunity-score";

const policy: OpportunityScorePolicy = {
  modelType: "OPPORTUNITY_SCORE",
  version: "synthetic-v1",
  weights: {
    trendMomentum: 0.1,
    demandSignal: 0.2,
    competition: 0.15,
    consumerRelevance: 0.15,
    executionFeasibility: 0.2,
    marketSustainability: 0.2,
  },
  normalization: "PRE_NORMALIZED_0_TO_100",
  rounding: { mode: "HALF_UP", decimalPlaces: 2 },
};

const completeComponents: NormalizedOpportunityScoreComponents = {
  trendMomentum: 0,
  demandSignal: 25,
  competition: 50,
  consumerRelevance: 75,
  executionFeasibility: 100,
  marketSustainability: 50,
};

describe("calculateOpportunityScore", () => {
  it("calculates a deterministic 0–100 score with a reconstructable breakdown", () => {
    const first = calculateOpportunityScore({ policy, normalizedComponents: completeComponents });
    const second = calculateOpportunityScore({ policy, normalizedComponents: completeComponents });

    expect(first.status).toBe("AVAILABLE");
    if (first.status !== "AVAILABLE") throw new Error("Expected an available score.");
    expect(first.score).toBe(53.75);
    expect(first.unroundedScore).toBe(53.75);
    expect(first).toEqual(second);
    expect(first.breakdown).toHaveLength(6);
    expect(first.breakdown.map(({ component }) => component)).toEqual(OPPORTUNITY_SCORE_COMPONENTS);
    expect(first.breakdown.map(({ weightedContribution }) => weightedContribution)).toEqual([
      0, 5, 7.5, 11.25, 20, 10,
    ]);
    expect(first.breakdown.reduce((sum, item) => sum + (item.weightedContribution ?? 0), 0))
      .toBe(first.unroundedScore);
    expect(first.disclaimer).toContain("bukan jaminan keberhasilan bisnis");
  });

  it.each([
    ["all zero", 0],
    ["all one hundred", 100],
  ])("keeps the %s boundary within range", (_label, value) => {
    const components = Object.fromEntries(
      OPPORTUNITY_SCORE_COMPONENTS.map((component) => [component, value]),
    ) as NormalizedOpportunityScoreComponents;
    const result = calculateOpportunityScore({ policy, normalizedComponents: components });

    expect(result.status).toBe("AVAILABLE");
    if (result.status === "AVAILABLE") expect(result.score).toBe(value);
  });

  it("uses the explicitly configured HALF_UP precision", () => {
    const roundingPolicy = {
      ...policy,
      weights: Object.fromEntries(OPPORTUNITY_SCORE_COMPONENTS.map((component) => [component, 1 / 6])) as OpportunityScorePolicy["weights"],
    };
    const components = Object.fromEntries(
      OPPORTUNITY_SCORE_COMPONENTS.map((component) => [component, 50.125]),
    ) as NormalizedOpportunityScoreComponents;

    const result = calculateOpportunityScore({ policy: roundingPolicy, normalizedComponents: components });
    expect(result.status).toBe("AVAILABLE");
    if (result.status === "AVAILABLE") {
      expect(result.score).toBe(50.13);
      expect(result.unroundedScore).toBeCloseTo(50.125, 12);
    }
  });

  it.each([
    [50.125, 50.12],
    [50.135, 50.14],
  ])("uses explicit HALF_EVEN rounding for %s", (value, expected) => {
    const roundingPolicy: OpportunityScorePolicy = {
      ...policy,
      weights: Object.fromEntries(OPPORTUNITY_SCORE_COMPONENTS.map((component) => [component, 1 / 6])) as OpportunityScorePolicy["weights"],
      rounding: { mode: "HALF_EVEN", decimalPlaces: 2 },
    };
    const components = Object.fromEntries(
      OPPORTUNITY_SCORE_COMPONENTS.map((component) => [component, value]),
    ) as NormalizedOpportunityScoreComponents;

    const result = calculateOpportunityScore({ policy: roundingPolicy, normalizedComponents: components });
    expect(result.status).toBe("AVAILABLE");
    if (result.status === "AVAILABLE") expect(result.score).toBe(expected);
  });

  it("returns insufficient data without filling a missing component", () => {
    const result = calculateOpportunityScore({
      policy,
      normalizedComponents: { ...completeComponents, demandSignal: null },
    });

    expect(result).toMatchObject({
      status: "INSUFFICIENT_DATA",
      score: null,
      reason: "COMPONENTS_UNAVAILABLE",
      missingComponents: ["demandSignal"],
    });
    expect(result.breakdown.find(({ component }) => component === "demandSignal"))
      .toMatchObject({ normalizedValue: null, weightedContribution: null });
  });

  it("returns insufficient data when configuration is absent", () => {
    const result = calculateOpportunityScore({ policy: null, normalizedComponents: completeComponents });

    expect(result).toMatchObject({
      status: "INSUFFICIENT_DATA",
      score: null,
      reason: "CONFIGURATION_UNAVAILABLE",
      missingComponents: OPPORTUNITY_SCORE_COMPONENTS,
    });
    expect(result.breakdown.every(({ weight, weightedContribution }) => weight === null && weightedContribution === null))
      .toBe(true);
  });

  it.each([
    ["weights below 1", { ...policy.weights, marketSustainability: 0.1 }],
    ["negative weight", { ...policy.weights, demandSignal: -0.1 }],
    ["non-finite weight", { ...policy.weights, demandSignal: Number.NaN }],
    ["missing weight", Object.fromEntries(Object.entries(policy.weights).slice(1))],
    ["unknown weight", { ...policy.weights, other: 0 }],
  ])("rejects %s", (_label, weights) => {
    expect(() => calculateOpportunityScore({
      policy: { ...policy, weights } as OpportunityScorePolicy,
      normalizedComponents: completeComponents,
    })).toThrow(OpportunityScoreInputError);
  });

  it.each([
    ["below range", -0.01],
    ["above range", 100.01],
    ["non-finite", Number.POSITIVE_INFINITY],
    ["numeric string", "40"],
  ])("rejects a component value %s", (_label, value) => {
    expect(() => calculateOpportunityScore({
      policy,
      normalizedComponents: { ...completeComponents, competition: value } as NormalizedOpportunityScoreComponents,
    })).toThrow(OpportunityScoreInputError);
  });

  it("rejects incomplete or unsupported normalization and rounding policies", () => {
    expect(() => calculateOpportunityScore({
      policy: { ...policy, normalization: undefined } as unknown as OpportunityScorePolicy,
      normalizedComponents: completeComponents,
    })).toThrow(OpportunityScoreInputError);
    expect(() => calculateOpportunityScore({
      policy: { ...policy, rounding: { mode: "HALF_UP", decimalPlaces: 7 } } as OpportunityScorePolicy,
      normalizedComponents: completeComponents,
    })).toThrow(OpportunityScoreInputError);
    expect(() => calculateOpportunityScore({
      policy: { ...policy, rounding: { mode: "HALF_DOWN", decimalPlaces: 2 } } as unknown as OpportunityScorePolicy,
      normalizedComponents: completeComponents,
    })).toThrow(OpportunityScoreInputError);
  });
});
