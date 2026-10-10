import { isUserType, type UserType } from "../auth/user-types";
import type { OpportunityFitInputContext } from "../opportunity/fit-input-context";
import { calculateFitScore, type FitScoreCalculationResult, type FitScoreComponent, type FitScoreModelType } from "./fit-score";
import {
  normalizeFitSignals,
  type FitSignalNormalizationPolicy,
  type FitSignalNormalizationTrace,
} from "./fit-signal-normalization";
import { extractFitSignals } from "./fit-signals";

export const FIT_SCORE_MVP_POLICY_VERSION = "FIT_MVP_HEURISTIC_V1" as const;
export const FIT_SCORE_MVP_LABEL = "MVP Heuristic Fit Score" as const;
export const FIT_SCORE_MVP_DISCLAIMER =
  "Fit Score menunjukkan kesesuaian berdasarkan profil dan kriteria terbatas yang tersedia, bukan jaminan keberhasilan bisnis." as const;

export type FitScoreMvpModelPolicy = {
  readonly modelType: FitScoreModelType;
  readonly normalization: FitSignalNormalizationPolicy;
  readonly configuration: {
    readonly modelType: FitScoreModelType;
    readonly weights: Readonly<Partial<Record<FitScoreComponent, number>>>;
  };
  readonly excludedComponents: readonly FitScoreComponent[];
};

export type FitScoreMvpPolicy = {
  readonly version: typeof FIT_SCORE_MVP_POLICY_VERSION;
  readonly label: typeof FIT_SCORE_MVP_LABEL;
  readonly disclaimer: typeof FIT_SCORE_MVP_DISCLAIMER;
  readonly rounding: {
    readonly decimalPlaces: 2;
    readonly tieBreak: "TOWARD_POSITIVE_INFINITY";
  };
  readonly models: Readonly<Record<FitScoreModelType, FitScoreMvpModelPolicy>>;
};

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export const FIT_SCORE_MVP_HEURISTIC_V1 = deepFreeze({
  version: FIT_SCORE_MVP_POLICY_VERSION,
  label: FIT_SCORE_MVP_LABEL,
  disclaimer: FIT_SCORE_MVP_DISCLAIMER,
  rounding: {
    decimalPlaces: 2,
    tieBreak: "TOWARD_POSITIVE_INFINITY",
  },
  models: {
    ENTREPRENEUR_FIT: {
      modelType: "ENTREPRENEUR_FIT",
      normalization: {
        modelType: "ENTREPRENEUR_FIT",
        mappings: [
          { signalComponent: "budgetAffordability", relation: "BUDGET_SUFFICIENT", fitComponent: "budgetFit", value: 100 },
          { signalComponent: "budgetAffordability", relation: "BUDGET_INSUFFICIENT", fitComponent: "budgetFit", value: 0 },
          { signalComponent: "category", relation: "SET_INTERSECTION", fitComponent: "interestFit", value: 100 },
          { signalComponent: "category", relation: "NO_SET_INTERSECTION", fitComponent: "interestFit", value: 0 },
          { signalComponent: "salesChannels", relation: "SET_INTERSECTION", fitComponent: "channelFit", value: 100 },
          { signalComponent: "salesChannels", relation: "NO_SET_INTERSECTION", fitComponent: "channelFit", value: 0 },
        ],
      },
      configuration: {
        modelType: "ENTREPRENEUR_FIT",
        weights: { budgetFit: 0.4, interestFit: 0.3, channelFit: 0.3 },
      },
      excludedComponents: ["locationFit", "experienceFit", "timeFit"],
    },
    BUSINESS_FIT: {
      modelType: "BUSINESS_FIT",
      normalization: {
        modelType: "BUSINESS_FIT",
        mappings: [
          { signalComponent: "priceRange", relation: "OVERLAP", fitComponent: "priceFit", value: 100 },
          { signalComponent: "priceRange", relation: "DISJOINT", fitComponent: "priceFit", value: 0 },
          { signalComponent: "category", relation: "SET_INTERSECTION", fitComponent: "productFit", value: 100 },
          { signalComponent: "category", relation: "NO_SET_INTERSECTION", fitComponent: "productFit", value: 0 },
          { signalComponent: "customerSegments", relation: "SET_INTERSECTION", fitComponent: "customerFit", value: 100 },
          { signalComponent: "customerSegments", relation: "NO_SET_INTERSECTION", fitComponent: "customerFit", value: 0 },
          { signalComponent: "salesChannels", relation: "SET_INTERSECTION", fitComponent: "channelFit", value: 100 },
          { signalComponent: "salesChannels", relation: "NO_SET_INTERSECTION", fitComponent: "channelFit", value: 0 },
        ],
      },
      configuration: {
        modelType: "BUSINESS_FIT",
        weights: { priceFit: 0.3, productFit: 0.25, customerFit: 0.25, channelFit: 0.2 },
      },
      excludedComponents: ["operationalFit", "brandFit"],
    },
  },
} as const satisfies FitScoreMvpPolicy);

