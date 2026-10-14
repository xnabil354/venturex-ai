import { z } from "zod";

const source = z.object({
  publisher: z.literal("Google"),
  transport: z.literal("Bright Data SERP API"),
  name: z.literal("Google Trends Trending Now"),
  region: z.literal("Indonesia"),
  reference: z.literal("https://trends.google.com/trending?geo=ID&hl=id&brd_json=1"),
}).strict();

const displayLimit = z.object({
  content: z.literal("PRIVATE_LOOPBACK_PREVIEW"),
  reason: z.literal("Konten hanya ditampilkan sementara pada demo loopback lokal; izin distribusi publik belum dievaluasi."),
}).strict();

const sourceContext = {
  source,
  observationPeriod: z.object({
    status: z.literal("UNAVAILABLE"),
    reason: z.literal("Periode observasi tidak dapat disimpulkan dari waktu mulai topik."),
  }).strict(),
  displayLimit,
} as const;

const responseMetadata = z.object({
  httpStatus: z.number().int().min(100).max(599),
  contentType: z.string().max(120).nullable(),
  // The adapter reports only a bounded byte count, never response content.
  responseBytes: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
  rootType: z.string().max(24),
  arrayLength: z.number().int().nonnegative().max(100_000).optional(),
  topLevelFields: z.array(z.object({ name: z.string().max(100), type: z.string().max(24) }).strict()).max(64).optional(),
  firstRecordFields: z.array(z.object({ name: z.string().max(100), type: z.string().max(24) }).strict()).max(64).optional(),
  validationIssues: z.array(z.object({
    path: z.array(z.union([z.string().max(100), z.number().int().nonnegative()])).max(12),
    code: z.string().max(40),
  }).strict()).max(20).optional(),
}).strict();

const classificationCounts = z.object({
  LIKELY_FNB: z.number().int().nonnegative(),
  REVIEW_REQUIRED: z.number().int().nonnegative(),
  OUT_OF_SCOPE: z.number().int().nonnegative(),
}).strict();

const relatedQueryAvailability = z.object({
  available: z.number().int().nonnegative(),
  unavailable: z.number().int().nonnegative(),
  invalid: z.number().int().nonnegative(),
  uninspectable: z.number().int().nonnegative(),
}).strict();

const sourceMetric = z.union([z.number().finite(), z.string().max(160)]).nullable();

const sourceCandidate = z.object({
  title: z.string().min(1).max(160),
  classification: z.enum(["LIKELY_FNB", "REVIEW_REQUIRED", "OUT_OF_SCOPE"]),
  observationCount: z.number().int().positive().max(100_000),
  active: z.boolean(),
  startedAtUnixSeconds: z.number().int().nonnegative().safe(),
  volume: sourceMetric,
  volumeChange: sourceMetric,
  categoriesCount: z.number().int().nonnegative().max(100_000),
  relatedQueries: z.object({
    availability: z.enum(["AVAILABLE", "UNAVAILABLE"]),
    count: z.number().int().nonnegative().max(100_000).nullable(),
  }).strict(),
  displayTruncated: z.boolean(),
}).strict();

const recordSummary = z.object({
  total: z.number().int().nonnegative(),
  accepted: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  screenedGroups: z.number().int().nonnegative(),
  classifications: classificationCounts,
  relatedQueries: relatedQueryAvailability,
  candidates: z.array(sourceCandidate).max(10),
  omittedCandidates: z.number().int().nonnegative(),
}).strict();

export const brightDataDemoSourcePreviewSchema = z.discriminatedUnion("mode", [
  z.object({
    ...sourceContext,
    mode: z.literal("NOT_EXECUTED"),
    attempted: z.literal(false),
    reason: z.enum(["LIVE_REQUEST_DISABLED", "LIVE_REQUEST_NOT_AUTHORIZED", "PRECHECK_NOT_CONFIRMED", "CONFIGURATION_NOT_READY"]),
  }).strict(),
  z.object({
    ...sourceContext,
    mode: z.literal("MOCK_VERIFIED"),
    attempted: z.literal(false),
    notice: z.literal("TEST DATA sintetis; bukan respons Bright Data."),
    retrievedAt: z.string().datetime({ offset: true }),
    response: responseMetadata,
    completeness: z.enum(["COMPLETE", "PARTIAL"]),
    records: recordSummary,
  }).strict(),
  z.object({
    ...sourceContext,
    mode: z.literal("LIVE_VERIFIED"),
    attempted: z.literal(true),
    retrievedAt: z.string().datetime({ offset: true }),
    response: responseMetadata,
    completeness: z.enum(["COMPLETE", "PARTIAL"]),
    records: recordSummary,
  }).strict(),
  z.object({
    ...sourceContext,
    mode: z.literal("BLOCKED"),
    attempted: z.boolean(),
    reason: z.enum([
      "CONFIGURATION_INVALID",
      "REQUEST_BUDGET_EXHAUSTED",
      "PROVIDER_TIMEOUT",
      "PROVIDER_UNAVAILABLE",
      "INVALID_RESPONSE",
    ]),
    response: responseMetadata.optional(),
  }).strict(),
]);

export type BrightDataDemoSourcePreview = z.infer<typeof brightDataDemoSourcePreviewSchema>;

export const BRIGHTDATA_DEMO_SOURCE_CONTEXT = Object.freeze({
  source: Object.freeze({
    publisher: "Google" as const,
    transport: "Bright Data SERP API" as const,
    name: "Google Trends Trending Now" as const,
    region: "Indonesia" as const,
    reference: "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1" as const,
  }),
  observationPeriod: Object.freeze({
    status: "UNAVAILABLE" as const,
    reason: "Periode observasi tidak dapat disimpulkan dari waktu mulai topik." as const,
  }),
  displayLimit: Object.freeze({
    content: "PRIVATE_LOOPBACK_PREVIEW" as const,
    reason: "Konten hanya ditampilkan sementara pada demo loopback lokal; izin distribusi publik belum dievaluasi." as const,
  }),
});
