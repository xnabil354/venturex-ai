import { z } from "zod";

import {
  generatedOpportunityHypothesisSchema,
  OPPORTUNITY_HYPOTHESIS_LIMITS,
  opportunityTypeSchema,
} from "./private-hypothesis";
import type { OpportunityAnalysisContext } from "./opportunity-analysis-context";

const insufficientEvidenceSchema = z.object({
  outcome: z.literal("INSUFFICIENT_EVIDENCE"),
  reason: z.string().trim().min(OPPORTUNITY_HYPOTHESIS_LIMITS.insufficientReason.min).max(OPPORTUNITY_HYPOTHESIS_LIMITS.insufficientReason.max),
  limitations: z.array(z.string().trim().min(OPPORTUNITY_HYPOTHESIS_LIMITS.limitations.itemMin).max(OPPORTUNITY_HYPOTHESIS_LIMITS.limitations.itemMax))
    .min(OPPORTUNITY_HYPOTHESIS_LIMITS.limitations.minItems).max(OPPORTUNITY_HYPOTHESIS_LIMITS.limitations.maxItems),
}).strict();

const hypothesesSchema = z.object({
  outcome: z.literal("HYPOTHESES"),
  ideas: z.array(generatedOpportunityHypothesisSchema)
    .min(OPPORTUNITY_HYPOTHESIS_LIMITS.ideas.minItems).max(OPPORTUNITY_HYPOTHESIS_LIMITS.ideas.maxItems),
}).strict();

export const generatedOpportunityResultSchema = z.discriminatedUnion("outcome", [
  hypothesesSchema,
  insufficientEvidenceSchema,
]);

export type GeneratedOpportunityResult = z.infer<typeof generatedOpportunityResultSchema>;

const diagnosticStringField = (path: string, minLength: number, maxLength: number) => ({
  path, typeCategory: "string" as const, required: true, nullable: false, minLength, maxLength,
});
const diagnosticStringArray = (path: string, bounds: Readonly<{ itemMin: number; itemMax: number; minItems: number; maxItems: number }>) => [
  { path, typeCategory: "array" as const, required: true, nullable: false, minItems: bounds.minItems, maxItems: bounds.maxItems },
  diagnosticStringField(path + "[]", bounds.itemMin, bounds.itemMax),
];