export type FitScoreMvpBreakdownItem = {
  readonly component: FitScoreComponent;
  readonly interpretation: string;
  readonly normalizedValue: number | null;
  readonly weight: number;
  readonly weightedContribution: number | null;
  readonly signal: FitSignalNormalizationTrace;
};

const COMPONENT_INTERPRETATIONS: Readonly<Record<FitScoreComponent, string>> = {
  budgetFit: "Budget affordability compares persisted budgetMax with Opportunity capitalMin.",
  interestFit: "Interest Fit compares exact F&B category reference IDs.",
  locationFit: "Location Fit is excluded from this MVP policy.",
  experienceFit: "Experience Fit is excluded from this MVP policy.",
  channelFit: "Channel Fit compares exact sales-channel reference IDs.",
  timeFit: "Time Fit is excluded from this MVP policy.",
  productFit: "Product Category Match proxy from active product category IDs; this is not a full product evaluation.",
  customerFit: "Customer Fit compares exact customer-segment reference IDs.",
  priceFit: "Price Fit compares profile and Opportunity price ranges with inclusive endpoints.",
  operationalFit: "Operational Fit is excluded from this MVP policy.",
  brandFit: "Brand Fit is excluded from this MVP policy.",
};

type FitScoreMvpResultBase = {
  readonly label: typeof FIT_SCORE_MVP_LABEL;
  readonly policyVersion: typeof FIT_SCORE_MVP_POLICY_VERSION;
  readonly modelType: FitScoreModelType;
  readonly confidence: null;
  readonly activeComponents: readonly FitScoreMvpBreakdownItem[];
  readonly excludedComponents: readonly FitScoreComponent[];
  readonly disclaimer: typeof FIT_SCORE_MVP_DISCLAIMER;
};

export type FitScoreMvpResult =
  | (FitScoreMvpResultBase & {
      readonly status: "AVAILABLE";
      readonly score: number;
      readonly missingComponents: readonly [];
    })
  | (FitScoreMvpResultBase & {
      readonly status: "INSUFFICIENT_DATA";
      readonly score: null;
      readonly missingComponents: readonly FitScoreComponent[];
      readonly reason: "ACTIVE_COMPONENTS_UNAVAILABLE";
    });

export type FitScoreMvpErrorCode = "INVALID_INPUT" | "INVALID_POLICY" | "MODEL_TYPE_MISMATCH";

export class FitScoreMvpError extends Error {
  override readonly name = "FitScoreMvpError";

  constructor(readonly code: FitScoreMvpErrorCode, message: string) {
    super(message);
  }
}

