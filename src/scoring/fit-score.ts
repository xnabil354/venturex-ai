import type { UserType } from "../auth/user-types";
import type { AnalysisScoreStatus, ScoringModelType } from "./persistence-types";

export const ENTREPRENEUR_FIT_COMPONENTS = [
  "budgetFit",
  "interestFit",
  "locationFit",
  "experienceFit",
  "channelFit",
  "timeFit",
] as const;

export const BUSINESS_FIT_COMPONENTS = [
  "productFit",
  "customerFit",
  "priceFit",
  "channelFit",
  "operationalFit",
  "brandFit",
] as const;

export type FitScoreModelType = Extract<
  ScoringModelType,
  "ENTREPRENEUR_FIT" | "BUSINESS_FIT"
>;

export type FitScoreComponent =
  | (typeof ENTREPRENEUR_FIT_COMPONENTS)[number]
  | (typeof BUSINESS_FIT_COMPONENTS)[number];

export type FitScoreConfiguration = {
  readonly modelType: FitScoreModelType;
  readonly weights?: Readonly<Partial<Record<FitScoreComponent, number>>> | null;
};

export type NormalizedFitComponents = Readonly<
  Partial<Record<FitScoreComponent, number | null>>
>;

export type FitScoreCalculationInput = {
  readonly userType: UserType;
  readonly configuration: FitScoreConfiguration | null;
  readonly normalizedComponents: NormalizedFitComponents | null;
};

export type FitScoreBreakdownItem = {
  readonly component: FitScoreComponent;
  readonly weight: number;
  readonly normalizedValue: number | null;
  readonly weightedContribution: number | null;
};

export type FitScoreInsufficientReason =
  | "CONFIGURATION_UNAVAILABLE"
  | "COMPONENTS_UNAVAILABLE";

export type FitScoreCalculationStatus = Extract<
  AnalysisScoreStatus,
  "AVAILABLE" | "INSUFFICIENT_DATA"
>;

export type FitScoreCalculationResult =
  | {
      readonly status: "AVAILABLE";
      readonly modelType: FitScoreModelType;
      readonly score: number;
      readonly breakdown: readonly FitScoreBreakdownItem[];
      readonly missingComponents: readonly [];
    }
  | {
      readonly status: "INSUFFICIENT_DATA";
      readonly modelType: FitScoreModelType;
      readonly score: null;
      readonly breakdown: readonly FitScoreBreakdownItem[];
      readonly missingComponents: readonly FitScoreComponent[];
      readonly reason: FitScoreInsufficientReason;
    };

export type FitScoreInputErrorCode =
  | "INVALID_INPUT"
  | "INVALID_USER_TYPE"
  | "MODEL_TYPE_MISMATCH"
  | "INVALID_WEIGHTS"
  | "INVALID_COMPONENTS";

export class FitScoreInputError extends Error {
  override readonly name = "FitScoreInputError";

  constructor(readonly code: FitScoreInputErrorCode, message: string) {
    super(message);
  }
}

const WEIGHT_SUM_TOLERANCE = 1e-12;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function expectedModelType(userType: unknown): FitScoreModelType {
  if (userType === "ENTREPRENEUR") return "ENTREPRENEUR_FIT";
  if (userType === "UMKM_EXISTING") return "BUSINESS_FIT";
  throw new FitScoreInputError("INVALID_USER_TYPE", "Fit Score requires a supported user type.");
}

function componentsFor(modelType: FitScoreModelType): readonly FitScoreComponent[] {
  return modelType === "ENTREPRENEUR_FIT"
    ? ENTREPRENEUR_FIT_COMPONENTS
    : BUSINESS_FIT_COMPONENTS;
}

function insufficientResult(
  modelType: FitScoreModelType,
  reason: FitScoreInsufficientReason,
  missingComponents: readonly FitScoreComponent[] = [],
  breakdown: readonly FitScoreBreakdownItem[] = [],
): FitScoreCalculationResult {
  return {
    status: "INSUFFICIENT_DATA",
    modelType,
    score: null,
    breakdown,
    missingComponents,
    reason,
  };
}

