export const OPPORTUNITY_SCORE_COMPONENTS = [
  "trendMomentum",
  "demandSignal",
  "competition",
  "consumerRelevance",
  "executionFeasibility",
  "marketSustainability",
] as const;

export type OpportunityScoreComponent = (typeof OPPORTUNITY_SCORE_COMPONENTS)[number];

export const OPPORTUNITY_SCORE_COMPONENT_LABELS: Readonly<Record<OpportunityScoreComponent, string>> = {
  trendMomentum: "Trend Momentum",
  demandSignal: "Demand Signal",
  competition: "Competition",
  consumerRelevance: "Consumer Relevance",
  executionFeasibility: "Execution Feasibility",
  marketSustainability: "Market Sustainability",
};

export const OPPORTUNITY_SCORE_DISCLAIMER =
  "Opportunity Score adalah indikator pendukung keputusan berdasarkan data yang tersedia dan bukan jaminan keberhasilan bisnis.";

export type OpportunityScorePolicy = {
  readonly modelType: "OPPORTUNITY_SCORE";
  readonly version: string;
  readonly weights: Readonly<Record<OpportunityScoreComponent, number>>;
  readonly normalization: "PRE_NORMALIZED_0_TO_100";
  readonly rounding: {
    readonly mode: "HALF_UP" | "HALF_EVEN";
    readonly decimalPlaces: number;
  };
};

export type NormalizedOpportunityScoreComponents = Readonly<
  Partial<Record<OpportunityScoreComponent, number | null>>
>;

export type OpportunityScoreBreakdownItem = {
  readonly component: OpportunityScoreComponent;
  readonly normalizedValue: number | null;
  readonly weight: number | null;
  readonly weightedContribution: number | null;
};

export type AvailableOpportunityScoreBreakdownItem = {
  readonly component: OpportunityScoreComponent;
  readonly normalizedValue: number;
  readonly weight: number;
  readonly weightedContribution: number;
};

export type OpportunityScoreInsufficientReason =
  | "CONFIGURATION_UNAVAILABLE"
  | "COMPONENTS_UNAVAILABLE";

export type OpportunityScoreCalculationResult =
  | {
      readonly status: "AVAILABLE";
      readonly modelType: "OPPORTUNITY_SCORE";
      readonly modelVersion: string;
      readonly score: number;
      readonly unroundedScore: number;
      readonly breakdown: readonly AvailableOpportunityScoreBreakdownItem[];
      readonly policy: OpportunityScorePolicy;
      readonly disclaimer: string;
    }
  | {
      readonly status: "INSUFFICIENT_DATA";
      readonly modelType: "OPPORTUNITY_SCORE";
      readonly modelVersion: string | null;
      readonly score: null;
      readonly breakdown: readonly OpportunityScoreBreakdownItem[];
      readonly missingComponents: readonly OpportunityScoreComponent[];
      readonly reason: OpportunityScoreInsufficientReason;
      readonly disclaimer: string;
    };

export type OpportunityScoreInputErrorCode =
  | "INVALID_INPUT"
  | "INVALID_CONFIGURATION"
  | "INVALID_WEIGHTS"
  | "INVALID_COMPONENTS";

export class OpportunityScoreInputError extends Error {
  override readonly name = "OpportunityScoreInputError";

  constructor(readonly code: OpportunityScoreInputErrorCode, message: string) {
    super(message);
  }
}

const WEIGHT_SUM_TOLERANCE = 1e-12;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function invalidConfiguration(message: string): never {
  throw new OpportunityScoreInputError("INVALID_CONFIGURATION", message);
}

function invalidWeights(message: string): never {
  throw new OpportunityScoreInputError("INVALID_WEIGHTS", message);
}

function invalidComponents(message: string): never {
  throw new OpportunityScoreInputError("INVALID_COMPONENTS", message);
}

function validatePolicy(value: unknown): OpportunityScorePolicy {
  if (!isRecord(value) || value.modelType !== "OPPORTUNITY_SCORE") {
    invalidConfiguration("An Opportunity Score policy is required.");
  }
  if (typeof value.version !== "string" || value.version.trim().length === 0) {
    invalidConfiguration("The scoring model version is required.");
  }
  if (value.normalization !== "PRE_NORMALIZED_0_TO_100") {
    invalidConfiguration("The policy must explicitly define normalized component inputs.");
  }

  const rounding = value.rounding;
  if (
    !isRecord(rounding) ||
    (rounding.mode !== "HALF_UP" && rounding.mode !== "HALF_EVEN") ||
    typeof rounding.decimalPlaces !== "number" ||
    !Number.isInteger(rounding.decimalPlaces) ||
    rounding.decimalPlaces < 0 ||
    rounding.decimalPlaces > 6
  ) {
    invalidConfiguration("A supported, explicit rounding policy is required.");
  }

  const weights = value.weights;
  if (!isRecord(weights)) invalidWeights("Opportunity Score weights must be an object.");
  const weightKeys = Object.keys(weights);
  if (
    weightKeys.length !== OPPORTUNITY_SCORE_COMPONENTS.length ||
    weightKeys.some((key) => !(OPPORTUNITY_SCORE_COMPONENTS as readonly string[]).includes(key))
  ) {
    invalidWeights("Every Opportunity Score component must have exactly one configured weight.");
  }

  let weightTotal = 0;
  for (const component of OPPORTUNITY_SCORE_COMPONENTS) {
    const weight = weights[component];
    if (typeof weight !== "number" || !Number.isFinite(weight) || weight < 0) {
      invalidWeights("Opportunity Score weights must be finite, non-negative numbers.");
    }
    weightTotal += weight;
  }
  if (Math.abs(weightTotal - 1) > WEIGHT_SUM_TOLERANCE) {
    invalidWeights("Opportunity Score weights must sum to 1.");
  }

  return value as unknown as OpportunityScorePolicy;
}