function fail(code: FitScoreMvpErrorCode, message: string): never {
  throw new FitScoreMvpError(code, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function sameStringArray(actual: unknown, expected: readonly string[]): boolean {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function sameWeights(actual: unknown, expected: Readonly<Record<string, number>>): boolean {
  if (!isRecord(actual)) return false;
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  return actualKeys.length === expectedKeys.length
    && actualKeys.every((key, index) => key === expectedKeys[index] && actual[key] === expected[key]);
}

function mappingKey(mapping: unknown): string | null {
  if (!isRecord(mapping)
    || typeof mapping.signalComponent !== "string"
    || typeof mapping.relation !== "string"
    || typeof mapping.fitComponent !== "string"
    || typeof mapping.value !== "number") return null;
  return JSON.stringify([
    mapping.signalComponent,
    mapping.relation,
    mapping.fitComponent,
    mapping.value,
  ]);
}

function sameMappings(actual: unknown, expected: readonly unknown[]): boolean {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  const actualKeys = actual.map(mappingKey);
  const expectedKeys = expected.map(mappingKey);
  if (actualKeys.some((key) => key === null) || expectedKeys.some((key) => key === null)) return false;
  const sortedActual = actualKeys.sort();
  const sortedExpected = expectedKeys.sort();
  return sortedActual.every((key, index) => key === sortedExpected[index]);
}

function validatePolicy(value: unknown): asserts value is FitScoreMvpPolicy {
  if (!isRecord(value)
    || !hasExactKeys(value, ["version", "label", "disclaimer", "rounding", "models"])) {
    return fail("INVALID_POLICY", "Fit Score MVP policy has an invalid shape.");
  }
  if (value.version !== FIT_SCORE_MVP_POLICY_VERSION
    || value.label !== FIT_SCORE_MVP_LABEL
    || value.disclaimer !== FIT_SCORE_MVP_DISCLAIMER) {
    return fail("INVALID_POLICY", "Unsupported Fit Score MVP policy version or metadata.");
  }
  if (!isRecord(value.rounding)
    || !hasExactKeys(value.rounding, ["decimalPlaces", "tieBreak"])
    || value.rounding.decimalPlaces !== 2
    || value.rounding.tieBreak !== "TOWARD_POSITIVE_INFINITY") {
    return fail("INVALID_POLICY", "Fit Score MVP rounding policy does not match its version.");
  }
  if (!isRecord(value.models)
    || !hasExactKeys(value.models, ["ENTREPRENEUR_FIT", "BUSINESS_FIT"])) {
    return fail("INVALID_POLICY", "Fit Score MVP policy model configuration is invalid.");
  }

  for (const modelType of ["ENTREPRENEUR_FIT", "BUSINESS_FIT"] as const) {
    const actual = value.models[modelType];
    const expected = FIT_SCORE_MVP_HEURISTIC_V1.models[modelType];
    if (!isRecord(actual)
      || !hasExactKeys(actual, ["modelType", "normalization", "configuration", "excludedComponents"])) {
      return fail("INVALID_POLICY", "Fit Score MVP model configuration has an invalid shape.");
    }
    if (actual.modelType !== modelType) {
      return fail("MODEL_TYPE_MISMATCH", "Fit Score MVP model configuration has the wrong model type.");
    }
    if (!isRecord(actual.normalization)
      || !hasExactKeys(actual.normalization, ["modelType", "mappings"])
      || actual.normalization.modelType !== modelType
      || !sameMappings(actual.normalization.mappings, expected.normalization.mappings)) {
      return fail("INVALID_POLICY", "Fit Score MVP normalization mappings differ from the approved version.");
    }
    if (!isRecord(actual.configuration)
      || !hasExactKeys(actual.configuration, ["modelType", "weights"])) {
      return fail("INVALID_POLICY", "Fit Score MVP score configuration has an invalid shape.");
    }
    if (actual.configuration.modelType !== modelType) {
      return fail("MODEL_TYPE_MISMATCH", "Fit Score MVP score configuration has the wrong model type.");
    }
    if (!sameWeights(actual.configuration.weights, expected.configuration.weights)) {
      return fail("INVALID_POLICY", "Fit Score MVP weights differ from the approved version.");
    }
    if (!sameStringArray(actual.excludedComponents, expected.excludedComponents)) {
      return fail("INVALID_POLICY", "Fit Score MVP excluded components differ from the approved version.");
    }
  }
}

function modelTypeForUser(userType: UserType): FitScoreModelType {
  return userType === "ENTREPRENEUR" ? "ENTREPRENEUR_FIT" : "BUSINESS_FIT";
}

/**
 * Uses JavaScript Math.round semantics: for non-negative scores, exact midpoint
 * ties round toward positive infinity. Rounding occurs once, on the final score.
 */
export function roundFitScoreToTwoDecimals(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return fail("INVALID_INPUT", "Final Fit Score must be finite and between 0 and 100.");
  }
  return Math.round(value * 100) / 100;
}

function getCalculationTrace(
  item: FitScoreCalculationResult["breakdown"][number],
  modelPolicy: FitScoreMvpModelPolicy,
  traces: readonly FitSignalNormalizationTrace[],
): FitSignalNormalizationTrace {
  const mapping = modelPolicy.normalization.mappings.find(({ fitComponent }) => fitComponent === item.component);
  if (!mapping) return fail("INVALID_POLICY", "An active score component has no signal mapping.");
  const trace = traces.find(({ signal }) => signal.component === mapping.signalComponent);
  if (!trace) return fail("INVALID_INPUT", "An active score component has no extracted signal trace.");
  return trace;
}

export function calculateFitScoreMvp(
  context: OpportunityFitInputContext,
  policy: FitScoreMvpPolicy,
): FitScoreMvpResult {
  if (!isRecord(context) || !isUserType(context.userType) || !isRecord(context.opportunity)) {
    return fail("INVALID_INPUT", "Fit Score MVP requires a valid Fit Input Context.");
  }
  validatePolicy(policy);

  const modelType = modelTypeForUser(context.userType);
  const modelPolicy = policy.models[modelType];
  if (modelPolicy.modelType !== modelType
    || modelPolicy.normalization.modelType !== modelType
    || modelPolicy.configuration.modelType !== modelType) {
    return fail("MODEL_TYPE_MISMATCH", "Selected Fit Score MVP policy does not match the user's type.");
  }

  const extraction = extractFitSignals(context);
  const normalization = normalizeFitSignals({
    userType: context.userType,
    extraction,
    policy: modelPolicy.normalization,
  });
  const calculation = calculateFitScore({
    userType: context.userType,
    configuration: modelPolicy.configuration,
    normalizedComponents: normalization.normalizedComponents,
  });
  const activeComponents = calculation.breakdown.map((item) => ({
    ...item,
    interpretation: COMPONENT_INTERPRETATIONS[item.component],
    signal: getCalculationTrace(item, modelPolicy, normalization.signals),
  }));

  const shared = {
    label: policy.label,
    policyVersion: policy.version,
    modelType,
    confidence: null,
    activeComponents,
    excludedComponents: modelPolicy.excludedComponents,
    disclaimer: policy.disclaimer,
  } as const;

  if (calculation.status === "INSUFFICIENT_DATA") {
    return {
      ...shared,
      status: "INSUFFICIENT_DATA",
      score: null,
      missingComponents: calculation.missingComponents,
      reason: "ACTIVE_COMPONENTS_UNAVAILABLE",
    };
  }

  return {
    ...shared,
    status: "AVAILABLE",
    score: roundFitScoreToTwoDecimals(calculation.score),
    missingComponents: [],
  };
}
