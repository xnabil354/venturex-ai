import { describe, expect, it } from "vitest";

import type {
  BusinessFitProfileInput,
  EntrepreneurFitProfileInput,
  OpportunityFitInputContext,
} from "../opportunity/fit-input-context";
import { extractFitSignals } from "./fit-signals";

const opportunity: OpportunityFitInputContext["opportunity"] = {
  id: "opportunity-1",
  fnbCategoryId: "category-1",
  relatedTrend: { id: "trend-1", lifecycleState: "PUBLISHED", affectedUserTypes: ["ENTREPRENEUR", "UMKM_EXISTING"] },
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
  customerSegmentIds: ["segment-1", "segment-2"],
  salesChannelIds: ["channel-1"],
};

const entrepreneurProfile: EntrepreneurFitProfileInput = {
  profileVersion: 1,
  locationText: "Jakarta",
  city: "Jakarta",
  province: "DKI Jakarta",
  budgetMin: 50,
  budgetMax: 100,
  preferredProductType: null,
  experienceLevel: "BEGINNER",
  timeCommitment: "PART_TIME",
  interestCategoryIds: ["category-1", "category-2"],
  customerSegmentIds: ["segment-2"],
  salesChannelIds: ["channel-1"],
};

const businessProfile: BusinessFitProfileInput = {
  profileVersion: 2,
  businessCategoryId: "business-category-1",
  locationText: "Bandung",
  city: "Bandung",
  province: "Jawa Barat",
  averagePriceMin: 20,
  averagePriceMax: 30,
  businessDescription: null,
  operationModel: null,
  products: [{ fnbCategoryId: "category-1", price: 25 }],
  customerSegmentIds: ["segment-1"],
  salesChannelIds: ["channel-2"],
};

function entrepreneurContext(
  profile: EntrepreneurFitProfileInput | null = entrepreneurProfile,
  opportunityOverrides: Partial<OpportunityFitInputContext["opportunity"]> = {},
): OpportunityFitInputContext {
  return { userType: "ENTREPRENEUR", profile, opportunity: { ...opportunity, ...opportunityOverrides } };
}

function businessContext(
  profile: BusinessFitProfileInput | null = businessProfile,
  opportunityOverrides: Partial<OpportunityFitInputContext["opportunity"]> = {},
): OpportunityFitInputContext {
  return { userType: "UMKM_EXISTING", profile, opportunity: { ...opportunity, ...opportunityOverrides } };
}

function signal(context: OpportunityFitInputContext, component: string) {
  return extractFitSignals(context).signals.find((item) => item.component === component);
}

