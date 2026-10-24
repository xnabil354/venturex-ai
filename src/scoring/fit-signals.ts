import type {
  BusinessFitProfileInput,
  EntrepreneurFitProfileInput,
  OpportunityFitInputContext,
} from "../opportunity/fit-input-context";
import type { FitScoreModelType } from "./fit-score";

export const FIT_SIGNAL_COMPONENTS = [
  "budgetAffordability",
  "priceRange",
  "category",
  "customerSegments",
  "salesChannels",
  "experienceLevel",
  "timeCommitment",
  "location",
  "product",
  "operationalFit",
  "brandFit",
] as const;

export type FitSignalComponent = (typeof FIT_SIGNAL_COMPONENTS)[number];

export const FIT_SIGNAL_RELATIONS = {
  budgetAffordability: ["BUDGET_SUFFICIENT", "BUDGET_INSUFFICIENT"],
  priceRange: ["OVERLAP", "DISJOINT"],
  category: ["SET_INTERSECTION", "NO_SET_INTERSECTION"],
  customerSegments: ["SET_INTERSECTION", "NO_SET_INTERSECTION"],
  salesChannels: ["SET_INTERSECTION", "NO_SET_INTERSECTION"],
  experienceLevel: ["EQUAL", "DIFFERENT"],
  timeCommitment: ["EQUAL", "DIFFERENT"],
  location: [],
  product: [],
  operationalFit: [],
  brandFit: [],
} as const satisfies Record<FitSignalComponent, readonly string[]>;

export type NormalizableFitSignalComponent = {
  [Component in FitSignalComponent]: (typeof FIT_SIGNAL_RELATIONS)[Component] extends readonly []
    ? never
    : Component;
}[FitSignalComponent];

export type FitSignalRelationFor<Component extends NormalizableFitSignalComponent> =
  (typeof FIT_SIGNAL_RELATIONS)[Component][number];

type BudgetAffordabilityFitSignal = {
  readonly component: "budgetAffordability";
  readonly status: "OBSERVED";
  readonly relation: FitSignalRelationFor<"budgetAffordability">;
  readonly reason: "BUDGET_AFFORDABILITY_COMPARISON";
  readonly budgetMax: string;
  readonly capitalMin: string;
};

type PriceRangeFitSignal = {
  readonly component: "priceRange";
  readonly status: "OBSERVED";
  readonly relation: FitSignalRelationFor<"priceRange">;
  readonly reason: "INCLUSIVE_RANGE_COMPARISON";
  readonly profileRange: { readonly min: string; readonly max: string };
  readonly opportunityRange: { readonly min: string; readonly max: string };
};

type ReferenceFitSignal = {
  readonly component: "category" | "customerSegments" | "salesChannels";
  readonly status: "OBSERVED";
  readonly relation: FitSignalRelationFor<"category" | "customerSegments" | "salesChannels">;
  readonly reason: "EXACT_REFERENCE_ID_COMPARISON";
  readonly profileReferenceIds: readonly string[];
  readonly opportunityReferenceIds: readonly string[];
  readonly matchingReferenceIds: readonly string[];
};

type LiteralFitSignal = {
  readonly component: "experienceLevel" | "timeCommitment";
  readonly status: "OBSERVED";
  readonly relation: FitSignalRelationFor<"experienceLevel" | "timeCommitment">;
  readonly reason: "LITERAL_VALUE_COMPARISON";
  readonly profileValue: string;
  readonly opportunityValue: string;
};

type InsufficientFitSignal = {
  readonly component: FitSignalComponent;
  readonly status: "INSUFFICIENT_DATA";
  readonly relation: "UNDETERMINED";
  readonly reason: "REQUIRED_INPUT_MISSING" | "INVALID_INPUT_VALUE";
  readonly missingFields?: readonly string[];
  readonly invalidFields?: readonly string[];
};

type NotAssessedFitSignal = {
  readonly component: FitSignalComponent;
  readonly status: "NOT_ASSESSED";
  readonly relation: "NOT_ASSESSED";
  readonly reason: "NO_COMPARISON_CONTRACT";
};

