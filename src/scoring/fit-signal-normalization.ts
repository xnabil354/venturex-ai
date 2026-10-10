import { isUserType, type UserType } from "../auth/user-types";
import type { FitScoreModelType } from "./fit-score";
import {
  BUSINESS_FIT_COMPONENTS,
  ENTREPRENEUR_FIT_COMPONENTS,
  type FitScoreComponent,
} from "./fit-score";
import {
  FIT_SIGNAL_COMPONENTS,
  FIT_SIGNAL_RELATIONS,
  type FitSignal,
  type FitSignalComponent,
  type FitSignalExtractionResult,
  type NormalizableFitSignalComponent,
  type FitSignalRelationFor,
} from "./fit-signals";

type EntrepreneurSignalComponent =
  | "budgetAffordability"
  | "category"
  | "customerSegments"
  | "salesChannels"
  | "experienceLevel"
  | "timeCommitment";

type BusinessSignalComponent = "priceRange" | "category" | "customerSegments" | "salesChannels";

type SignalComponentFor<ModelType extends FitScoreModelType> =
  ModelType extends "ENTREPRENEUR_FIT" ? EntrepreneurSignalComponent : BusinessSignalComponent;

type ScoreComponentFor<ModelType extends FitScoreModelType> =
  ModelType extends "ENTREPRENEUR_FIT"
    ? (typeof ENTREPRENEUR_FIT_COMPONENTS)[number]
    : (typeof BUSINESS_FIT_COMPONENTS)[number];

type MappingFor<ModelType extends FitScoreModelType> = {
  [Component in SignalComponentFor<ModelType>]: {
    readonly signalComponent: Component;
    readonly relation: FitSignalRelationFor<Component>;
    readonly fitComponent: ScoreComponentFor<ModelType>;
    readonly value: number;
  };
}[SignalComponentFor<ModelType>];

type PolicyFor<ModelType extends FitScoreModelType> = {
  readonly modelType: ModelType;
  readonly mappings: readonly MappingFor<ModelType>[];
};

export type FitSignalNormalizationPolicy =
  | PolicyFor<"ENTREPRENEUR_FIT">
  | PolicyFor<"BUSINESS_FIT">;

export type FitSignalNormalizationInput = {
  readonly userType: UserType;
  readonly extraction: FitSignalExtractionResult;
  readonly policy: FitSignalNormalizationPolicy | null;
};

type ObservedSignal = Extract<FitSignal, { readonly status: "OBSERVED" }>;
type InsufficientSignal = Extract<FitSignal, { readonly status: "INSUFFICIENT_DATA" }>;
type NotAssessedSignal = Extract<FitSignal, { readonly status: "NOT_ASSESSED" }>;

type NormalizedSignal = {
  readonly status: "NORMALIZED";
  readonly signal: ObservedSignal;
  readonly fitComponent: FitScoreComponent;
  readonly value: number;
};

type UnmappedObservedSignal = {
  readonly status: "OBSERVED_UNMAPPED";
  readonly signal: ObservedSignal;
  readonly reason: "MAPPING_NOT_CONFIGURED";
};

type PreservedSignal =
  | { readonly status: "INSUFFICIENT_DATA"; readonly signal: InsufficientSignal }
  | { readonly status: "NOT_ASSESSED"; readonly signal: NotAssessedSignal };

export type FitSignalNormalizationTrace =
  | NormalizedSignal
  | UnmappedObservedSignal
  | PreservedSignal;

type NormalizedComponentsFor<ModelType extends FitScoreModelType> = Readonly<
  Partial<Record<ScoreComponentFor<ModelType>, number>>
>;

export type FitSignalNormalizationResult =
  | {
      readonly userType: "ENTREPRENEUR";
      readonly modelType: "ENTREPRENEUR_FIT";
      readonly normalizedComponents: NormalizedComponentsFor<"ENTREPRENEUR_FIT">;
      readonly signals: readonly FitSignalNormalizationTrace[];
    }
  | {
      readonly userType: "UMKM_EXISTING";
      readonly modelType: "BUSINESS_FIT";
      readonly normalizedComponents: NormalizedComponentsFor<"BUSINESS_FIT">;
      readonly signals: readonly FitSignalNormalizationTrace[];
    };

