import { z } from "zod";

import { opportunitySearchApiSourceReferenceSchema } from "./searchapi-evidence-contract";
import { entrepreneurAnalysisSchema } from "./entrepreneur-analysis-contract";
import { privateStartupRoadmapSchema } from "../roadmap/private-startup-contract";
import { businessAnalysisSchema, privateGrowthRoadmapSchema } from "./business-analysis-contract";

export const ENTREPRENEUR_OPPORTUNITY_TYPES = [
  "PRODUCT_CONCEPT",
  "BUSINESS_CONCEPT",
  "ADJACENT_MARKET",
  "SALES_CHANNEL_EXPERIMENT",
  "POSITIONING_EXPERIMENT",
] as const;

export const UMKM_EXISTING_OPPORTUNITY_TYPES = [
  "NEW_MENU",
  "NEW_VARIANT",
  "PRODUCT_EXTENSION",
  "ADJACENT_MARKET",
  "SALES_CHANNEL_EXPERIMENT",
  "POSITIONING_EXPERIMENT",
] as const;

export const opportunityTypeValuesByPersona = {
  ENTREPRENEUR: ENTREPRENEUR_OPPORTUNITY_TYPES,
  UMKM_EXISTING: UMKM_EXISTING_OPPORTUNITY_TYPES,
} as const;

export type OpportunityPersona = keyof typeof opportunityTypeValuesByPersona;

export const opportunityTypeSchema = z.enum([
  "PRODUCT_CONCEPT",
  "BUSINESS_CONCEPT",
  "NEW_MENU",
  "NEW_VARIANT",
  "PRODUCT_EXTENSION",
  "ADJACENT_MARKET",
  "SALES_CHANNEL_EXPERIMENT",
  "POSITIONING_EXPERIMENT",
]);

export function opportunityTypeValuesForPersona(persona: OpportunityPersona) {
  return opportunityTypeValuesByPersona[persona];
}

export function opportunityTypeSchemaForPersona(persona: OpportunityPersona) {
  return persona === "ENTREPRENEUR"
    ? z.enum(ENTREPRENEUR_OPPORTUNITY_TYPES)
    : z.enum(UMKM_EXISTING_OPPORTUNITY_TYPES);
}

export const OPPORTUNITY_HYPOTHESIS_LIMITS = {
  title: { min: 4, max: 140 },
  concept: { min: 20, max: 1_200 },
  targetCustomer: { min: 8, max: 500 },
  validationSteps: { itemMin: 8, itemMax: 500, minItems: 2, maxItems: 5 },
  assumptions: { itemMin: 8, itemMax: 500, minItems: 1, maxItems: 4 },
  profileAlignment: { itemMin: 8, itemMax: 400, minItems: 1, maxItems: 5 },
  profileReferences: { itemMin: 1, itemMax: 80, minItems: 1, maxItems: 10 },
  evidenceInterpretation: { min: 12, max: 600 },
  evidenceReferences: { itemMin: 1, itemMax: 100, minItems: 1, maxItems: 3 },
  evidenceGaps: { itemMin: 8, itemMax: 400, minItems: 1, maxItems: 5 },
  evidenceGapIds: { itemMin: 8, itemMax: 120, minItems: 1, maxItems: 5 },
  limitations: { itemMin: 8, itemMax: 400, minItems: 1, maxItems: 5 },
  ideas: { minItems: 1, maxItems: 3 },
  insufficientReason: { min: 20, max: 500 },
} as const;

const hypothesisText = (minimum: number, maximum: number) => z.string().trim().min(minimum).max(maximum);