export const generatedOpportunityDiagnosticContract = {
  fields: [
    { path: "outcome", typeCategory: "enum", required: true, nullable: false, allowedValues: ["HYPOTHESES", "INSUFFICIENT_EVIDENCE"] },
    { path: "ideas", typeCategory: "array", required: true, nullable: false, minItems: OPPORTUNITY_HYPOTHESIS_LIMITS.ideas.minItems, maxItems: OPPORTUNITY_HYPOTHESIS_LIMITS.ideas.maxItems },
    { path: "ideas[]", typeCategory: "object", required: true, nullable: false },
    diagnosticStringField("ideas[].title", OPPORTUNITY_HYPOTHESIS_LIMITS.title.min, OPPORTUNITY_HYPOTHESIS_LIMITS.title.max),
    { path: "ideas[].opportunityType", typeCategory: "enum", required: true, nullable: false, allowedValues: opportunityTypeSchema.options },
    diagnosticStringField("ideas[].concept", OPPORTUNITY_HYPOTHESIS_LIMITS.concept.min, OPPORTUNITY_HYPOTHESIS_LIMITS.concept.max),
    diagnosticStringField("ideas[].targetCustomer", OPPORTUNITY_HYPOTHESIS_LIMITS.targetCustomer.min, OPPORTUNITY_HYPOTHESIS_LIMITS.targetCustomer.max),
    ...diagnosticStringArray("ideas[].validationSteps", OPPORTUNITY_HYPOTHESIS_LIMITS.validationSteps),
    ...diagnosticStringArray("ideas[].assumptions", OPPORTUNITY_HYPOTHESIS_LIMITS.assumptions),
    { path: "ideas[].profileAlignment", typeCategory: "array", required: true, nullable: false, minItems: OPPORTUNITY_HYPOTHESIS_LIMITS.profileAlignment.minItems, maxItems: OPPORTUNITY_HYPOTHESIS_LIMITS.profileAlignment.maxItems },
    { path: "ideas[].profileAlignment[]", typeCategory: "object", required: true, nullable: false },
    diagnosticStringField("ideas[].profileAlignment[].rationale", OPPORTUNITY_HYPOTHESIS_LIMITS.profileAlignment.itemMin, OPPORTUNITY_HYPOTHESIS_LIMITS.profileAlignment.itemMax),
    { path: "ideas[].profileAlignment[].supportingProfileRefs", typeCategory: "array", required: true, nullable: false, minItems: 1, maxItems: OPPORTUNITY_HYPOTHESIS_LIMITS.profileReferences.maxItems },
    diagnosticStringField("ideas[].profileAlignment[].supportingProfileRefs[]", 1, OPPORTUNITY_HYPOTHESIS_LIMITS.profileReferences.itemMax),
    ...diagnosticStringArray("ideas[].profileReferences", OPPORTUNITY_HYPOTHESIS_LIMITS.profileReferences),
    diagnosticStringField("ideas[].evidenceInterpretation", OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceInterpretation.min, OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceInterpretation.max),
    ...diagnosticStringArray("ideas[].evidenceReferences", OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceReferences),
    ...diagnosticStringArray("ideas[].evidenceGapIds", OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceGapIds),
    ...diagnosticStringArray("ideas[].limitations", OPPORTUNITY_HYPOTHESIS_LIMITS.limitations),
    diagnosticStringField("reason", OPPORTUNITY_HYPOTHESIS_LIMITS.insufficientReason.min, OPPORTUNITY_HYPOTHESIS_LIMITS.insufficientReason.max),
    { path: "limitations", typeCategory: "array", required: true, nullable: false, minItems: OPPORTUNITY_HYPOTHESIS_LIMITS.limitations.minItems, maxItems: OPPORTUNITY_HYPOTHESIS_LIMITS.limitations.maxItems },
    ...diagnosticStringArray("limitations", OPPORTUNITY_HYPOTHESIS_LIMITS.limitations).slice(1),
  ],
} as const;

export type NumericProvenanceCategory =
  | "GOOGLE_TRENDS_INTEREST_INDEX"
  | "GOOGLE_TRENDS_GROWTH_PERCENT"
  | "GOOGLE_TRENDS_TIME_RANGE"
  | "GOOGLE_TRENDS_RETRIEVAL_DATE"
  | "GOOGLE_TRENDS_POSITION"
  | "PROFILE_BUDGET"
  | "PROFILE_PRODUCT_PRICE"
  | "PROFILE_AVERAGE_PRICE"
  | "UNSUPPORTED_BUSINESS_CLAIM"
  | "OTHER_CONTEXTUAL_NUMBER";

export const OPPORTUNITY_NUMERIC_GROUNDING_CONTRACT_VERSION = "numeric-grounding-v6" as const;

export type NumericSemanticCategory =
  | "VERIFIED_SOURCE_FACT"
  | "DECLARED_PROFILE_FACT"
  | "PROPOSED_EXPERIMENT_PARAMETER"
  | "DATA_COLLECTION_REQUIREMENT"
  | "ORDINAL_OR_PRODUCT_LABEL"
  | "MISSING_EVIDENCE_REQUIREMENT"
  | "DERIVED_VERIFIABLE_VALUE"
  | "UNSUPPORTED_EMPIRICAL_CLAIM"
  | "UNSUPPORTED_FINANCIAL_CLAIM"
  | "AMBIGUOUS_NUMERIC_STATEMENT";