export type FitSignalNormalizationErrorCode =
  | "INVALID_INPUT"
  | "INVALID_USER_TYPE"
  | "MODEL_TYPE_MISMATCH"
  | "POLICY_REQUIRED"
  | "INVALID_POLICY"
  | "INVALID_SIGNAL"
  | "UNSUPPORTED_SIGNAL_COMPONENT"
  | "INVALID_RELATION"
  | "INVALID_SCORE_COMPONENT"
  | "INVALID_MAPPING_VALUE"
  | "DUPLICATE_MAPPING"
  | "AMBIGUOUS_MAPPING"
  | "DUPLICATE_SIGNAL"
  | "MISSING_RELATION_MAPPING";

export class FitSignalNormalizationError extends Error {
  override readonly name = "FitSignalNormalizationError";

  constructor(readonly code: FitSignalNormalizationErrorCode, message: string) {
    super(message);
  }
}

type RuntimeMapping = {
  readonly signalComponent: FitSignalComponent;
  readonly relation: string;
  readonly fitComponent: FitScoreComponent;
  readonly value: number;
};

const ENTREPRENEUR_SIGNAL_COMPONENTS: readonly FitSignalComponent[] = [
  "budgetAffordability",
  "category",
  "customerSegments",
  "salesChannels",
  "experienceLevel",
  "timeCommitment",
];

const BUSINESS_SIGNAL_COMPONENTS: readonly FitSignalComponent[] = [
  "priceRange",
  "category",
  "customerSegments",
  "salesChannels",
];