const hypothesisBaseSchema = z.object({
  title: z.string().trim().min(OPPORTUNITY_HYPOTHESIS_LIMITS.title.min).max(OPPORTUNITY_HYPOTHESIS_LIMITS.title.max),
  concept: z.string().trim().min(OPPORTUNITY_HYPOTHESIS_LIMITS.concept.min).max(OPPORTUNITY_HYPOTHESIS_LIMITS.concept.max),
  targetCustomer: z.string().trim().min(OPPORTUNITY_HYPOTHESIS_LIMITS.targetCustomer.min).max(OPPORTUNITY_HYPOTHESIS_LIMITS.targetCustomer.max),
  validationSteps: z.array(z.string().trim().min(OPPORTUNITY_HYPOTHESIS_LIMITS.validationSteps.itemMin).max(OPPORTUNITY_HYPOTHESIS_LIMITS.validationSteps.itemMax))
    .min(OPPORTUNITY_HYPOTHESIS_LIMITS.validationSteps.minItems).max(OPPORTUNITY_HYPOTHESIS_LIMITS.validationSteps.maxItems),
  assumptions: z.array(z.string().trim().min(OPPORTUNITY_HYPOTHESIS_LIMITS.assumptions.itemMin).max(OPPORTUNITY_HYPOTHESIS_LIMITS.assumptions.itemMax))
    .min(OPPORTUNITY_HYPOTHESIS_LIMITS.assumptions.minItems).max(OPPORTUNITY_HYPOTHESIS_LIMITS.assumptions.maxItems),
});

const hypothesisEnrichmentSchema = {
  opportunityType: opportunityTypeSchema.optional(),
  profileAlignment: z.array(hypothesisText(OPPORTUNITY_HYPOTHESIS_LIMITS.profileAlignment.itemMin, OPPORTUNITY_HYPOTHESIS_LIMITS.profileAlignment.itemMax))
    .min(OPPORTUNITY_HYPOTHESIS_LIMITS.profileAlignment.minItems).max(OPPORTUNITY_HYPOTHESIS_LIMITS.profileAlignment.maxItems).optional(),
  profileReferences: z.array(hypothesisText(OPPORTUNITY_HYPOTHESIS_LIMITS.profileReferences.itemMin, OPPORTUNITY_HYPOTHESIS_LIMITS.profileReferences.itemMax))
    .min(OPPORTUNITY_HYPOTHESIS_LIMITS.profileReferences.minItems).max(OPPORTUNITY_HYPOTHESIS_LIMITS.profileReferences.maxItems).optional(),
  evidenceInterpretation: hypothesisText(OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceInterpretation.min, OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceInterpretation.max).optional(),
  evidenceReferences: z.array(hypothesisText(OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceReferences.itemMin, OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceReferences.itemMax))
    .min(OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceReferences.minItems).max(OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceReferences.maxItems).optional(),
  evidenceGaps: z.array(hypothesisText(OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceGaps.itemMin, OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceGaps.itemMax))
    .min(OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceGaps.minItems).max(OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceGaps.maxItems).optional(),
  limitations: z.array(hypothesisText(OPPORTUNITY_HYPOTHESIS_LIMITS.limitations.itemMin, OPPORTUNITY_HYPOTHESIS_LIMITS.limitations.itemMax))
    .min(OPPORTUNITY_HYPOTHESIS_LIMITS.limitations.minItems).max(OPPORTUNITY_HYPOTHESIS_LIMITS.limitations.maxItems).optional(),
} as const;

export const generatedProfileAlignmentSchema = z.object({
  rationale: hypothesisText(OPPORTUNITY_HYPOTHESIS_LIMITS.profileAlignment.itemMin, OPPORTUNITY_HYPOTHESIS_LIMITS.profileAlignment.itemMax),
  supportingProfileRefs: z.array(z.string().trim().min(1).max(OPPORTUNITY_HYPOTHESIS_LIMITS.profileReferences.itemMax))
    .min(1).max(OPPORTUNITY_HYPOTHESIS_LIMITS.profileReferences.maxItems),
}).strict();

export const privateOpportunityHypothesisSchema = hypothesisBaseSchema.extend(hypothesisEnrichmentSchema).extend({
  analysis: entrepreneurAnalysisSchema.optional(),
  startupRoadmap: privateStartupRoadmapSchema.optional(),
  businessAnalysis: businessAnalysisSchema.optional(),
  growthRoadmap: privateGrowthRoadmapSchema.optional(),
}).strict();