export type NumericGroundingDiagnostic = Readonly<{
  fieldPath: string;
  rejectedRule: "UNSUPPORTED_NUMBER" | "UNSUPPORTED_FINANCIAL_CLAIM" | "UNSUPPORTED_METRIC_CLAIM";
  semanticCategory: NumericSemanticCategory;
  expectedMetricCategory: NumericProvenanceCategory;
  futureAction: boolean;
  verifiedSourceMatch: boolean;
  unitClassification: "DATE" | "CURRENCY" | "PERCENT" | "TIME_RANGE" | "COUNT" | "INTEREST_INDEX" | "POSITION" | "PROFILE_AMOUNT" | "ORDINAL" | "PRODUCT_LABEL" | "OTHER";
  spanIndex: number;
  reason: "FINANCIAL_CLAIM_WITHOUT_MATCHING_SOURCE" | "UNSUPPORTED_COUNT_CLAIM" | "UNSUPPORTED_FINANCIAL_ASSERTION" | "NO_SOURCE_OR_PROSPECTIVE_CONTEXT" | "AMBIGUOUS_NUMERIC_MEANING";
  subjectCategory?: "BUSINESS" | "PRODUCT_SET" | "EXISTING_PRODUCT" | "PROPOSED_PRODUCT" | "COMPETITOR" | "CUSTOMER" | "BUSINESS_OPERATIONS" | "PROFILE_FIELD";
  expectedSourceFieldExists?: boolean;
  matchingSourceReferenceExists?: boolean;
  validationResult?: "MATCHED_PROFILE_SOURCE" | "REJECTED_NO_MATCHING_PROFILE_SOURCE";
  correlationId?: string | null;
  analysisContextVersion?: string;
  promptVersion?: string;
  groundingContractVersion?: typeof OPPORTUNITY_NUMERIC_GROUNDING_CONTRACT_VERSION;
}>;

export type OpportunityGroundingFailure = Readonly<{
  rejectedRule:
    | "UNSUPPORTED_NUMBER"
    | "UNSUPPORTED_GUARANTEE"
    | "UNSUPPORTED_FINANCIAL_CLAIM"
    | "UNSUPPORTED_METRIC_CLAIM"
    | "PERSONA_MISMATCH"
    | "INVALID_PROFILE_REFERENCE"
    | "INVALID_EVIDENCE_REFERENCE"
    | "INVALID_EVIDENCE_GAP_REFERENCE"
    | "EXISTING_PRODUCT_AS_NEW_MENU";
  fields: readonly string[];
  semanticCategory?: NumericSemanticCategory;
  numericDiagnostics?: readonly NumericGroundingDiagnostic[];
  sourceCategory?: OpportunityAnalysisContext["evidence"]["sourceType"];
  sourceReference?: string;
  financialMetric?: FinancialMetric;
  financialEvidenceAvailable?: boolean;
  isMissingDataDescription?: boolean;
  claimClassification?: FinancialClaimClassification;
}>;

export type FinancialMetric =
  | "REVENUE"
  | "PROFIT"
  | "MARGIN"
  | "ROI"
  | "OPERATING_COST"
  | "UNIT_COST"
  | "PRODUCT_PRICE"
  | "BUDGET"
  | "TRANSACTION_COUNT"
  | "SALES_VOLUME"
  | "AVERAGE_BUSINESS_PRICE"
  | "PROPOSED_PRODUCT_PRICE"
  | "COMPETITOR_PRICE"
  | "CUSTOMER_WILLINGNESS_TO_PAY"
  | "PRODUCTION_COST"
  | "MARKET_METRIC";

export type FinancialClaimClassification =
  | "MISSING_FINANCIAL_DATA"
  | "PROPOSED_FINANCIAL_VALIDATION"
  | "UNSUPPORTED_FINANCIAL_ASSERTION"
  | "UNSUPPORTED_FINANCIAL_FORECAST"
  | "PROFILE_VALUE_MISSTATED_AS_MISSING";