export type FitSignal =
  | BudgetAffordabilityFitSignal
  | PriceRangeFitSignal
  | ReferenceFitSignal
  | LiteralFitSignal
  | InsufficientFitSignal
  | NotAssessedFitSignal;

export type FitSignalExtractionResult = {
  readonly modelType: FitScoreModelType;
  readonly signals: readonly FitSignal[];
};

type RangeInput = {
  readonly min: unknown;
  readonly max: unknown;
};

type ParsedRange = {
  readonly min: bigint;
  readonly max: bigint;
  readonly display: { readonly min: string; readonly max: string };
};

function parseAmount(value: unknown): bigint | null {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) return null;
    return BigInt(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return null;
}

function insufficient(
  component: FitSignalComponent,
  reason: InsufficientFitSignal["reason"],
  fields: readonly string[],
): InsufficientFitSignal {
  return reason === "REQUIRED_INPUT_MISSING"
    ? { component, status: "INSUFFICIENT_DATA", relation: "UNDETERMINED", reason, missingFields: fields }
    : { component, status: "INSUFFICIENT_DATA", relation: "UNDETERMINED", reason, invalidFields: fields };
}

function notAssessed(component: FitSignalComponent): NotAssessedFitSignal {
  return {
    component,
    status: "NOT_ASSESSED",
    relation: "NOT_ASSESSED",
    reason: "NO_COMPARISON_CONTRACT",
  };
}

function parseRange(range: RangeInput): ParsedRange | null {
  const min = parseAmount(range.min);
  const max = parseAmount(range.max);
  if (min === null || max === null || min > max) return null;
  return { min, max, display: { min: min.toString(), max: max.toString() } };
}

function budgetAffordabilitySignal(
  budgetMax: unknown,
  capitalMin: unknown,
  budgetField: string,
  capitalField: string,
): FitSignal {
  const missingFields = [
    ...(budgetMax === null || budgetMax === undefined ? [budgetField] : []),
    ...(capitalMin === null || capitalMin === undefined ? [capitalField] : []),
  ];
  if (missingFields.length > 0) {
    return insufficient("budgetAffordability", "REQUIRED_INPUT_MISSING", missingFields);
  }

  const parsedBudgetMax = parseAmount(budgetMax);
  const parsedCapitalMin = parseAmount(capitalMin);
  if (parsedBudgetMax === null || parsedCapitalMin === null) {
    const invalidFields = [
      ...(parsedBudgetMax === null ? [budgetField] : []),
      ...(parsedCapitalMin === null ? [capitalField] : []),
    ];
    return insufficient("budgetAffordability", "INVALID_INPUT_VALUE", invalidFields);
  }

  return {
    component: "budgetAffordability",
    status: "OBSERVED",
    relation: parsedBudgetMax >= parsedCapitalMin ? "BUDGET_SUFFICIENT" : "BUDGET_INSUFFICIENT",
    reason: "BUDGET_AFFORDABILITY_COMPARISON",
    budgetMax: parsedBudgetMax.toString(),
    capitalMin: parsedCapitalMin.toString(),
  };
}

function rangeSignal(
  component: "priceRange",
  profileRange: RangeInput | null,
  opportunityRange: RangeInput | null,
  profileFields: readonly [string, string],
  opportunityFields: readonly [string, string],
): FitSignal {
  const missingFields: string[] = [];
  if (profileRange === null) missingFields.push(...profileFields);
  else {
    if (profileRange.min === null || profileRange.min === undefined) missingFields.push(profileFields[0]);
    if (profileRange.max === null || profileRange.max === undefined) missingFields.push(profileFields[1]);
  }
  if (opportunityRange === null) missingFields.push(...opportunityFields);
  else {
    if (opportunityRange.min === null || opportunityRange.min === undefined) missingFields.push(opportunityFields[0]);
    if (opportunityRange.max === null || opportunityRange.max === undefined) missingFields.push(opportunityFields[1]);
  }
  if (missingFields.length > 0) return insufficient(component, "REQUIRED_INPUT_MISSING", missingFields);

  const parsedProfile = parseRange(profileRange as RangeInput);
  const parsedOpportunity = parseRange(opportunityRange as RangeInput);
  if (parsedProfile === null || parsedOpportunity === null) {
    const invalidFields: string[] = [];
    if (parsedProfile === null) invalidFields.push(...profileFields);
    if (parsedOpportunity === null) invalidFields.push(...opportunityFields);
    return insufficient(component, "INVALID_INPUT_VALUE", invalidFields);
  }

  const overlaps = parsedProfile.min <= parsedOpportunity.max
    && parsedOpportunity.min <= parsedProfile.max;
  return {
    component,
    status: "OBSERVED",
    relation: overlaps ? "OVERLAP" : "DISJOINT",
    reason: "INCLUSIVE_RANGE_COMPARISON",
    profileRange: parsedProfile.display,
    opportunityRange: parsedOpportunity.display,
  };
}