function validateComponents(value: unknown): NormalizedOpportunityScoreComponents {
  if (!isRecord(value)) {
    throw new OpportunityScoreInputError("INVALID_INPUT", "Normalized components must be an object.");
  }
  const keys = Object.keys(value);
  if (keys.some((key) => !(OPPORTUNITY_SCORE_COMPONENTS as readonly string[]).includes(key))) {
    invalidComponents("Normalized components contain an unknown component.");
  }

  for (const component of OPPORTUNITY_SCORE_COMPONENTS) {
    if (!Object.prototype.hasOwnProperty.call(value, component)) continue;
    const componentValue = value[component];
    if (componentValue === null) continue;
    if (
      typeof componentValue !== "number" ||
      !Number.isFinite(componentValue) ||
      componentValue < 0 ||
      componentValue > 100
    ) {
      invalidComponents("Normalized component values must be finite numbers from 0 to 100 or null.");
    }
  }

  return value as NormalizedOpportunityScoreComponents;
}

function roundScore(
  value: number,
  rounding: OpportunityScorePolicy["rounding"],
): number {
  const { decimalPlaces, mode } = rounding;
  const factor = 10 ** decimalPlaces;
  const scaledValue = value * factor;
  const floatingPointTolerance =
    Number.EPSILON * Math.max(1, Math.abs(scaledValue)) * OPPORTUNITY_SCORE_COMPONENTS.length;
  const lowerInteger = Math.floor(scaledValue);
  const fraction = scaledValue - lowerInteger;
  let rounded: number;

  if (mode === "HALF_UP") {
    rounded = fraction >= 0.5 - floatingPointTolerance ? lowerInteger + 1 : lowerInteger;
  } else if (Math.abs(fraction - 0.5) <= floatingPointTolerance) {
    rounded = lowerInteger % 2 === 0 ? lowerInteger : lowerInteger + 1;
  } else {
    rounded = fraction > 0.5 ? lowerInteger + 1 : lowerInteger;
  }

  return rounded / factor;
}

function breakdownFor(
  policy: OpportunityScorePolicy | null,
  components: NormalizedOpportunityScoreComponents | null,
): readonly OpportunityScoreBreakdownItem[] {
  return OPPORTUNITY_SCORE_COMPONENTS.map((component) => ({
    component,
    normalizedValue: components?.[component] ?? null,
    weight: policy?.weights[component] ?? null,
    weightedContribution: null,
  }));
}

export function calculateOpportunityScore(input: {
  readonly policy: OpportunityScorePolicy | null;
  readonly normalizedComponents: NormalizedOpportunityScoreComponents | null;
}): OpportunityScoreCalculationResult {
  if (!isRecord(input)) {
    throw new OpportunityScoreInputError("INVALID_INPUT", "Opportunity Score input must be an object.");
  }

  const policy = input.policy === null ? null : validatePolicy(input.policy);
  if (policy === null) {
    return {
      status: "INSUFFICIENT_DATA",
      modelType: "OPPORTUNITY_SCORE",
      modelVersion: null,
      score: null,
      breakdown: breakdownFor(null, null),
      missingComponents: OPPORTUNITY_SCORE_COMPONENTS,
      reason: "CONFIGURATION_UNAVAILABLE",
      disclaimer: OPPORTUNITY_SCORE_DISCLAIMER,
    };
  }

  const components = input.normalizedComponents === null
    ? null
    : validateComponents(input.normalizedComponents);
  const missingComponents = OPPORTUNITY_SCORE_COMPONENTS.filter((component) => {
    const value = components?.[component];
    return typeof value !== "number";
  });

  if (missingComponents.length > 0 || components === null) {
    return {
      status: "INSUFFICIENT_DATA",
      modelType: "OPPORTUNITY_SCORE",
      modelVersion: policy.version,
      score: null,
      breakdown: breakdownFor(policy, components),
      missingComponents,
      reason: "COMPONENTS_UNAVAILABLE",
      disclaimer: OPPORTUNITY_SCORE_DISCLAIMER,
    };
  }

  const breakdown = OPPORTUNITY_SCORE_COMPONENTS.map((component) => {
    const normalizedValue = components[component];
    if (typeof normalizedValue !== "number") {
      invalidComponents("Every component is required to calculate an Opportunity Score.");
    }
    return {
      component,
      normalizedValue,
      weight: policy.weights[component],
      weightedContribution: normalizedValue * policy.weights[component],
    };
  });
  const unroundedScore = breakdown.reduce((total, item) => total + item.weightedContribution, 0);
  const score = roundScore(unroundedScore, policy.rounding);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    invalidComponents("The calculated score is outside the supported range.");
  }

  return {
    status: "AVAILABLE",
    modelType: "OPPORTUNITY_SCORE",
    modelVersion: policy.version,
    score,
    unroundedScore,
    breakdown,
    policy,
    disclaimer: OPPORTUNITY_SCORE_DISCLAIMER,
  };
}
