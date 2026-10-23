import { z } from "zod";

export const TREND_EVIDENCE_PROVENANCE_SOURCE_IDS = [
  "google_year_in_search_indonesia_2025",
  "google_trends_trending_now_indonesia",
] as const;

export const TREND_EVIDENCE_PROVENANCE_OBSERVATION_PERIOD_STATUSES = [
  "KNOWN",
  "NOT_PROVIDED",
  "UNKNOWN",
  "NOT_APPLICABLE",
] as const;

const nullableBoundedText = (maximum: number) =>
  z.string().trim().min(1).max(maximum).nullable();

const metricValueSchema = z.union([
  z.number().finite().refine(
    (value) => !Number.isInteger(value) || Number.isSafeInteger(value),
    "METRIC_INTEGER_MUST_BE_SAFE",
  ),
  z.string().min(1).max(80).refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "METRIC_TEXT_CONTAINS_CONTROL_CHARACTERS"),
]).nullable();

const metricSchema = z.object({
  name: z.enum(["rank", "volume", "volume_change"]),
  availability: z.enum(["AVAILABLE", "UNAVAILABLE", "UNKNOWN"]),
  value: metricValueSchema,
  semanticAvailability: z.enum(["KNOWN", "UNAVAILABLE", "UNKNOWN"]),
  semantic: nullableBoundedText(80),
  unitAvailability: z.enum(["KNOWN", "UNAVAILABLE", "UNKNOWN"]),
  unit: nullableBoundedText(32),
}).strict().superRefine((metric, context) => {
  if ((metric.availability === "AVAILABLE") !== (metric.value !== null)) {
    context.addIssue({ code: "custom", path: ["value"], message: "METRIC_VALUE_MUST_MATCH_AVAILABILITY" });
  }
  if ((metric.semanticAvailability === "KNOWN") !== (metric.semantic !== null)) {
    context.addIssue({ code: "custom", path: ["semantic"], message: "METRIC_SEMANTIC_MUST_MATCH_AVAILABILITY" });
  }
  if ((metric.unitAvailability === "KNOWN") !== (metric.unit !== null)) {
    context.addIssue({ code: "custom", path: ["unit"], message: "METRIC_UNIT_MUST_MATCH_AVAILABILITY" });
  }
});

export const trendEvidenceProvenanceMetricsSchema = z.array(metricSchema).max(3).superRefine((metrics, context) => {
  if (Buffer.byteLength(JSON.stringify(metrics), "utf8") > 512) {
    context.addIssue({ code: "custom", message: "METRICS_METADATA_TOO_LARGE" });
  }
  if (new Set(metrics.map(({ name }) => name)).size !== metrics.length) {
    context.addIssue({ code: "custom", message: "DUPLICATE_METRIC_NAME" });
  }
});

const collectionTargetUrlSchema = z.string().url().max(2000).refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
});

export const trendEvidenceProvenanceInputSchema = z.object({
  trendEvidenceId: z.string().uuid(),
  schemaVersion: z.literal(1),
  sourceId: z.enum(TREND_EVIDENCE_PROVENANCE_SOURCE_IDS),
  originalPublisher: z.literal("GOOGLE"),
  transportProvider: z.enum(["BRIGHTDATA_SERP_API", "UNKNOWN", "NOT_APPLICABLE"]),
  sourceProduct: z.enum(["GOOGLE_YEAR_IN_SEARCH_2025", "GOOGLE_TRENDS_TRENDING_NOW"]),
  collectionTargetUrl: collectionTargetUrlSchema.nullable(),
  retrievedAt: z.date().nullable(),
  observationPeriodStatus: z.enum(TREND_EVIDENCE_PROVENANCE_OBSERVATION_PERIOD_STATUSES),
  observationPeriodStart: z.iso.date().nullable(),
  observationPeriodEnd: z.iso.date().nullable(),
  geographyCode: z.literal("ID").nullable(),
  metricsAvailability: z.enum(["AVAILABLE", "PARTIAL", "UNAVAILABLE", "UNKNOWN"]),
  metrics: trendEvidenceProvenanceMetricsSchema,
  completeness: z.enum(["COMPLETE", "PARTIAL", "UNKNOWN"]),
}).strict().superRefine((provenance, context) => {
  const isYearInSearch = provenance.sourceId === "google_year_in_search_indonesia_2025";
  const sourceMappingIsValid = isYearInSearch
    ? provenance.sourceProduct === "GOOGLE_YEAR_IN_SEARCH_2025" &&
      ["UNKNOWN", "NOT_APPLICABLE"].includes(provenance.transportProvider) &&
      provenance.collectionTargetUrl === null &&
      provenance.metrics.every(({ name }) => name === "rank")
    : provenance.sourceProduct === "GOOGLE_TRENDS_TRENDING_NOW" &&
      provenance.transportProvider === "BRIGHTDATA_SERP_API" &&
      provenance.collectionTargetUrl === "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1" &&
      provenance.metrics.every(({ name }) => name === "volume" || name === "volume_change");

  if (!sourceMappingIsValid) {
    context.addIssue({ code: "custom", path: ["sourceId"], message: "UNSUPPORTED_SOURCE_PROVIDER_PRODUCT_MAPPING" });
  }

  const periodIsKnown = provenance.observationPeriodStatus === "KNOWN";
  const hasPeriodStart = provenance.observationPeriodStart !== null;
  const hasPeriodEnd = provenance.observationPeriodEnd !== null;
  if (periodIsKnown !== (hasPeriodStart && hasPeriodEnd)) {
    context.addIssue({ code: "custom", path: ["observationPeriodStatus"], message: "OBSERVATION_PERIOD_FIELDS_MUST_MATCH_STATUS" });
  }
  if (
    hasPeriodStart && hasPeriodEnd &&
    provenance.observationPeriodStart! > provenance.observationPeriodEnd!
  ) {
    context.addIssue({ code: "custom", path: ["observationPeriodEnd"], message: "OBSERVATION_PERIOD_END_PRECEDES_START" });
  }

  const statuses = provenance.metrics.map(({ availability }) => availability);
  const allAvailable = statuses.length > 0 && statuses.every((status) => status === "AVAILABLE");
  const allUnavailable = statuses.length > 0 && statuses.every((status) => status === "UNAVAILABLE");
  const anyAvailable = statuses.some((status) => status === "AVAILABLE");
  const metricAvailabilityIsValid =
    (provenance.metricsAvailability === "AVAILABLE" && allAvailable) ||
    (provenance.metricsAvailability === "PARTIAL" && anyAvailable && !allAvailable) ||
    (provenance.metricsAvailability === "UNAVAILABLE" && allUnavailable) ||
    (provenance.metricsAvailability === "UNKNOWN" && statuses.length === 0);

  if (!metricAvailabilityIsValid) {
    context.addIssue({ code: "custom", path: ["metricsAvailability"], message: "METRICS_MUST_MATCH_AVAILABILITY" });
  }
});

export type TrendEvidenceProvenanceInput = z.infer<typeof trendEvidenceProvenanceInputSchema>;
export type TrendEvidenceProvenanceMetric = z.infer<typeof metricSchema>;

export function parseTrendEvidenceProvenanceInput(input: unknown): TrendEvidenceProvenanceInput {
  return trendEvidenceProvenanceInputSchema.parse(input);
}