function validReferenceIds(value: readonly string[]): boolean {
  return value.every((id) => typeof id === "string" && id.length > 0 && id.trim() === id);
}

function referenceSignal(
  component: "category" | "customerSegments" | "salesChannels",
  profileReferenceIds: readonly string[] | null,
  opportunityReferenceIds: readonly string[] | null,
  profileField: string,
  opportunityField: string,
  extraMissingFields: readonly string[] = [],
): FitSignal {
  const missingFields = [...extraMissingFields];
  if (profileReferenceIds === null || profileReferenceIds.length === 0) missingFields.push(profileField);
  if (opportunityReferenceIds === null || opportunityReferenceIds.length === 0) {
    missingFields.push(opportunityField);
  }
  if (missingFields.length > 0) return insufficient(component, "REQUIRED_INPUT_MISSING", missingFields);
  if (!validReferenceIds(profileReferenceIds as readonly string[])
    || !validReferenceIds(opportunityReferenceIds as readonly string[])) {
    return insufficient(component, "INVALID_INPUT_VALUE", [profileField, opportunityField]);
  }

  const profileIds = [...new Set(profileReferenceIds as readonly string[])].sort();
  const opportunityIds = [...new Set(opportunityReferenceIds as readonly string[])].sort();
  const opportunityIdSet = new Set(opportunityIds);
  const matchingReferenceIds = profileIds.filter((id) => opportunityIdSet.has(id));
  return {
    component,
    status: "OBSERVED",
    relation: matchingReferenceIds.length > 0 ? "SET_INTERSECTION" : "NO_SET_INTERSECTION",
    reason: "EXACT_REFERENCE_ID_COMPARISON",
    profileReferenceIds: profileIds,
    opportunityReferenceIds: opportunityIds,
    matchingReferenceIds,
  };
}

function literalSignal(
  component: "experienceLevel" | "timeCommitment",
  profileValue: string | null,
  opportunityValue: string | null,
  profileField: string,
  opportunityField: string,
): FitSignal {
  const missingFields = [
    ...(profileValue === null || profileValue.length === 0 ? [profileField] : []),
    ...(opportunityValue === null || opportunityValue.length === 0 ? [opportunityField] : []),
  ];
  if (missingFields.length > 0) return insufficient(component, "REQUIRED_INPUT_MISSING", missingFields);
  return {
    component,
    status: "OBSERVED",
    relation: profileValue === opportunityValue ? "EQUAL" : "DIFFERENT",
    reason: "LITERAL_VALUE_COMPARISON",
    profileValue: profileValue as string,
    opportunityValue: opportunityValue as string,
  };
}

