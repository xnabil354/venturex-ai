import { describe, expect, it } from "vitest";

import {
  BUSINESS_FIT_COMPONENTS,
  ENTREPRENEUR_FIT_COMPONENTS,
  FitScoreInputError,
  calculateFitScore,
  type FitScoreCalculationInput,
} from "./fit-score";

function input(overrides: Partial<FitScoreCalculationInput> = {}): FitScoreCalculationInput {
  return {
    userType: "ENTREPRENEUR",
    configuration: {
      modelType: "ENTREPRENEUR_FIT",
      weights: { budgetFit: 0.25, interestFit: 0.75 },
    },
    normalizedComponents: { budgetFit: 80, interestFit: 60 },
    ...overrides,
  };
}

describe("calculateFitScore", () => {
  it("calculates explicit Entrepreneur weights and returns a traceable breakdown", () => {
    const result = calculateFitScore(input());

    expect(result).toEqual({
      status: "AVAILABLE",
      modelType: "ENTREPRENEUR_FIT",
      score: 65,
      breakdown: [
        { component: "budgetFit", weight: 0.25, normalizedValue: 80, weightedContribution: 20 },
        { component: "interestFit", weight: 0.75, normalizedValue: 60, weightedContribution: 45 },
      ],
      missingComponents: [],
    });
  });

  it("uses the distinct Business Fit component set with the supplied configuration", () => {
    const result = calculateFitScore(input({
      userType: "UMKM_EXISTING",
      configuration: {
        modelType: "BUSINESS_FIT",
        weights: { productFit: 0.4, customerFit: 0.6 },
      },
      normalizedComponents: { productFit: 75, customerFit: 90 },
    }));

    expect(result.status).toBe("AVAILABLE");
    expect(result.modelType).toBe("BUSINESS_FIT");
    expect(result.score).toBe(84);
    expect(result.breakdown.map(({ component }) => component)).toEqual(["productFit", "customerFit"]);
    expect(ENTREPRENEUR_FIT_COMPONENTS).toEqual([
      "budgetFit", "interestFit", "locationFit", "experienceFit", "channelFit", "timeFit",
    ]);
    expect(BUSINESS_FIT_COMPONENTS).toEqual([
      "productFit", "customerFit", "priceFit", "channelFit", "operationalFit", "brandFit",
    ]);
  });

  it.each([
    ["negative weight", { budgetFit: -0.1, interestFit: 1.1 }],
    ["weights not summing to one", { budgetFit: 0.4, interestFit: 0.5 }],
    ["non-finite weight", { budgetFit: Number.NaN, interestFit: 1 }],
    ["weight for the wrong model", { productFit: 1 }],
    ["empty weight map", {}],
  ])("rejects %s with a controlled weight error", (_label, weights) => {
    expect(() => calculateFitScore(input({
      configuration: { modelType: "ENTREPRENEUR_FIT", weights },
    }))).toThrow(FitScoreInputError);
    expect(() => calculateFitScore(input({
      configuration: { modelType: "ENTREPRENEUR_FIT", weights },
    }))).toThrow(expect.objectContaining({ code: "INVALID_WEIGHTS" }));
  });

  it.each([-0.01, 100.01, Number.NaN, Number.POSITIVE_INFINITY, "50"])(
    "rejects invalid normalized values: %s",
    (value) => {
      expect(() => calculateFitScore(input({
        normalizedComponents: { budgetFit: value as number, interestFit: 60 },
      }))).toThrow(expect.objectContaining({ code: "INVALID_COMPONENTS" }));
    },
  );

  it("returns INSUFFICIENT_DATA for unavailable configuration and missing weighted components", () => {
    expect(calculateFitScore(input({ configuration: null }))).toMatchObject({
      status: "INSUFFICIENT_DATA",
      modelType: "ENTREPRENEUR_FIT",
      score: null,
      reason: "CONFIGURATION_UNAVAILABLE",
    });

    expect(calculateFitScore(input({
      normalizedComponents: { budgetFit: 80, interestFit: null },
    }))).toMatchObject({
      status: "INSUFFICIENT_DATA",
      score: null,
      missingComponents: ["interestFit"],
      reason: "COMPONENTS_UNAVAILABLE",
      breakdown: [
        { component: "budgetFit", weightedContribution: 20 },
        { component: "interestFit", normalizedValue: null, weightedContribution: null },
      ],
    });
  });

  it.each([
    ["Entrepreneur", "ENTREPRENEUR", "BUSINESS_FIT"],
    ["Business", "UMKM_EXISTING", "ENTREPRENEUR_FIT"],
  ] as const)("rejects a %s model mismatch", (_label, userType, modelType) => {
    expect(() => calculateFitScore(input({
      userType,
      configuration: { modelType, weights: { budgetFit: 0.25, interestFit: 0.75 } },
    }))).toThrow(expect.objectContaining({ code: "MODEL_TYPE_MISMATCH" }));
  });

  it("is deterministic regardless of input property order and preserves floating precision", () => {
    const configuration = {
      modelType: "ENTREPRENEUR_FIT" as const,
      weights: { interestFit: 0.7, budgetFit: 0.3 },
    };
    const first = calculateFitScore(input({
      configuration,
      normalizedComponents: { interestFit: 33, budgetFit: 10 },
    }));
    const second = calculateFitScore(input({
      configuration: {
        modelType: "ENTREPRENEUR_FIT",
        weights: { budgetFit: 0.3, interestFit: 0.7 },
      },
      normalizedComponents: { budgetFit: 10, interestFit: 33 },
    }));

    expect(first).toEqual(second);
    expect(first.score).toBe(33 * 0.7 + 10 * 0.3);
    expect(first.score).not.toBe(26.1);
    expect(first.breakdown.reduce(
      (sum, item) => sum + (item.weightedContribution ?? 0),
      0,
    )).toBe(first.score);
  });
});
