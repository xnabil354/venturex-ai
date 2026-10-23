import { z } from "zod";

const metricValueSchema = z.union([z.number().finite(), z.string().max(120)]).nullable();
const timeWindowHoursSchema = z.union([z.literal(4), z.literal(24), z.literal(48), z.literal(168)]);
const googleTrendsTargetUrlSchema = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.origin === "https://trends.google.com" && url.pathname === "/trending";
}, "Source URL must point to Google Trends Trending Now");

export const liveTrendSignalSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(180),
  classification: z.enum(["LIKELY_FNB", "REVIEW_REQUIRED"]),
  matchedKeywords: z.array(z.string().min(1).max(80)).max(20),
  screeningExplanation: z.string().min(1).max(500),
  observationCount: z.number().int().positive(),
  source: z.object({
    publisher: z.literal("Google Trends"),
    url: googleTrendsTargetUrlSchema,
    geo: z.literal("ID"),
    retrievedAt: z.string().datetime(),
    providerStartedAtUnixSeconds: z.number().int().nonnegative().safe(),
    timeWindowHours: timeWindowHoursSchema,
  }).strict(),
  metrics: z.object({
    volume: z.object({ availability: z.enum(["AVAILABLE", "UNAVAILABLE"]), value: metricValueSchema, unit: z.literal("UNSPECIFIED") }).strict(),
    volumeChange: z.object({ availability: z.enum(["AVAILABLE", "UNAVAILABLE"]), value: metricValueSchema, unit: z.literal("UNSPECIFIED") }).strict(),
    active: z.object({ value: z.boolean(), semantics: z.literal("PROVIDER_FLAG_UNVERIFIED") }).strict(),
    categoriesCount: z.number().int().nonnegative(),
    relatedQueries: z.enum(["AVAILABLE", "UNAVAILABLE"]),
  }).strict(),
  limitations: z.array(z.string().min(1).max(400)).min(1).max(8),
}).strict();

export const liveTrendSignalsResponseSchema = z.object({
  snapshotId: z.string().uuid(),
  mode: z.enum(["LIVE_PROVIDER", "MOCK_TEST"]),
  generatedAt: z.string().datetime(),
  retrievedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  batchStatus: z.enum(["COMPLETE", "PARTIAL"]),
  freshness: z.enum(["CURRENT", "STALE"]),
  cache: z.enum(["NETWORK", "COALESCED", "CACHE"]),
  source: z.object({
    publisher: z.literal("Google Trends"),
    geo: z.literal("ID"),
    timeWindowHours: timeWindowHoursSchema,
    url: googleTrendsTargetUrlSchema,
  }).strict(),
  records: z.object({
    retrieved: z.number().int().nonnegative(),
    accepted: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
  }).strict(),
  relatedQueriesAvailability: z.object({
    available: z.number().int().nonnegative(),
    unavailable: z.number().int().nonnegative(),
    invalid: z.number().int().nonnegative(),
    uninspectable: z.number().int().nonnegative(),
  }).strict(),
  screening: z.object({
    inputRecords: z.number().int().nonnegative(),
    acceptedParsedRecords: z.number().int().nonnegative(),
    rejectedParsedRecords: z.number().int().nonnegative(),
    uniqueScreenedGroups: z.number().int().nonnegative(),
    classifications: z.object({
      LIKELY_FNB: z.number().int().nonnegative(),
      REVIEW_REQUIRED: z.number().int().nonnegative(),
      OUT_OF_SCOPE: z.number().int().nonnegative(),
    }).strict(),
  }).strict(),
  signals: z.array(liveTrendSignalSchema).max(40),
  analysisAvailability: z.object({
    status: z.enum(["AVAILABLE", "BLOCKED"]),
    reason: z.enum([
      "READY",
      "AI_FEATURE_DISABLED",
      "AI_PROVIDER_CONFIGURATION_UNAVAILABLE",
      "SOURCE_PROCESSING_NOT_APPROVED",
    ]),
  }).strict(),
  cacheLimitations: z.array(z.string().min(1).max(300)).min(1).max(4),
}).strict();

export type LiveTrendSignal = z.infer<typeof liveTrendSignalSchema>;
export type LiveTrendSignalsResponse = z.infer<typeof liveTrendSignalsResponseSchema>;

export const liveTrendAnalysisRequestSchema = z.object({
  snapshotId: z.string().uuid(),
  signalId: z.string().uuid(),
  consent: z.literal(true),
  disclosureVersion: z.literal("trends-ninerouter-profile-v2"),
}).strict();

export const liveTrendAnalysisResponseSchema = z.object({
  analysis: z.object({
    summary: z.string().min(1).max(1200),
    whyRelevant: z.string().min(1).max(1800),
    targetConsumer: z.string().min(1).max(1500),
    competition: z.string().min(1).max(1500),
    potential: z.string().min(1).max(1800),
    risks: z.array(z.string().min(1).max(700)).min(1).max(6),
    nextAction: z.string().min(1).max(1200),
  }).strict(),
  provider: z.literal("ninerouter"),
  model: z.literal("cx/gpt-6-luna-xhigh"),
  mode: z.enum(["LIVE_PROVIDER", "MOCK_TEST"]),
  generatedAt: z.string().datetime(),
  sourceReference: z.object({
    title: z.string().min(1).max(180),
    publisher: z.literal("Google Trends"),
    url: googleTrendsTargetUrlSchema,
    retrievedAt: z.string().datetime(),
    classification: z.enum(["LIKELY_FNB", "REVIEW_REQUIRED"]),
  }).strict(),
  limitations: z.array(z.string().min(1).max(400)).min(1).max(8),
}).strict();

export type LiveTrendAnalysisRequest = z.infer<typeof liveTrendAnalysisRequestSchema>;
export type LiveTrendAnalysisResponse = z.infer<typeof liveTrendAnalysisResponseSchema>;