function entrepreneurSignals(
  profile: EntrepreneurFitProfileInput | null,
  context: OpportunityFitInputContext,
): readonly FitSignal[] {
  const { opportunity } = context;
  const requirements = opportunity.requirements;
  return [
    budgetAffordabilitySignal(
      profile?.budgetMax,
      requirements?.capitalMin,
      "profile.budgetMax",
      "opportunity.requirements.capitalMin",
    ),
    notAssessed("priceRange"),
    referenceSignal(
      "category",
      profile?.interestCategoryIds ?? null,
      opportunity.fnbCategoryId === null ? null : [opportunity.fnbCategoryId],
      "profile.interestCategoryIds",
      "opportunity.fnbCategoryId",
    ),
    referenceSignal(
      "customerSegments",
      profile?.customerSegmentIds ?? null,
      opportunity.customerSegmentIds,
      "profile.customerSegmentIds",
      "opportunity.customerSegmentIds",
    ),
    referenceSignal(
      "salesChannels",
      profile?.salesChannelIds ?? null,
      opportunity.salesChannelIds,
      "profile.salesChannelIds",
      "opportunity.salesChannelIds",
    ),
    literalSignal(
      "experienceLevel",
      profile?.experienceLevel ?? null,
      requirements?.requiredExperienceLevel ?? null,
      "profile.experienceLevel",
      "opportunity.requirements.requiredExperienceLevel",
    ),
    literalSignal(
      "timeCommitment",
      profile?.timeCommitment ?? null,
      requirements?.requiredTimeCommitment ?? null,
      "profile.timeCommitment",
      "opportunity.requirements.requiredTimeCommitment",
    ),
    notAssessed("location"),
    notAssessed("product"),
    notAssessed("operationalFit"),
    notAssessed("brandFit"),
  ];
}

function businessCategorySignal(profile: BusinessFitProfileInput | null, context: OpportunityFitInputContext): FitSignal {
  if (profile === null) {
    return insufficient("category", "REQUIRED_INPUT_MISSING", ["profile.products[].fnbCategoryId"]);
  }

  const missingProductCategory = profile.products.some(({ fnbCategoryId }) => fnbCategoryId === null);
  const productCategoryIds = profile.products
    .map(({ fnbCategoryId }) => fnbCategoryId)
    .filter((id): id is string => id !== null);
  const opportunityCategoryIds = context.opportunity.fnbCategoryId === null
    ? null
    : [context.opportunity.fnbCategoryId];

  if (missingProductCategory) {
    return insufficient("category", "REQUIRED_INPUT_MISSING", ["profile.products[].fnbCategoryId"]);
  }
  return referenceSignal(
    "category",
    productCategoryIds,
    opportunityCategoryIds,
    "profile.products[].fnbCategoryId",
    "opportunity.fnbCategoryId",
  );
}

function businessSignals(
  profile: BusinessFitProfileInput | null,
  context: OpportunityFitInputContext,
): readonly FitSignal[] {
  const { opportunity } = context;
  const requirements = opportunity.requirements;
  return [
    notAssessed("budgetAffordability"),
    rangeSignal(
      "priceRange",
      profile === null ? null : { min: profile.averagePriceMin, max: profile.averagePriceMax },
      requirements === null ? null : { min: requirements.expectedPriceMin, max: requirements.expectedPriceMax },
      ["profile.averagePriceMin", "profile.averagePriceMax"],
      ["opportunity.requirements.expectedPriceMin", "opportunity.requirements.expectedPriceMax"],
    ),
    businessCategorySignal(profile, context),
    referenceSignal(
      "customerSegments",
      profile?.customerSegmentIds ?? null,
      opportunity.customerSegmentIds,
      "profile.customerSegmentIds",
      "opportunity.customerSegmentIds",
    ),
    referenceSignal(
      "salesChannels",
      profile?.salesChannelIds ?? null,
      opportunity.salesChannelIds,
      "profile.salesChannelIds",
      "opportunity.salesChannelIds",
    ),
    notAssessed("experienceLevel"),
    notAssessed("timeCommitment"),
    notAssessed("location"),
    notAssessed("product"),
    notAssessed("operationalFit"),
    notAssessed("brandFit"),
  ];
}

export function extractFitSignals(context: OpportunityFitInputContext): FitSignalExtractionResult {
  if (context.userType === "ENTREPRENEUR") {
    return { modelType: "ENTREPRENEUR_FIT", signals: entrepreneurSignals(context.profile, context) };
  }
  return { modelType: "BUSINESS_FIT", signals: businessSignals(context.profile, context) };
}