export const generatedOpportunityHypothesisSchema = hypothesisBaseSchema.extend({
  opportunityType: opportunityTypeSchema,
  profileAlignment: z.array(generatedProfileAlignmentSchema)
    .min(OPPORTUNITY_HYPOTHESIS_LIMITS.profileAlignment.minItems).max(OPPORTUNITY_HYPOTHESIS_LIMITS.profileAlignment.maxItems),
  profileReferences: z.array(hypothesisText(OPPORTUNITY_HYPOTHESIS_LIMITS.profileReferences.itemMin, OPPORTUNITY_HYPOTHESIS_LIMITS.profileReferences.itemMax))
    .min(OPPORTUNITY_HYPOTHESIS_LIMITS.profileReferences.minItems).max(OPPORTUNITY_HYPOTHESIS_LIMITS.profileReferences.maxItems),
  evidenceInterpretation: hypothesisText(OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceInterpretation.min, OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceInterpretation.max),
  evidenceReferences: z.array(hypothesisText(OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceReferences.itemMin, OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceReferences.itemMax))
    .min(OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceReferences.minItems).max(OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceReferences.maxItems),
  evidenceGapIds: z.array(hypothesisText(OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceGapIds.itemMin, OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceGapIds.itemMax))
    .min(OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceGapIds.minItems).max(OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceGapIds.maxItems),
  limitations: z.array(hypothesisText(OPPORTUNITY_HYPOTHESIS_LIMITS.limitations.itemMin, OPPORTUNITY_HYPOTHESIS_LIMITS.limitations.itemMax))
    .min(OPPORTUNITY_HYPOTHESIS_LIMITS.limitations.minItems).max(OPPORTUNITY_HYPOTHESIS_LIMITS.limitations.maxItems),
}).strict();

export type PrivateOpportunityHypothesis = z.infer<typeof privateOpportunityHypothesisSchema>;

const legacyPrivateOpportunitySourceSchema = z.object({
  snapshotId: z.string().uuid(),
  signalId: z.string().uuid(),
  title: z.string().trim().min(1).max(180),
  publisher: z.literal("Google Trends"),
  transport: z.literal("Bright Data SERP API"),
  url: z.literal("https://trends.google.com/trending?geo=ID&hl=id&brd_json=1"),
  retrievedAt: z.string().datetime(),
  classification: z.enum(["LIKELY_FNB", "REVIEW_REQUIRED"]),
}).strict();

export const privateOpportunitySourceSchema = z.union([
  legacyPrivateOpportunitySourceSchema,
  opportunitySearchApiSourceReferenceSchema,
]);

export type PrivateOpportunitySource = z.infer<typeof privateOpportunitySourceSchema>;

export const privateOpportunityModelSchema = z.string().trim().min(1).max(120);

export const privateOpportunityIdeaResponseSchema = z.object({
  id: z.string().uuid(),
  hypothesis: privateOpportunityHypothesisSchema,
  source: privateOpportunitySourceSchema,
  provider: z.literal("ninerouter"),
  model: privateOpportunityModelSchema,
  generatedAt: z.string().datetime(),
  saved: z.boolean(),
}).strict();

export type PrivateOpportunityIdeaDto = z.infer<typeof privateOpportunityIdeaResponseSchema>;

export const privateOpportunityGenerationResponseSchema = z.discriminatedUnion("outcome", [
  z.object({
    data: z.array(privateOpportunityIdeaResponseSchema).min(1).max(3),
    outcome: z.literal("HYPOTHESES"),
  }).passthrough(),
  z.object({
    data: z.array(z.never()).length(0),
    outcome: z.literal("INSUFFICIENT_EVIDENCE"),
    reason: z.string().trim().min(20).max(500),
    limitations: z.array(z.string().trim().min(8).max(400)).min(1).max(5),
  }).passthrough(),
]);