describe("extractFitSignals", () => {
  it("extracts explainable factual signals for Entrepreneur without producing a score", () => {
    const result = extractFitSignals(entrepreneurContext());

    expect(result.modelType).toBe("ENTREPRENEUR_FIT");
    expect(result).not.toHaveProperty("score");
    expect(signal(entrepreneurContext(), "budgetAffordability")).toMatchObject({
      status: "OBSERVED",
      relation: "BUDGET_SUFFICIENT",
      reason: "BUDGET_AFFORDABILITY_COMPARISON",
      budgetMax: "100",
      capitalMin: "100",
    });
    expect(signal(entrepreneurContext(), "category")).toMatchObject({
      status: "OBSERVED",
      relation: "SET_INTERSECTION",
      matchingReferenceIds: ["category-1"],
    });
    expect(signal(entrepreneurContext(), "experienceLevel")).toMatchObject({ relation: "EQUAL" });
    expect(signal(entrepreneurContext(), "timeCommitment")).toMatchObject({ relation: "EQUAL" });
    expect(signal(entrepreneurContext(), "location")).toMatchObject({
      status: "NOT_ASSESSED",
      reason: "NO_COMPARISON_CONTRACT",
    });
  });

  it("extracts price, product category, customer segment and channel signals for UMKM", () => {
    const result = extractFitSignals(businessContext());

    expect(result.modelType).toBe("BUSINESS_FIT");
    expect(signal(businessContext(), "priceRange")).toMatchObject({ relation: "OVERLAP" });
    expect(signal(businessContext(), "category")).toMatchObject({
      relation: "SET_INTERSECTION",
      matchingReferenceIds: ["category-1"],
    });
    expect(signal(businessContext(), "customerSegments")).toMatchObject({
      relation: "SET_INTERSECTION",
      matchingReferenceIds: ["segment-1"],
    });
    expect(signal(businessContext(), "salesChannels")).toMatchObject({ relation: "NO_SET_INTERSECTION" });
    expect(signal(businessContext(), "product")).toMatchObject({ status: "NOT_ASSESSED" });
    expect(signal(businessContext(), "experienceLevel")).toMatchObject({ status: "NOT_ASSESSED" });
  });

  it("uses inclusive affordability and does not penalize budget above the capital minimum", () => {
    expect(signal(
      entrepreneurContext(entrepreneurProfile, {
        requirements: { ...opportunity.requirements!, capitalMin: "100", capitalMax: "150" },
      }),
      "budgetAffordability",
    )).toMatchObject({ relation: "BUDGET_SUFFICIENT" });

    expect(signal(
      entrepreneurContext(entrepreneurProfile, {
        requirements: { ...opportunity.requirements!, capitalMin: "101", capitalMax: "150" },
      }),
      "budgetAffordability",
    )).toMatchObject({ relation: "BUDGET_INSUFFICIENT" });

    expect(signal(
      entrepreneurContext({ ...entrepreneurProfile, budgetMax: 500 }, {
        requirements: { ...opportunity.requirements!, capitalMin: "100", capitalMax: "200" },
      }),
      "budgetAffordability",
    )).toMatchObject({ relation: "BUDGET_SUFFICIENT" });
  });

  it("keeps price range overlap inclusive at a shared endpoint", () => {
    expect(signal(businessContext({
      ...businessProfile,
      averagePriceMin: 20,
      averagePriceMax: 30,
    }, {
      requirements: { ...opportunity.requirements!, expectedPriceMin: "10", expectedPriceMax: "20" },
    }), "priceRange")).toMatchObject({ relation: "OVERLAP" });
  });

  it("reports literal difference and reference set intersection independent of input order", () => {
    const profile = { ...entrepreneurProfile, experienceLevel: "ADVANCED", customerSegmentIds: ["segment-2", "segment-1"] };
    expect(signal(entrepreneurContext(profile), "experienceLevel")).toMatchObject({ relation: "DIFFERENT" });
    expect(signal(entrepreneurContext(profile), "customerSegments")).toMatchObject({
      relation: "SET_INTERSECTION",
      matchingReferenceIds: ["segment-1", "segment-2"],
    });
  });

  it("does not treat missing profile, reference selections, or incomplete ranges as mismatches", () => {
    expect(signal(entrepreneurContext(null), "budgetAffordability")).toMatchObject({
      status: "INSUFFICIENT_DATA",
      relation: "UNDETERMINED",
      reason: "REQUIRED_INPUT_MISSING",
    });
    expect(signal(entrepreneurContext({ ...entrepreneurProfile, customerSegmentIds: [] }), "customerSegments"))
      .toMatchObject({ status: "INSUFFICIENT_DATA", relation: "UNDETERMINED" });
    expect(signal(entrepreneurContext(entrepreneurProfile, {
      requirements: { ...opportunity.requirements!, capitalMin: null },
    }), "budgetAffordability")).toMatchObject({
      status: "INSUFFICIENT_DATA",
      missingFields: ["opportunity.requirements.capitalMin"],
    });
    expect(signal(
      entrepreneurContext({ ...entrepreneurProfile, budgetMax: null } as unknown as EntrepreneurFitProfileInput),
      "budgetAffordability",
    )).toMatchObject({
      status: "INSUFFICIENT_DATA",
      missingFields: ["profile.budgetMax"],
    });
    expect(signal(businessContext({ ...businessProfile, products: [{ fnbCategoryId: null, price: 10 }] }), "category"))
      .toMatchObject({ status: "INSUFFICIENT_DATA", relation: "UNDETERMINED" });
  });

  it("returns deterministic signal ordering and values", () => {
    const context = entrepreneurContext({
      ...entrepreneurProfile,
      interestCategoryIds: ["category-2", "category-1", "category-1"],
      customerSegmentIds: ["segment-2", "segment-1"],
    });
    const first = extractFitSignals(context);
    const second = extractFitSignals(context);

    expect(first).toEqual(second);
    expect(first.signals.map(({ component }) => component)).toEqual([
      "budgetAffordability", "priceRange", "category", "customerSegments", "salesChannels",
      "experienceLevel", "timeCommitment", "location", "product", "operationalFit", "brandFit",
    ]);
    expect(signal(context, "category")).toMatchObject({
      profileReferenceIds: ["category-1", "category-2"],
      matchingReferenceIds: ["category-1"],
    });
  });

  it("marks invalid persisted ranges as insufficient instead of asserting a relation", () => {
    expect(signal(
      entrepreneurContext({ ...entrepreneurProfile, budgetMax: Number.MAX_SAFE_INTEGER + 1 }),
      "budgetAffordability",
    )).toMatchObject({ status: "INSUFFICIENT_DATA", reason: "INVALID_INPUT_VALUE" });
  });
});
