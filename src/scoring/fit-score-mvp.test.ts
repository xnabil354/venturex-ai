import { describe, expect, it } from "vitest";

import type {
  BusinessFitProfileInput,
  EntrepreneurFitProfileInput,
  OpportunityFitInputContext,
} from "../opportunity/fit-input-context";
import {
  calculateFitScoreMvp,
  FIT_SCORE_MVP_DISCLAIMER,
  FIT_SCORE_MVP_HEURISTIC_V1,
  FIT_SCORE_MVP_LABEL,
  FIT_SCORE_MVP_POLICY_VERSION,
  FitScoreMvpError,
  roundFitScoreToTwoDecimals,
} from "./fit-score-mvp";

// All records in this file are synthetic unit-test fixtures, not user or market data.
const syntheticOpportunity: OpportunityFitInputContext["opportunity"] = {
  id: "synthetic-opportunity",
  fnbCategoryId: "synthetic-category",
  relatedTrend: {
    id: "synthetic-trend",
    lifecycleState: "PUBLISHED",
    affectedUserTypes: ["ENTREPRENEUR", "UMKM_EXISTING"],
  },
  requirements: {
    capitalMin: "100",
    capitalMax: "200",
    expectedPriceMin: "10",
    expectedPriceMax: "20",
    requiredExperienceLevel: "BEGINNER",
    requiredTimeCommitment: "PART_TIME",
    operationalComplexity: null,
    locationScope: null,
    metadata: {},
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  customerSegmentIds: ["synthetic-segment"],
  salesChannelIds: ["synthetic-channel"],
};

const syntheticEntrepreneurProfile: EntrepreneurFitProfileInput = {
  profileVersion: 1,
  locationText: "Synthetic City",
  city: "Synthetic City",
  province: "Synthetic Province",
  budgetMin: 25,
  budgetMax: 150,
  preferredProductType: null,
  experienceLevel: "BEGINNER",
  timeCommitment: "PART_TIME",
  interestCategoryIds: ["synthetic-category"],
  customerSegmentIds: ["synthetic-segment"],
  salesChannelIds: ["synthetic-channel"],
};

const syntheticBusinessProfile: BusinessFitProfileInput = {
  profileVersion: 2,
  businessCategoryId: "synthetic-business-category",
  locationText: "Synthetic City",
  city: "Synthetic City",
  province: "Synthetic Province",
  averagePriceMin: 20,
  averagePriceMax: 30,
  businessDescription: "Synthetic fixture description",
  operationModel: null,
  products: [{ fnbCategoryId: "synthetic-category", price: 25 }],
  customerSegmentIds: ["synthetic-segment"],
  salesChannelIds: ["synthetic-channel"],
};

function entrepreneurContext(
  profile: EntrepreneurFitProfileInput | null = syntheticEntrepreneurProfile,
  opportunityOverrides: Partial<OpportunityFitInputContext["opportunity"]> = {},
): OpportunityFitInputContext {
  return {
    userType: "ENTREPRENEUR",
    profile,
    opportunity: { ...syntheticOpportunity, ...opportunityOverrides },
  };
}

function businessContext(
  profile: BusinessFitProfileInput | null = syntheticBusinessProfile,
  opportunityOverrides: Partial<OpportunityFitInputContext["opportunity"]> = {},
): OpportunityFitInputContext {
  return {
    userType: "UMKM_EXISTING",
    profile,
    opportunity: { ...syntheticOpportunity, ...opportunityOverrides },
  };
}

describe("calculateFitScoreMvp", () => {
  it("calculates Entrepreneur Fit with the approved weights and a traceable breakdown", () => {
    const result = calculateFitScoreMvp(entrepreneurContext(), FIT_SCORE_MVP_HEURISTIC_V1);

    expect(result).toMatchObject({
      label: FIT_SCORE_MVP_LABEL,
      policyVersion: FIT_SCORE_MVP_POLICY_VERSION,
      modelType: "ENTREPRENEUR_FIT",
      status: "AVAILABLE",
      score: 100,
      confidence: null,
      excludedComponents: ["locationFit", "experienceFit", "timeFit"],
      disclaimer: FIT_SCORE_MVP_DISCLAIMER,
      activeComponents: [
        { component: "budgetFit", normalizedValue: 100, weight: 0.4, weightedContribution: 40 },
        { component: "interestFit", normalizedValue: 100, weight: 0.3, weightedContribution: 30 },
        { component: "channelFit", normalizedValue: 100, weight: 0.3, weightedContribution: 30 },
      ],
    });
    expect(result.activeComponents[0]?.signal).toMatchObject({
      status: "NORMALIZED",
      signal: { component: "budgetAffordability", relation: "BUDGET_SUFFICIENT" },
    });
  });

  it("scores insufficient budget as zero but treats equality and excess budget as sufficient", () => {
    const insufficient = calculateFitScoreMvp(entrepreneurContext({
      ...syntheticEntrepreneurProfile,
      budgetMax: 99,
    }), FIT_SCORE_MVP_HEURISTIC_V1);
    const atBoundary = calculateFitScoreMvp(entrepreneurContext({
      ...syntheticEntrepreneurProfile,
      budgetMax: 100,
    }), FIT_SCORE_MVP_HEURISTIC_V1);
    const aboveRequirement = calculateFitScoreMvp(entrepreneurContext({
      ...syntheticEntrepreneurProfile,
      budgetMax: 500,
    }), FIT_SCORE_MVP_HEURISTIC_V1);

    expect(insufficient).toMatchObject({ status: "AVAILABLE", score: 60 });
    expect(insufficient.activeComponents[0]).toMatchObject({
      component: "budgetFit",
      normalizedValue: 0,
      weightedContribution: 0,
      signal: { status: "NORMALIZED", signal: { relation: "BUDGET_INSUFFICIENT" } },
    });
    expect(atBoundary.activeComponents[0]).toMatchObject({ normalizedValue: 100 });
    expect(aboveRequirement.activeComponents[0]).toMatchObject({ normalizedValue: 100 });
  });

  it("requires budgetMax and capitalMin only for the approved affordability signal", () => {
    const profileWithoutMin = {
      ...syntheticEntrepreneurProfile,
      budgetMin: null,
    } as unknown as EntrepreneurFitProfileInput;
    const requirementWithoutMax = {
      ...syntheticOpportunity.requirements!,
      capitalMax: null,
    };
    const result = calculateFitScoreMvp(entrepreneurContext(profileWithoutMin, {
      requirements: requirementWithoutMax,
    }), FIT_SCORE_MVP_HEURISTIC_V1);

    expect(result).toMatchObject({ status: "AVAILABLE", score: 100 });
  });

  it.each([
    ["budgetFit", entrepreneurContext({ ...syntheticEntrepreneurProfile, budgetMax: null } as unknown as EntrepreneurFitProfileInput)],
    ["budgetFit", entrepreneurContext(syntheticEntrepreneurProfile, {
      requirements: { ...syntheticOpportunity.requirements!, capitalMin: null },
    })],
    ["interestFit", entrepreneurContext({ ...syntheticEntrepreneurProfile, interestCategoryIds: [] })],
    ["channelFit", entrepreneurContext({ ...syntheticEntrepreneurProfile, salesChannelIds: [] })],
  ] as const)("returns INSUFFICIENT_DATA when active Entrepreneur component %s is missing", (component, context) => {
    const result = calculateFitScoreMvp(context, FIT_SCORE_MVP_HEURISTIC_V1);
    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.score).toBeNull();
    expect(result.missingComponents).toContain(component);
    expect(result.confidence).toBeNull();
  });

  it("calculates UMKM Fit and labels Product Fit as a category-only proxy", () => {
    const result = calculateFitScoreMvp(businessContext(), FIT_SCORE_MVP_HEURISTIC_V1);

    expect(result).toMatchObject({
      policyVersion: FIT_SCORE_MVP_POLICY_VERSION,
      modelType: "BUSINESS_FIT",
      status: "AVAILABLE",
      score: 100,
      confidence: null,
      excludedComponents: ["operationalFit", "brandFit"],
      activeComponents: [
        { component: "productFit", normalizedValue: 100, weight: 0.25, weightedContribution: 25 },
        { component: "customerFit", normalizedValue: 100, weight: 0.25, weightedContribution: 25 },
        { component: "priceFit", normalizedValue: 100, weight: 0.3, weightedContribution: 30 },
        { component: "channelFit", normalizedValue: 100, weight: 0.2, weightedContribution: 20 },
      ],
    });
    expect(result.activeComponents[0]?.interpretation).toContain("Product Category Match proxy");
    expect(result.activeComponents[0]?.interpretation).toContain("not a full product evaluation");
  });

  it("keeps price overlap inclusive at a shared endpoint and maps disjoint price to zero", () => {
    const touching = calculateFitScoreMvp(businessContext(), FIT_SCORE_MVP_HEURISTIC_V1);
    const disjoint = calculateFitScoreMvp(businessContext(syntheticBusinessProfile, {
      requirements: {
        ...syntheticOpportunity.requirements!,
        expectedPriceMin: "31",
        expectedPriceMax: "40",
      },
    }), FIT_SCORE_MVP_HEURISTIC_V1);

    expect(touching.activeComponents.find(({ component }) => component === "priceFit"))
      .toMatchObject({ normalizedValue: 100, signal: { signal: { relation: "OVERLAP" } } });
    expect(disjoint).toMatchObject({ status: "AVAILABLE", score: 70 });
    expect(disjoint.activeComponents.find(({ component }) => component === "priceFit"))
      .toMatchObject({ normalizedValue: 0, signal: { signal: { relation: "DISJOINT" } } });
  });

  it("uses exact reference matching and maps observed non-intersection to zero", () => {
    const noMatches = calculateFitScoreMvp(businessContext({
      ...syntheticBusinessProfile,
      products: [{ fnbCategoryId: "other-category", price: 25 }],
      customerSegmentIds: ["other-segment"],
      salesChannelIds: ["other-channel"],
    }), FIT_SCORE_MVP_HEURISTIC_V1);

    expect(noMatches.status).toBe("AVAILABLE");
    expect(noMatches.activeComponents.find(({ component }) => component === "productFit"))
      .toMatchObject({ normalizedValue: 0, signal: { signal: { relation: "NO_SET_INTERSECTION" } } });
    expect(noMatches.activeComponents.find(({ component }) => component === "customerFit"))
      .toMatchObject({ normalizedValue: 0, signal: { signal: { relation: "NO_SET_INTERSECTION" } } });
    expect(noMatches.activeComponents.find(({ component }) => component === "channelFit"))
      .toMatchObject({ normalizedValue: 0, signal: { signal: { relation: "NO_SET_INTERSECTION" } } });
  });

  it.each([
    ["priceFit", businessContext({ ...syntheticBusinessProfile, averagePriceMax: null } as unknown as BusinessFitProfileInput)],
    ["priceFit", businessContext(syntheticBusinessProfile, {
      requirements: { ...syntheticOpportunity.requirements!, expectedPriceMin: null },
    })],
    ["productFit", businessContext({ ...syntheticBusinessProfile, products: [] })],
    ["customerFit", businessContext({ ...syntheticBusinessProfile, customerSegmentIds: [] })],
    ["channelFit", businessContext({ ...syntheticBusinessProfile, salesChannelIds: [] })],
    ["customerFit", businessContext(syntheticBusinessProfile, { customerSegmentIds: [] })],
    ["channelFit", businessContext(syntheticBusinessProfile, { salesChannelIds: [] })],
  ] as const)("returns INSUFFICIENT_DATA when active UMKM component %s lacks meaningful inputs", (component, context) => {
    const result = calculateFitScoreMvp(context, FIT_SCORE_MVP_HEURISTIC_V1);
    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.score).toBeNull();
    expect(result.missingComponents).toContain(component);
  });

  it("rejects omitted, altered, and wrong-model policies with controlled errors", () => {
    expect(() => calculateFitScoreMvp(entrepreneurContext(), undefined as never))
      .toThrow(expect.objectContaining({ name: "FitScoreMvpError", code: "INVALID_POLICY" }));

    const altered = structuredClone(FIT_SCORE_MVP_HEURISTIC_V1) as unknown as {
      version: string;
      models: { ENTREPRENEUR_FIT: { modelType: string; configuration: { weights: Record<string, number> } } };
    };
    altered.version = "UNAPPROVED_VERSION";
    expect(() => calculateFitScoreMvp(entrepreneurContext(), altered as never))
      .toThrow(expect.objectContaining({ code: "INVALID_POLICY" }));

    const wrongModel = structuredClone(FIT_SCORE_MVP_HEURISTIC_V1) as unknown as {
      models: { ENTREPRENEUR_FIT: { modelType: string } };
    };
    wrongModel.models.ENTREPRENEUR_FIT.modelType = "BUSINESS_FIT";
    expect(() => calculateFitScoreMvp(entrepreneurContext(), wrongModel as never))
      .toThrow(expect.objectContaining({ code: "MODEL_TYPE_MISMATCH" }));

    const alteredWeights = structuredClone(FIT_SCORE_MVP_HEURISTIC_V1) as unknown as {
      models: { ENTREPRENEUR_FIT: { configuration: { weights: Record<string, number> } } };
    };
    alteredWeights.models.ENTREPRENEUR_FIT.configuration.weights.budgetFit = 0.5;
    expect(() => calculateFitScoreMvp(entrepreneurContext(), alteredWeights as never))
      .toThrow(expect.objectContaining({ code: "INVALID_POLICY" }));
  });

  it("rounds the final value once using deterministic positive-infinity midpoint ties", () => {
    const first = roundFitScoreToTwoDecimals(10.125);
    const second = roundFitScoreToTwoDecimals(10.125);

    expect(first).toBe(10.13);
    expect(second).toBe(first);
    expect(roundFitScoreToTwoDecimals(100)).toBe(100);
    expect(() => roundFitScoreToTwoDecimals(Number.NaN)).toThrow(FitScoreMvpError);
  });

  it("returns deterministic results for identical synthetic input and explicit policy", () => {
    const context = businessContext();
    const first = calculateFitScoreMvp(context, FIT_SCORE_MVP_HEURISTIC_V1);
    const second = calculateFitScoreMvp(context, FIT_SCORE_MVP_HEURISTIC_V1);

    expect(first).toEqual(second);
  });
});
