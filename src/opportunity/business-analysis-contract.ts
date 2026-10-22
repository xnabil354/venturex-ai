import { z } from "zod";
import { analysisScoreSchema, competitorSampleSchema, trendStatisticsSchema, entrepreneurRequirementsSchema } from "./entrepreneur-analysis-contract";

export const BUSINESS_ANALYSIS_VERSION = "business-decision-v1" as const;
export const BUSINESS_CONCEPT_ALIGNMENT_VERSION = "business-concept-alignment-v1" as const;
export const businessRequirementsSchema = entrepreneurRequirementsSchema.omit({ requiredExperience: true, requiredTime: true });
export const businessPriceSchema = z.object({ min: z.number().int().safe().nonnegative(), max: z.number().int().safe().nonnegative() }).strict().refine(v => v.max >= v.min);
export const businessAnalysisRequestSchema = z.object({ consent: z.literal(true), refresh: z.boolean().optional(), proposedPrice: businessPriceSchema.nullable().optional() }).strict();
export const businessAnalysisSchema = z.object({
  version: z.literal(BUSINESS_ANALYSIS_VERSION), generatedAt: z.string().datetime(), inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
  model: z.string().max(120).nullable(), requirements: businessRequirementsSchema.nullable(), proposedPrice: businessPriceSchema.nullable(),
  conceptAlignmentVersion: z.literal(BUSINESS_CONCEPT_ALIGNMENT_VERSION).optional(),
  planningContext: z.object({ businessName: z.string().max(180), products: z.array(z.string().max(180)).max(20), channels: z.array(z.string().max(120)).max(100) }).strict().optional(),
  opportunity: analysisScoreSchema, fit: analysisScoreSchema,
  risk: z.object({ level: z.enum(["LOW", "MEDIUM", "HIGH", "UNKNOWN"]), reasons: z.array(z.string().min(1).max(500)).min(1).max(6) }).strict(),
  targetConsumer: z.string().min(1).max(500), competition: z.string().min(1).max(500),
  trend: trendStatisticsSchema.nullable(), competitors: competitorSampleSchema.nullable(), warnings: z.array(z.string().max(500)).max(8),
}).strict();
export type BusinessAnalysis = z.infer<typeof businessAnalysisSchema>;
export type BusinessRequirements = z.infer<typeof businessRequirementsSchema>;
export function hasVerifiedBusinessConcept(analysis: BusinessAnalysis | undefined): analysis is BusinessAnalysis {
  return Boolean(analysis?.requirements && analysis.conceptAlignmentVersion === BUSINESS_CONCEPT_ALIGNMENT_VERSION);
}
export const privateGrowthRoadmapSchema = z.object({
  version: z.literal("private-growth-v1"), createdAt: z.string().datetime(), sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
  steps: z.array(z.object({ stage: z.string().min(1).max(100), action: z.string().min(1).max(1500), objective: z.string().min(1).max(600), timeline: z.string().min(1).max(300), expectedOutput: z.string().min(1).max(600) }).strict()).length(5),
}).strict();