function fail(code: FitSignalNormalizationErrorCode, message: string): never {
  throw new FitSignalNormalizationError(code, message);
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

function expectedModelType(userType: unknown): FitScoreModelType {
  if (userType === "ENTREPRENEUR") return "ENTREPRENEUR_FIT";
  if (userType === "UMKM_EXISTING") return "BUSINESS_FIT";
  return fail("INVALID_USER_TYPE", "Fit signal normalization requires a supported user type.");
}

function signalComponentsFor(modelType: FitScoreModelType): readonly FitSignalComponent[] {
  return modelType === "ENTREPRENEUR_FIT"
    ? ENTREPRENEUR_SIGNAL_COMPONENTS
    : BUSINESS_SIGNAL_COMPONENTS;
}

function scoreComponentsFor(modelType: FitScoreModelType): readonly FitScoreComponent[] {
  return modelType === "ENTREPRENEUR_FIT"
    ? ENTREPRENEUR_FIT_COMPONENTS
    : BUSINESS_FIT_COMPONENTS;
}

function isSignalComponent(value: unknown): value is FitSignalComponent {
  return typeof value === "string" && FIT_SIGNAL_COMPONENTS.some((component) => component === value);
}

function isNormalizableSignalComponent(value: unknown): value is NormalizableFitSignalComponent {
  return isSignalComponent(value) && FIT_SIGNAL_RELATIONS[value].length > 0;
}

function isFitSignalRelation(
  component: FitSignalComponent,
  relation: unknown,
): relation is string {
  return typeof relation === "string"
    && (FIT_SIGNAL_RELATIONS[component] as readonly string[]).includes(relation);
}

function validatePolicy(policy: unknown, modelType: FitScoreModelType): readonly RuntimeMapping[] {
  if (!isRecord(policy) || !hasExactKeys(policy, ["modelType", "mappings"])) {
    return fail("INVALID_POLICY", "Fit signal normalization policy has an invalid shape.");
  }
  if (policy.modelType !== modelType) {
    return fail("MODEL_TYPE_MISMATCH", "Normalization policy model type does not match the user.");
  }
  if (!Array.isArray(policy.mappings)) {
    return fail("INVALID_POLICY", "Fit signal normalization mappings must be an array.");
  }

  const allowedSignalComponents = new Set(signalComponentsFor(modelType));
  const allowedScoreComponents = new Set(scoreComponentsFor(modelType));
  const mappingKeys = new Set<string>();
  const targetForSignal = new Map<FitSignalComponent, FitScoreComponent>();
  const signalForTarget = new Map<FitScoreComponent, FitSignalComponent>();
  const mappings: RuntimeMapping[] = [];

  for (const mapping of policy.mappings) {
    if (!isRecord(mapping) || !hasExactKeys(mapping, ["signalComponent", "relation", "fitComponent", "value"])) {
      return fail("INVALID_POLICY", "A fit signal mapping has an invalid shape.");
    }
    if (!isNormalizableSignalComponent(mapping.signalComponent)) {
      return fail("UNSUPPORTED_SIGNAL_COMPONENT", "A mapping uses a signal component without an observed relation contract.");
    }
    const signalComponent = mapping.signalComponent;
    if (!allowedSignalComponents.has(signalComponent)) {
      return fail("UNSUPPORTED_SIGNAL_COMPONENT", "A mapping uses a signal component outside the selected model.");
    }
    if (!isFitSignalRelation(signalComponent, mapping.relation)) {
      return fail("INVALID_RELATION", "A mapping relation is not supported by its signal component.");
    }
    if (typeof mapping.fitComponent !== "string" || !allowedScoreComponents.has(mapping.fitComponent as FitScoreComponent)) {
      return fail("INVALID_SCORE_COMPONENT", "A mapping uses a Fit Score component outside the selected model.");
    }
    if (typeof mapping.value !== "number" || !Number.isFinite(mapping.value)
      || mapping.value < 0 || mapping.value > 100) {
      return fail("INVALID_MAPPING_VALUE", "Mapped normalized values must be finite numbers from 0 to 100.");
    }

    const fitComponent = mapping.fitComponent as FitScoreComponent;
    const key = `${signalComponent}\u0000${mapping.relation}`;
    if (mappingKeys.has(key)) {
      return fail("DUPLICATE_MAPPING", "Fit signal policy contains a duplicate component and relation mapping.");
    }
    mappingKeys.add(key);

    const priorTarget = targetForSignal.get(signalComponent);
    if (priorTarget !== undefined && priorTarget !== fitComponent) {
      return fail("AMBIGUOUS_MAPPING", "One signal component maps to multiple Fit Score components.");
    }
    const priorSignal = signalForTarget.get(fitComponent);
    if (priorSignal !== undefined && priorSignal !== signalComponent) {
      return fail("AMBIGUOUS_MAPPING", "Multiple signal components map to one Fit Score component.");
    }
    targetForSignal.set(signalComponent, fitComponent);
    signalForTarget.set(fitComponent, signalComponent);
    mappings.push({
      signalComponent,
      relation: mapping.relation,
      fitComponent,
      value: mapping.value,
    });
  }

  return mappings;
}

function validateSignal(value: unknown, modelType: FitScoreModelType): FitSignal {
  if (!isRecord(value) || !isSignalComponent(value.component)) {
    return fail("INVALID_SIGNAL", "Fit signal has an invalid component identifier.");
  }
  const component = value.component;
  const supportedForModel = signalComponentsFor(modelType).includes(component);
  if (supportedForModel && value.status === "NOT_ASSESSED") {
    return fail("INVALID_SIGNAL", "A supported signal component cannot be marked not assessed.");
  }
  if (!supportedForModel && value.status !== "NOT_ASSESSED") {
    return fail("INVALID_SIGNAL", "A signal without a comparison contract cannot carry an assessed status.");
  }
  if (value.status === "OBSERVED") {
    if (!isNormalizableSignalComponent(component) || !isFitSignalRelation(component, value.relation)) {
      return fail("INVALID_RELATION", "Observed fit signal has an unsupported relation.");
    }
    const expectedReason = component === "budgetAffordability"
      ? "BUDGET_AFFORDABILITY_COMPARISON"
      : component === "priceRange"
        ? "INCLUSIVE_RANGE_COMPARISON"
        : component === "category" || component === "customerSegments" || component === "salesChannels"
        ? "EXACT_REFERENCE_ID_COMPARISON"
        : "LITERAL_VALUE_COMPARISON";
    if (value.reason !== expectedReason) {
      return fail("INVALID_SIGNAL", "Observed fit signal reason does not match its component contract.");
    }
    return value as unknown as Extract<FitSignal, { readonly status: "OBSERVED" }>;
  }

  if (value.status === "INSUFFICIENT_DATA") {
    if (value.relation !== "UNDETERMINED"
      || (value.reason !== "REQUIRED_INPUT_MISSING" && value.reason !== "INVALID_INPUT_VALUE")) {
      return fail("INVALID_SIGNAL", "Insufficient fit signal has an invalid status contract.");
    }
    const fields = value.reason === "REQUIRED_INPUT_MISSING" ? value.missingFields : value.invalidFields;
    if (!Array.isArray(fields) || fields.length === 0 || fields.some((field) => typeof field !== "string")) {
      return fail("INVALID_SIGNAL", "Insufficient fit signal must retain its missing or invalid fields.");
    }
    return value as unknown as Extract<FitSignal, { readonly status: "INSUFFICIENT_DATA" }>;
  }

  if (value.status === "NOT_ASSESSED") {
    if (value.relation !== "NOT_ASSESSED" || value.reason !== "NO_COMPARISON_CONTRACT") {
      return fail("INVALID_SIGNAL", "Not-assessed fit signal has an invalid status contract.");
    }
    return value as unknown as Extract<FitSignal, { readonly status: "NOT_ASSESSED" }>;
  }

  return fail("INVALID_SIGNAL", "Fit signal has an unknown status.");
}

export function normalizeFitSignals(input: FitSignalNormalizationInput): FitSignalNormalizationResult {
  if (!isRecord(input) || !hasExactKeys(input, ["userType", "extraction", "policy"])) {
    return fail("INVALID_INPUT", "Fit signal normalization input has an invalid shape.");
  }
  if (!isUserType(input.userType)) {
    return fail("INVALID_USER_TYPE", "Fit signal normalization requires a supported user type.");
  }
  const modelType = expectedModelType(input.userType);
  if (!isRecord(input.extraction)
    || input.extraction.modelType !== modelType
    || !Array.isArray(input.extraction.signals)) {
    return fail("MODEL_TYPE_MISMATCH", "Fit signal extraction model type does not match the user.");
  }
  if (input.policy === null || input.policy === undefined) {
    return fail("POLICY_REQUIRED", "An explicit fit signal normalization policy is required.");
  }

  const mappings = validatePolicy(input.policy, modelType);
  const mappingsByKey = new Map<string, RuntimeMapping>();
  const mappingsByComponent = new Map<FitSignalComponent, RuntimeMapping[]>();
  for (const mapping of mappings) {
    mappingsByKey.set(`${mapping.signalComponent}\u0000${mapping.relation}`, mapping);
    const componentMappings = mappingsByComponent.get(mapping.signalComponent) ?? [];
    componentMappings.push(mapping);
    mappingsByComponent.set(mapping.signalComponent, componentMappings);
  }

  const seenSignals = new Set<FitSignalComponent>();
  const normalizedComponents: Partial<Record<FitScoreComponent, number>> = {};
  const traces: FitSignalNormalizationTrace[] = [];

  for (const signalInput of input.extraction.signals) {
    const signal = validateSignal(signalInput, modelType);
    if (seenSignals.has(signal.component)) {
      return fail("DUPLICATE_SIGNAL", "Fit signal extraction contains a duplicate component.");
    }
    seenSignals.add(signal.component);

    if (signal.status === "INSUFFICIENT_DATA") {
      traces.push({ status: "INSUFFICIENT_DATA", signal });
      continue;
    }
    if (signal.status === "NOT_ASSESSED") {
      traces.push({ status: "NOT_ASSESSED", signal });
      continue;
    }

    const componentMappings = mappingsByComponent.get(signal.component) ?? [];
    if (componentMappings.length === 0) {
      traces.push({ status: "OBSERVED_UNMAPPED", signal, reason: "MAPPING_NOT_CONFIGURED" });
      continue;
    }
    const mapping = mappingsByKey.get(`${signal.component}\u0000${signal.relation}`);
    if (mapping === undefined) {
      return fail("MISSING_RELATION_MAPPING", "Selected observed signal has no mapping for its factual relation.");
    }
    normalizedComponents[mapping.fitComponent] = mapping.value;
    traces.push({
      status: "NORMALIZED",
      signal,
      fitComponent: mapping.fitComponent,
      value: mapping.value,
    });
  }

  if (seenSignals.size !== FIT_SIGNAL_COMPONENTS.length
    || FIT_SIGNAL_COMPONENTS.some((component) => !seenSignals.has(component))) {
    return fail("INVALID_SIGNAL", "Fit signal extraction does not contain the complete component contract.");
  }

  if (modelType === "ENTREPRENEUR_FIT") {
    return {
      userType: "ENTREPRENEUR",
      modelType,
      normalizedComponents: normalizedComponents as NormalizedComponentsFor<"ENTREPRENEUR_FIT">,
      signals: traces,
    };
  }
  return {
    userType: "UMKM_EXISTING",
    modelType,
    normalizedComponents: normalizedComponents as NormalizedComponentsFor<"BUSINESS_FIT">,
    signals: traces,
  };
}