function invalidWeights(message: string): never {
  throw new FitScoreInputError("INVALID_WEIGHTS", message);
}

function invalidComponents(message: string): never {
  throw new FitScoreInputError("INVALID_COMPONENTS", message);
}

export function calculateFitScore(input: FitScoreCalculationInput): FitScoreCalculationResult {
  if (!isRecord(input)) {
    throw new FitScoreInputError("INVALID_INPUT", "Fit Score input must be an object.");
  }

  const modelType = expectedModelType(input.userType);
  const configuration = input.configuration;
  if (configuration === null || configuration === undefined) {
    return insufficientResult(modelType, "CONFIGURATION_UNAVAILABLE");
  }
  if (!isRecord(configuration)) {
    throw new FitScoreInputError("INVALID_INPUT", "Fit Score configuration must be an object.");
  }
  if (configuration.modelType !== modelType) {
    throw new FitScoreInputError(
      "MODEL_TYPE_MISMATCH",
      "Fit Score model type does not match the user's type.",
    );
  }

  const rawWeights = configuration.weights;
  if (rawWeights === null || rawWeights === undefined) {
    return insufficientResult(modelType, "CONFIGURATION_UNAVAILABLE");
  }
  if (!isRecord(rawWeights)) invalidWeights("Fit Score weights must be an object.");

  const componentOrder = componentsFor(modelType);
  const allowedComponents = new Set<string>(componentOrder);
  const weightKeys = Object.keys(rawWeights);
  if (weightKeys.length === 0) invalidWeights("At least one Fit Score weight is required.");
  if (weightKeys.some((key) => !allowedComponents.has(key))) {
    invalidWeights("Fit Score weights contain a component outside the configured model type.");
  }

  const weightedComponents = componentOrder.filter((component) =>
    Object.prototype.hasOwnProperty.call(rawWeights, component),
  );
  let weightTotal = 0;
  for (const component of weightedComponents) {
    const weight = rawWeights[component];
    if (typeof weight !== "number" || !Number.isFinite(weight) || weight < 0) {
      invalidWeights("Fit Score weights must be finite, non-negative numbers.");
    }
    weightTotal += weight;
  }
  if (Math.abs(weightTotal - 1) > WEIGHT_SUM_TOLERANCE) {
    invalidWeights("Fit Score weights must sum to 1.");
  }

  const rawComponents = input.normalizedComponents;
  if (rawComponents !== null && rawComponents !== undefined && !isRecord(rawComponents)) {
    invalidComponents("Normalized Fit Score components must be an object.");
  }
  const normalizedComponents = rawComponents ?? {};
  const componentKeys = Object.keys(normalizedComponents);
  if (componentKeys.some((key) => !allowedComponents.has(key))) {
    invalidComponents("Normalized Fit Score components contain a component outside the model type.");
  }

  for (const component of componentOrder) {
    const value = normalizedComponents[component];
    if (value === null || value === undefined) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
      invalidComponents("Normalized Fit Score values must be finite numbers from 0 to 100.");
    }
  }

  const breakdown: FitScoreBreakdownItem[] = weightedComponents.map((component) => {
    const value = normalizedComponents[component];
    const weight = rawWeights[component] as number;
    return {
      component,
      weight,
      normalizedValue: typeof value === "number" ? value : null,
      weightedContribution: typeof value === "number" ? value * weight : null,
    };
  });
  const missingComponents = breakdown
    .filter(({ normalizedValue }) => normalizedValue === null)
    .map(({ component }) => component);

  if (missingComponents.length > 0) {
    return insufficientResult(modelType, "COMPONENTS_UNAVAILABLE", missingComponents, breakdown);
  }

  const score = breakdown.reduce(
    (total, { weightedContribution }) => total + (weightedContribution ?? 0),
    0,
  );

  return {
    status: "AVAILABLE",
    modelType,
    score,
    breakdown,
    missingComponents: [],
  };
}
