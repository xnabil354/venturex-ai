import { describe, expect, it } from "vitest";

import type { OpportunityFitInputContext } from "../opportunity/fit-input-context";
import type { FitSignalExtractionResult } from "./fit-signals";
import type { FitScoreCalculationInput } from "./fit-score";
import { extractFitSignals } from "./fit-signals";
import {
  FitSignalNormalizationError,
  normalizeFitSignals,
  type FitSignalNormalizationInput,
  type FitSignalNormalizationPolicy,
} from "./fit-signal-normalization";

const opportunity: OpportunityFitInputContext["opportunity"] = {
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

const entrepreneurExtraction = extractFitSignals({
  userType: "ENTREPRENEUR",
  opportunity,
  profile: {
    profileVersion: 1,
    locationText: "Synthetic City",
    city: "Synthetic City",
    province: "Synthetic Province",
    budgetMin: 150,
    budgetMax: 250,
    preferredProductType: null,
    experienceLevel: "BEGINNER",
    timeCommitment: "PART_TIME",
    interestCategoryIds: ["synthetic-category"],
    customerSegmentIds: ["synthetic-segment"],
    salesChannelIds: ["synthetic-channel"],
  },
});

const businessExtraction = extractFitSignals({
  userType: "UMKM_EXISTING",
  opportunity,
  profile: {
    profileVersion: 2,
    businessCategoryId: "synthetic-business-category",
    locationText: "Synthetic City",
    city: "Synthetic City",
    province: "Synthetic Province",
    averagePriceMin: 15,
    averagePriceMax: 25,
    businessDescription: null,
    operationModel: null,
    products: [{ fnbCategoryId: "synthetic-category", price: 18 }],
    customerSegmentIds: ["synthetic-segment"],
    salesChannelIds: ["other-synthetic-channel"],
  },
});

const syntheticEntrepreneurPolicy: FitSignalNormalizationPolicy = {
  modelType: "ENTREPRENEUR_FIT",
  mappings: [
    { signalComponent: "budgetAffordability", relation: "BUDGET_SUFFICIENT", fitComponent: "budgetFit", value: 61 },
    { signalComponent: "category", relation: "SET_INTERSECTION", fitComponent: "interestFit", value: 82 },
    { signalComponent: "salesChannels", relation: "SET_INTERSECTION", fitComponent: "channelFit", value: 73 },
    { signalComponent: "experienceLevel", relation: "EQUAL", fitComponent: "experienceFit", value: 91 },
    { signalComponent: "timeCommitment", relation: "EQUAL", fitComponent: "timeFit", value: 55 },
  ],
};

const syntheticBusinessPolicy: FitSignalNormalizationPolicy = {
  modelType: "BUSINESS_FIT",
  mappings: [
    { signalComponent: "priceRange", relation: "OVERLAP", fitComponent: "priceFit", value: 0 },
    { signalComponent: "category", relation: "SET_INTERSECTION", fitComponent: "productFit", value: 76 },
    { signalComponent: "customerSegments", relation: "SET_INTERSECTION", fitComponent: "customerFit", value: 68 },
    { signalComponent: "salesChannels", relation: "NO_SET_INTERSECTION", fitComponent: "channelFit", value: 25 },
  ],
};

function normalizeInput(
  userType: "ENTREPRENEUR",
  policy?: FitSignalNormalizationPolicy | null,
): FitSignalNormalizationInput;
function normalizeInput(
  userType: "UMKM_EXISTING",
  policy?: FitSignalNormalizationPolicy | null,
): FitSignalNormalizationInput;
function normalizeInput(
  userType: "ENTREPRENEUR" | "UMKM_EXISTING",
  policy?: FitSignalNormalizationPolicy | null,
): FitSignalNormalizationInput {
  return {
    userType,
    extraction: userType === "ENTREPRENEUR" ? entrepreneurExtraction : businessExtraction,
    policy: policy === undefined
      ? userType === "ENTREPRENEUR" ? syntheticEntrepreneurPolicy : syntheticBusinessPolicy
      : policy,
  };
}

describe("normalizeFitSignals", () => {
  it("normalizes selected Entrepreneur relations using only explicit policy values", () => {
    const result = normalizeFitSignals(normalizeInput("ENTREPRENEUR"));
    const coreInput: FitScoreCalculationInput = {
      userType: result.userType,
      configuration: null,
      normalizedComponents: result.normalizedComponents,
    };

    expect(result).toMatchObject({
      userType: "ENTREPRENEUR",
      modelType: "ENTREPRENEUR_FIT",
      normalizedComponents: {
        budgetFit: 61,
        interestFit: 82,
        channelFit: 73,
        experienceFit: 91,
        timeFit: 55,
      },
    });
    expect(result.normalizedComponents).not.toHaveProperty("locationFit");
    expect(coreInput.normalizedComponents).toEqual(result.normalizedComponents);
    expect(result.signals.find(({ signal }) => signal.component === "customerSegments"))
      .toMatchObject({ status: "OBSERVED_UNMAPPED", reason: "MAPPING_NOT_CONFIGURED" });
    expect(result.signals.find(({ signal }) => signal.component === "budgetAffordability"))
      .toMatchObject({
        status: "NORMALIZED",
        fitComponent: "budgetFit",
        value: 61,
        signal: { component: "budgetAffordability", relation: "BUDGET_SUFFICIENT", reason: "BUDGET_AFFORDABILITY_COMPARISON" },
      });
  });

  it("normalizes UMKM signals and accepts zero only when policy explicitly supplies zero", () => {
    const result = normalizeFitSignals(normalizeInput("UMKM_EXISTING"));

    expect(result.modelType).toBe("BUSINESS_FIT");
    expect(result.normalizedComponents).toEqual({
      priceFit: 0,
      productFit: 76,
      customerFit: 68,
      channelFit: 25,
    });
    expect(result.signals.find(({ signal }) => signal.component === "priceRange"))
      .toMatchObject({ status: "NORMALIZED", fitComponent: "priceFit", value: 0 });
    expect(result.signals.find(({ signal }) => signal.component === "salesChannels"))
      .toMatchObject({
        status: "NORMALIZED",
        signal: { relation: "NO_SET_INTERSECTION" },
        value: 25,
      });
  });

  it("leaves observed signals without an explicit mapping unnormalized", () => {
    const policy: FitSignalNormalizationPolicy = { modelType: "ENTREPRENEUR_FIT", mappings: [] };
    const result = normalizeFitSignals(normalizeInput("ENTREPRENEUR", policy));

    expect(result.normalizedComponents).toEqual({});
    expect(result.signals.filter(({ status }) => status === "OBSERVED_UNMAPPED")).toHaveLength(6);
  });

  it("rejects an observed relation when its selected component lacks that relation mapping", () => {
    const policy: FitSignalNormalizationPolicy = {
      modelType: "ENTREPRENEUR_FIT",
      mappings: [
        { signalComponent: "budgetAffordability", relation: "BUDGET_INSUFFICIENT", fitComponent: "budgetFit", value: 30 },
      ],
    };
    expect(() => normalizeFitSignals(normalizeInput("ENTREPRENEUR", policy))).toThrow(
      expect.objectContaining({ code: "MISSING_RELATION_MAPPING" }),
    );
  });

  it("keeps INSUFFICIENT_DATA and NOT_ASSESSED distinct and emits no numeric fallback", () => {
    const insufficientExtraction = extractFitSignals({
      userType: "ENTREPRENEUR",
      opportunity,
      profile: null,
    });
    const result = normalizeFitSignals({
      userType: "ENTREPRENEUR",
      extraction: insufficientExtraction,
      policy: syntheticEntrepreneurPolicy,
    });

    expect(result.normalizedComponents).toEqual({});
    expect(result.signals.find(({ signal }) => signal.component === "budgetAffordability"))
      .toMatchObject({
        status: "INSUFFICIENT_DATA",
        signal: { reason: "REQUIRED_INPUT_MISSING", missingFields: expect.any(Array) },
      });
    expect(result.signals.find(({ signal }) => signal.component === "location"))
      .toMatchObject({ status: "NOT_ASSESSED", signal: { reason: "NO_COMPARISON_CONTRACT" } });
    expect(result.normalizedComponents).not.toHaveProperty("locationFit");
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -0.01, 100.01, "50"])(
    "rejects invalid numeric mapping %s with a controlled error",
    (value) => {
      const policy = {
        modelType: "ENTREPRENEUR_FIT",
        mappings: [
          { signalComponent: "budgetAffordability", relation: "BUDGET_SUFFICIENT", fitComponent: "budgetFit", value },
        ],
      } as unknown as FitSignalNormalizationPolicy;
      expect(() => normalizeFitSignals(normalizeInput("ENTREPRENEUR", policy))).toThrow(
        expect.objectContaining({ code: "INVALID_MAPPING_VALUE" }),
      );
    },
  );

  it("rejects model mismatch, unsupported relation, and invalid component identifiers", () => {
    expect(() => normalizeFitSignals(normalizeInput("ENTREPRENEUR", syntheticBusinessPolicy))).toThrow(
      expect.objectContaining({ code: "MODEL_TYPE_MISMATCH" }),
    );

    const invalidRelation = {
      modelType: "ENTREPRENEUR_FIT",
      mappings: [
        { signalComponent: "budgetAffordability", relation: "OVERLAP", fitComponent: "budgetFit", value: 50 },
      ],
    } as unknown as FitSignalNormalizationPolicy;
    expect(() => normalizeFitSignals(normalizeInput("ENTREPRENEUR", invalidRelation))).toThrow(
      expect.objectContaining({ code: "INVALID_RELATION" }),
    );

    const invalidComponent = {
      modelType: "ENTREPRENEUR_FIT",
      mappings: [
        { signalComponent: "notAComponent", relation: "OVERLAP", fitComponent: "budgetFit", value: 50 },
      ],
    } as unknown as FitSignalNormalizationPolicy;
    expect(() => normalizeFitSignals(normalizeInput("ENTREPRENEUR", invalidComponent))).toThrow(
      expect.objectContaining({ code: "UNSUPPORTED_SIGNAL_COMPONENT" }),
    );
  });

  it("rejects an extraction that changes model-specific statuses or omits a component", () => {
    const invalidStatus = {
      ...entrepreneurExtraction,
      signals: entrepreneurExtraction.signals.map((signal) => signal.component === "budgetAffordability"
        ? {
            component: "budgetAffordability",
            status: "NOT_ASSESSED",
            relation: "NOT_ASSESSED",
            reason: "NO_COMPARISON_CONTRACT",
          }
        : signal),
    } as unknown as FitSignalExtractionResult;
    expect(() => normalizeFitSignals({
      userType: "ENTREPRENEUR",
      extraction: invalidStatus,
      policy: syntheticEntrepreneurPolicy,
    })).toThrow(expect.objectContaining({ code: "INVALID_SIGNAL" }));

    const incomplete = {
      ...entrepreneurExtraction,
      signals: entrepreneurExtraction.signals.filter(({ component }) => component !== "brandFit"),
    };
    expect(() => normalizeFitSignals({
      userType: "ENTREPRENEUR",
      extraction: incomplete,
      policy: syntheticEntrepreneurPolicy,
    })).toThrow(expect.objectContaining({ code: "INVALID_SIGNAL" }));
  });

  it("rejects duplicate or ambiguous mappings instead of overwriting component values", () => {
    const duplicate = {
      modelType: "ENTREPRENEUR_FIT",
      mappings: [
        { signalComponent: "budgetAffordability", relation: "BUDGET_SUFFICIENT", fitComponent: "budgetFit", value: 60 },
        { signalComponent: "budgetAffordability", relation: "BUDGET_SUFFICIENT", fitComponent: "budgetFit", value: 70 },
      ],
    } as unknown as FitSignalNormalizationPolicy;
    expect(() => normalizeFitSignals(normalizeInput("ENTREPRENEUR", duplicate))).toThrow(
      expect.objectContaining({ code: "DUPLICATE_MAPPING" }),
    );

    const ambiguous = {
      modelType: "ENTREPRENEUR_FIT",
      mappings: [
        { signalComponent: "budgetAffordability", relation: "BUDGET_SUFFICIENT", fitComponent: "budgetFit", value: 60 },
        { signalComponent: "category", relation: "SET_INTERSECTION", fitComponent: "budgetFit", value: 70 },
      ],
    } as unknown as FitSignalNormalizationPolicy;
    expect(() => normalizeFitSignals(normalizeInput("ENTREPRENEUR", ambiguous))).toThrow(
      expect.objectContaining({ code: "AMBIGUOUS_MAPPING" }),
    );
  });

  it("is deterministic across repeated calls and policy mapping order while retaining signal traceability", () => {
    const policy: FitSignalNormalizationPolicy = {
      modelType: "BUSINESS_FIT",
      mappings: [...syntheticBusinessPolicy.mappings].reverse(),
    };
    const input = normalizeInput("UMKM_EXISTING", policy);
    const first = normalizeFitSignals(input);
    const second = normalizeFitSignals(input);

    expect(first).toEqual(second);
    expect(first.signals.map(({ signal }) => signal.component)).toEqual(
      businessExtraction.signals.map(({ component }) => component),
    );
    expect(first.signals.find(({ signal }) => signal.component === "priceRange"))
      .toMatchObject({
        status: "NORMALIZED",
        signal: {
          component: "priceRange",
          relation: "OVERLAP",
          profileRange: { min: "15", max: "25" },
          opportunityRange: { min: "10", max: "20" },
        },
      });
  });
});
