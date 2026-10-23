import { z } from "zod";

export const ENTREPRENEUR_ANALYSIS_VERSION = "entrepreneur-decision-v2" as const;
export const ENTREPRENEUR_REQUIREMENTS_PROMPT_VERSION = "entrepreneur-requirements-v2.1" as const;
const text = z.string().trim().min(1).max(500);
const experience = z.enum(["BEGINNER", "SOME_EXPERIENCE", "EXPERIENCED"]);
const time = z.enum(["LIMITED", "PART_TIME", "FULL_TIME"]);

export const entrepreneurRequirementsSchema = z.object({
  categoryId: z.string().uuid().nullable(),
  customerSegmentIds: z.array(z.string().uuid()).max(3),
  salesChannelIds: z.array(z.string().uuid()).max(3),
  requiredExperience: experience.nullable(),
  requiredTime: time.nullable(),
  complexity: z.enum(["SIMPLE", "STANDARD", "COMPLEX"]).nullable(),
  summary: text,
  rationale: text,
  initialNeeds: z.array(text).min(1).max(4),
  assumptions: z.array(text).min(1).max(4),
}).strict();
export type EntrepreneurRequirements = z.infer<typeof entrepreneurRequirementsSchema>;

export function requirementsSchemaForCatalog(options: { categories: readonly { id: string }[]; segments: readonly { id: string }[]; channels: readonly { id: string }[] }) {
  const ids = (values: readonly { id: string }[]) => z.enum(values.length ? values.map(value => value.id) as [string, ...string[]] : ["__NO_ACTIVE_REFERENCE__"]);
  return entrepreneurRequirementsSchema.extend({
    categoryId: ids(options.categories).nullable(),
    customerSegmentIds: z.array(ids(options.segments)).max(3),
    salesChannelIds: z.array(ids(options.channels)).max(3),
  }).strict();
}

export const analysisFactorSchema = z.object({
  key: z.string().min(1).max(50), label: text,
  value: z.number().finite().min(0).max(100).nullable(),
  weight: z.number().min(0).max(1),
  basis: z.enum(["MARKET", "PROFILE_ALIGNMENT", "MODEL_ASSUMPTION", "USER_ESTIMATE", "MISSING"]),
  reason: text,
}).strict();
export type AnalysisFactor = z.infer<typeof analysisFactorSchema>;
export const analysisScoreSchema = z.object({
  score: z.number().finite().min(0).max(100).nullable(),
  coverage: z.number().min(0).max(100),
  status: z.enum(["PRELIMINARY", "INSUFFICIENT_DATA"]),
  factors: z.array(analysisFactorSchema).min(1).max(6),
}).strict();
export type AnalysisScore = z.infer<typeof analysisScoreSchema>;

export const trendStatisticsSchema = z.object({
  query: z.string().min(1).max(250), geo: z.string().max(9), period: z.literal("1y"),
  retrievedAt: z.string().datetime(), count: z.number().int().nonnegative(),
  observedMonths: z.number().int().min(0).max(13),
  spanDays: z.number().nonnegative(), recentMean: z.number().min(0).max(100).nullable(),
  previousMean: z.number().min(0).max(100).nullable(),
  positiveFraction: z.number().min(0).max(1).nullable(),
  coefficientOfVariation: z.number().finite().nonnegative().nullable(),
}).strict();
export type TrendStatistics = z.infer<typeof trendStatisticsSchema>;

export const competitorSampleSchema = z.object({
  query: z.string().min(1).max(350), city: z.string().min(1).max(120), retrievedAt: z.string().datetime(),
  sampleCount: z.number().int().min(0).max(20),
  places: z.array(z.object({ name: text, address: text, url: z.string().url().max(2048) }).strict()).max(5),
  diagnostics: z.object({
    receivedCount: z.number().int().nonnegative(), inspectedCount: z.number().int().min(0).max(20),
    invalidCount: z.number().int().min(0).max(20), outsideCityCount: z.number().int().min(0).max(20), duplicateCount: z.number().int().min(0).max(20),
  }).strict().optional(),
}).strict();
export type CompetitorSample = z.infer<typeof competitorSampleSchema>;

export const entrepreneurAnalysisSchema = z.object({
  version: z.literal(ENTREPRENEUR_ANALYSIS_VERSION),
  generatedAt: z.string().datetime(), inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
  model: z.string().min(1).max(120).nullable(),
  promptVersion: z.string().min(1).max(80).optional(),
  requirements: entrepreneurRequirementsSchema.nullable(),
  planningContext: z.object({ timeCommitment: time.nullable() }).strict().optional(),
  referenceLabels: z.object({ category: text.nullable(), channels: z.array(text).max(3) }).strict().optional(),
  capitalMin: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
  opportunity: analysisScoreSchema, fit: analysisScoreSchema,
  targetConsumer: text,
  competition: text, risks: z.array(text).min(1).max(6),
  trend: trendStatisticsSchema.nullable(), competitors: competitorSampleSchema.nullable(),
  warnings: z.array(text).max(8),
}).strict();
export type EntrepreneurAnalysis = z.infer<typeof entrepreneurAnalysisSchema>;

export const entrepreneurAnalysisRequestSchema = z.object({
  consent: z.literal(true), refresh: z.boolean().optional(),
  capitalMin: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable().optional(),
}).strict();
