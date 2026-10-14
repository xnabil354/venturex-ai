import { z } from "zod";

import { TREND_CATEGORY_CODES, TREND_USER_TYPES } from "../trend/domain";
import {
  trendEvidenceProvenanceInputSchema,
  trendEvidenceProvenanceMetricsSchema,
} from "../trend/trend-evidence-provenance.schema";

const GOOGLE_TRENDS_INDONESIA_TARGET =
  "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1";

const nonBlankText = (maximum: number) =>
  z.string().min(1).max(maximum).refine((value) => value.trim().length > 0);

const googleTrendsBrightDataProvenanceSchema = z.object({
  schemaVersion: z.literal(1),
  sourceId: z.literal("google_trends_trending_now_indonesia"),
  originalPublisher: z.literal("GOOGLE"),
  transportProvider: z.literal("BRIGHTDATA_SERP_API"),
  sourceProduct: z.literal("GOOGLE_TRENDS_TRENDING_NOW"),
  collectionTargetUrl: z.literal(GOOGLE_TRENDS_INDONESIA_TARGET),
  observationPeriodStatus: z.enum([
    "KNOWN",
    "NOT_PROVIDED",
    "UNKNOWN",
    "NOT_APPLICABLE",
  ]),
  observationPeriodStart: z.iso.date().nullable(),
  observationPeriodEnd: z.iso.date().nullable(),
  geographyCode: z.literal("ID"),
  relatedQueriesAvailability: z.enum(["AVAILABLE", "UNAVAILABLE", "UNKNOWN"]),
  metricsAvailability: z.enum(["AVAILABLE", "PARTIAL", "UNAVAILABLE", "UNKNOWN"]),
  metrics: trendEvidenceProvenanceMetricsSchema,
  completeness: z.enum(["COMPLETE", "PARTIAL", "UNKNOWN"]),
}).strict();

function hasLosslessDatePrecision(value: string): boolean {
  const fractionalSeconds = value.match(/\.(\d+)Z$/)?.[1];
  return !fractionalSeconds || fractionalSeconds.length <= 3 || /^.{3}0+$/.test(fractionalSeconds);
}

function existingProvenanceMetadata(
  metadata: NonNullable<z.infer<typeof googleTrendsBrightDataProvenanceSchema>>,
): Record<string, unknown> {
  const projected: Record<string, unknown> = { ...metadata };
  delete projected.relatedQueriesAvailability;
  return projected;
}

const evidenceSchema = z.object({
  id: z.string().uuid(),
  sourceName: nonBlankText(180),
  sourceReference: z.string().url().max(2000).refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" && !parsed.username && !parsed.password;
    } catch {
      return false;
    }
  }, "SOURCE_REFERENCE_MUST_BE_HTTPS_WITHOUT_EMBEDDED_CREDENTIALS"),
  providerName: nonBlankText(180).nullable(),
  sourceDate: z.union([z.iso.date(), z.iso.datetime()]).nullable(),
  retrievalTimestamp: z.iso.datetime().nullable(),
  supportingDetail: nonBlankText(4000),
  limitations: z.array(nonBlankText(2000)).min(1).max(12),
  sourceProvenance: googleTrendsBrightDataProvenanceSchema.optional(),
}).strict().superRefine((evidence, context) => {
  if (!evidence.sourceProvenance) return;

  if (evidence.sourceName !== "Google Trends Trending Now") {
    context.addIssue({
      code: "custom",
      path: ["sourceName"],
      message: "SOURCE_NAME_MUST_MATCH_GOOGLE_TRENDS_TRENDING_NOW",
    });
  }
  if (evidence.sourceReference !== GOOGLE_TRENDS_INDONESIA_TARGET) {
    context.addIssue({
      code: "custom",
      path: ["sourceReference"],
      message: "SOURCE_REFERENCE_MUST_MATCH_COLLECTION_TARGET",
    });
  }
  if (evidence.providerName !== null) {
    context.addIssue({
      code: "custom",
      path: ["providerName"],
      message: "PROVIDER_NAME_TEXT_NOT_MAPPED_USE_EXPLICIT_TRANSPORT_PROVIDER",
    });
  }
  if (evidence.sourceDate !== null) {
    context.addIssue({
      code: "custom",
      path: ["sourceDate"],
      message: "GOOGLE_TRENDS_TRENDING_NOW_SOURCE_DATE_UNAVAILABLE",
    });
  }
  if (
    evidence.retrievalTimestamp !== null &&
    !hasLosslessDatePrecision(evidence.retrievalTimestamp)
  ) {
    context.addIssue({
      code: "custom",
      path: ["retrievalTimestamp"],
      message: "RETRIEVAL_TIMESTAMP_PRECISION_EXCEEDS_PROVENANCE_CONTRACT",
    });
  }

  const provenance = trendEvidenceProvenanceInputSchema.safeParse({
    ...existingProvenanceMetadata(evidence.sourceProvenance),
    trendEvidenceId: evidence.id,
    retrievedAt: evidence.retrievalTimestamp === null
      ? null
      : new Date(evidence.retrievalTimestamp),
  });
  if (!provenance.success) {
    for (const issue of provenance.error.issues) {
      context.addIssue({
        code: "custom",
        path: ["sourceProvenance", ...issue.path],
        message: issue.code === "custom" ? issue.message : issue.code.toUpperCase(),
      });
    }
  }
});

const metricSchema = z.object({
  name: nonBlankText(120),
  rawValue: z.union([
    z.number().finite().refine(
      (value) => !Number.isInteger(value) || Number.isSafeInteger(value),
      "NUMERIC_METRIC_INTEGER_MUST_BE_SAFE",
    ),
    nonBlankText(120),
  ]),
  unit: nonBlankText(80).nullable(),
  evidenceId: z.string().uuid(),
  limitation: nonBlankText(1000).nullable(),
}).strict();

const reviewSchema = z.object({
  decision: z.enum(["PENDING", "SUPPORTED", "REJECTED"]),
  reviewerIdentity: nonBlankText(180).nullable(),
  reviewedAt: z.iso.datetime().nullable(),
  evidenceLimitations: z.array(nonBlankText(2000)).min(1).max(12),
}).strict();

const trendSchema = z.object({
  id: z.string().uuid(),
  title: nonBlankText(180),
  categoryCode: z.enum(TREND_CATEGORY_CODES),
  subjectAreaCode: nonBlankText(80).nullable(),
  signal: z.object({
    summary: nonBlankText(500),
    summaryEvidenceIds: z.array(z.string().uuid()).min(1).max(50),
    description: nonBlankText(4000),
    descriptionEvidenceIds: z.array(z.string().uuid()).min(1).max(50),
    direction: z.enum(["RISING", "STABLE", "DECLINING"]).nullable(),
    directionEvidenceIds: z.array(z.string().uuid()).max(50),
    observationPeriod: z.object({
      requiredForCuration: z.boolean(),
      start: z.iso.date().nullable(),
      end: z.iso.date().nullable(),
      evidenceIds: z.array(z.string().uuid()).max(50),
    }).strict(),
    metrics: z.array(metricSchema).max(50),
    unavailableFields: z.array(nonBlankText(120)).max(50),
  }).strict(),
  evidence: z.array(evidenceSchema).max(50),
  businessRelevanceExplanation: nonBlankText(5000).nullable(),
  affectedUserTypes: z.array(z.enum(TREND_USER_TYPES)).max(2),
  factualReview: reviewSchema,
}).strict();

export const genericTrendManifestPreparationSchema = z.object({
  manifestType: z.literal("VENTUREX_GENERIC_TREND_PREPARATION"),
  manifestVersion: z.literal(1),
  manifestId: nonBlankText(100),
  evidenceMode: z.enum(["EXTERNAL_SOURCE_CLAIM", "SYNTHETIC_FIXTURE"]),
  trends: z.array(trendSchema).min(1).max(50),
}).strict().superRefine((manifest, context) => {
  const manifestRecordIds = new Set<string>();

  for (const [trendIndex, trend] of manifest.trends.entries()) {
    if (manifestRecordIds.has(trend.id)) {
      context.addIssue({
        code: "custom",
        path: ["trends", trendIndex, "id"],
        message: "DUPLICATE_RECORD_ID",
      });
    }
    manifestRecordIds.add(trend.id);

    const evidenceIds = new Set<string>();
    for (const [evidenceIndex, evidence] of trend.evidence.entries()) {
      if (manifestRecordIds.has(evidence.id) || evidenceIds.has(evidence.id)) {
        context.addIssue({
          code: "custom",
          path: ["trends", trendIndex, "evidence", evidenceIndex, "id"],
          message: "DUPLICATE_RECORD_ID",
        });
      }
      evidenceIds.add(evidence.id);
      manifestRecordIds.add(evidence.id);
    }

    if (trend.evidence.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["trends", trendIndex, "evidence"],
        message: "EVIDENCE_REQUIRED",
      });
    }

    for (const evidenceId of trend.signal.summaryEvidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        context.addIssue({
          code: "custom",
          path: ["trends", trendIndex, "signal", "summaryEvidenceIds"],
          message: "SUMMARY_EVIDENCE_REFERENCE_NOT_FOUND",
        });
      }
    }
    for (const evidenceId of trend.signal.descriptionEvidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        context.addIssue({
          code: "custom",
          path: ["trends", trendIndex, "signal", "descriptionEvidenceIds"],
          message: "DESCRIPTION_EVIDENCE_REFERENCE_NOT_FOUND",
        });
      }
    }

    for (const evidenceId of trend.signal.directionEvidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        context.addIssue({
          code: "custom",
          path: ["trends", trendIndex, "signal", "directionEvidenceIds"],
          message: "DIRECTION_EVIDENCE_REFERENCE_NOT_FOUND",
        });
      }
    }
    if (trend.signal.direction !== null && trend.signal.directionEvidenceIds.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["trends", trendIndex, "signal", "directionEvidenceIds"],
        message: "DIRECTION_REQUIRES_SUPPORTING_EVIDENCE",
      });
    }
    if (trend.signal.direction === null && trend.signal.directionEvidenceIds.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["trends", trendIndex, "signal", "directionEvidenceIds"],
        message: "DIRECTION_EVIDENCE_WITHOUT_DIRECTION",
      });
    }

    const period = trend.signal.observationPeriod;
    const hasStart = period.start !== null;
    const hasEnd = period.end !== null;
    if (hasStart !== hasEnd) {
      context.addIssue({
        code: "custom",
        path: ["trends", trendIndex, "signal", "observationPeriod"],
        message: "OBSERVATION_PERIOD_MUST_HAVE_BOTH_BOUNDARIES",
      });
    }
    if (period.requiredForCuration && !hasStart) {
      context.addIssue({
        code: "custom",
        path: ["trends", trendIndex, "signal", "observationPeriod"],
        message: "REQUIRED_OBSERVATION_PERIOD_UNAVAILABLE",
      });
    }
    if (period.start !== null && period.end !== null && period.start > period.end) {
      context.addIssue({
        code: "custom",
        path: ["trends", trendIndex, "signal", "observationPeriod", "end"],
        message: "OBSERVATION_PERIOD_END_PRECEDES_START",
      });
    }
    for (const evidenceId of period.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        context.addIssue({
          code: "custom",
          path: ["trends", trendIndex, "signal", "observationPeriod", "evidenceIds"],
          message: "PERIOD_EVIDENCE_REFERENCE_NOT_FOUND",
        });
      }
    }
    if (hasStart && period.evidenceIds.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["trends", trendIndex, "signal", "observationPeriod", "evidenceIds"],
        message: "KNOWN_OBSERVATION_PERIOD_REQUIRES_SUPPORTING_EVIDENCE",
      });
    }

    for (const [metricIndex, metric] of trend.signal.metrics.entries()) {
      if (!evidenceIds.has(metric.evidenceId)) {
        context.addIssue({
          code: "custom",
          path: ["trends", trendIndex, "signal", "metrics", metricIndex, "evidenceId"],
          message: "METRIC_EVIDENCE_REFERENCE_NOT_FOUND",
        });
      }
      if (metric.unit === null && metric.limitation === null) {
        context.addIssue({
          code: "custom",
          path: ["trends", trendIndex, "signal", "metrics", metricIndex, "limitation"],
          message: "UNKNOWN_METRIC_UNIT_REQUIRES_LIMITATION",
        });
      }

      const sourceEvidence = trend.evidence.find(({ id }) => id === metric.evidenceId);
      const sourceProvenance = sourceEvidence?.sourceProvenance;
      if (sourceProvenance) {
        const provenanceMetric = sourceProvenance.metrics.find(({ name }) => name === metric.name);
        if (!provenanceMetric) {
          context.addIssue({
            code: "custom",
            path: ["trends", trendIndex, "signal", "metrics", metricIndex, "name"],
            message: "METRIC_NAME_NOT_SUPPORTED_BY_LINKED_PROVENANCE",
          });
        } else if (
          provenanceMetric.availability !== "AVAILABLE" ||
          provenanceMetric.value !== metric.rawValue ||
          (provenanceMetric.unitAvailability === "KNOWN"
            ? provenanceMetric.unit !== metric.unit
            : metric.unit !== null)
        ) {
          context.addIssue({
            code: "custom",
            path: ["trends", trendIndex, "signal", "metrics", metricIndex],
            message: "METRIC_VALUE_OR_UNIT_CONFLICTS_WITH_LINKED_PROVENANCE",
          });
        }
      }
    }

    for (const [evidenceIndex, evidence] of trend.evidence.entries()) {
      const provenance = evidence.sourceProvenance;
      if (!provenance) continue;
      for (const requiredMetricName of ["volume", "volume_change"] as const) {
        if (!provenance.metrics.some(({ name }) => name === requiredMetricName)) {
          context.addIssue({
            code: "custom",
            path: ["trends", trendIndex, "evidence", evidenceIndex, "sourceProvenance", "metrics"],
            message: "GOOGLE_TRENDS_METRIC_AVAILABILITY_MUST_BE_EXPLICIT",
          });
        }
      }
      const relatedQueriesUnavailable = trend.signal.unavailableFields.includes("related_queries");
      if (
        provenance.relatedQueriesAvailability === "UNAVAILABLE" &&
        !relatedQueriesUnavailable
      ) {
        context.addIssue({
          code: "custom",
          path: ["trends", trendIndex, "evidence", evidenceIndex, "sourceProvenance", "relatedQueriesAvailability"],
          message: "UNAVAILABLE_RELATED_QUERIES_MUST_REMAIN_EXPLICIT",
        });
      }
      if (
        provenance.relatedQueriesAvailability === "AVAILABLE" &&
        relatedQueriesUnavailable
      ) {
        context.addIssue({
          code: "custom",
          path: ["trends", trendIndex, "evidence", evidenceIndex, "sourceProvenance", "relatedQueriesAvailability"],
          message: "AVAILABLE_RELATED_QUERIES_CONFLICTS_WITH_UNAVAILABLE_FIELDS",
        });
      }
      if (
        provenance.completeness === "COMPLETE" &&
        provenance.relatedQueriesAvailability !== "AVAILABLE"
      ) {
        context.addIssue({
          code: "custom",
          path: ["trends", trendIndex, "evidence", evidenceIndex, "sourceProvenance", "completeness"],
          message: "MISSING_RELATED_QUERIES_CANNOT_BE_LABELED_COMPLETE",
        });
      }
      const isPeriodEvidence = period.evidenceIds.includes(evidence.id);
      if (
        provenance.observationPeriodStatus === "KNOWN" &&
        (!isPeriodEvidence || period.start !== provenance.observationPeriodStart || period.end !== provenance.observationPeriodEnd)
      ) {
        context.addIssue({
          code: "custom",
          path: ["trends", trendIndex, "evidence", evidenceIndex, "sourceProvenance", "observationPeriodStatus"],
          message: "PROVENANCE_PERIOD_MUST_MATCH_LINKED_TREND_PERIOD",
        });
      }
      if (
        isPeriodEvidence &&
        provenance.observationPeriodStatus !== "KNOWN"
      ) {
        context.addIssue({
          code: "custom",
          path: ["trends", trendIndex, "evidence", evidenceIndex, "sourceProvenance", "observationPeriodStatus"],
          message: "UNKNOWN_PROVENANCE_PERIOD_CANNOT_SUPPORT_KNOWN_TREND_PERIOD",
        });
      }
    }

    if (trend.factualReview.decision === "SUPPORTED") {
      if (manifest.evidenceMode !== "EXTERNAL_SOURCE_CLAIM") {
        context.addIssue({
          code: "custom",
          path: ["evidenceMode"],
          message: "SYNTHETIC_FIXTURE_CANNOT_HAVE_SUPPORTED_FACTUAL_REVIEW",
        });
      }
      if (trend.factualReview.reviewerIdentity === null || trend.factualReview.reviewedAt === null) {
        context.addIssue({
          code: "custom",
          path: ["trends", trendIndex, "factualReview"],
          message: "SUPPORTED_REVIEW_REQUIRES_SELF_ATTESTED_IDENTITY_AND_TIME",
        });
      }
    }
    if (
      manifest.evidenceMode === "SYNTHETIC_FIXTURE" &&
      trend.factualReview.decision !== "PENDING"
    ) {
      context.addIssue({
        code: "custom",
        path: ["trends", trendIndex, "factualReview", "decision"],
        message: "SYNTHETIC_FIXTURE_MUST_REMAIN_UNREVIEWED",
      });
    }
  }
});

export type GenericTrendManifestPreparationInput = z.infer<
  typeof genericTrendManifestPreparationSchema
>;

export type GenericTrendManifestPreparation = Readonly<{
  manifestType: "VENTUREX_GENERIC_TREND_PREPARATION_RESULT";
  manifestVersion: 1;
  evidenceMode: "EXTERNAL_SOURCE_CLAIM" | "SYNTHETIC_FIXTURE" | "UNKNOWN";
  structuralStatus: "READY_FOR_HUMAN_REVIEW" | "FACTUAL_REVIEW_REJECTED" | "INCOMPLETE";
  sourceAuthority: "NOT_VERIFIED_BY_PREPARATION_TOOL";
  factualVerification: "NOT_VERIFIED_BY_PREPARATION_TOOL";
  factualReviewIdentityAssurance: "SELF_ATTESTED_NOT_AUTHENTICATED";
  publicationApproval: "NOT_REQUESTED";
  importerCompatibility: "UNSUPPORTED_BY_CURRENT_V1_IMPORTER";
  importReadiness: Readonly<{
    status: "NOT_READY_FOR_IMPORT";
    reasons: readonly string[];
  }>;
  issues: readonly Readonly<{ path: string; code: string }>[];
  manifest?: GenericTrendManifestPreparationInput;
}>;

const importerLimitations = [
  "The current catalog importer accepts only manifest version 1 for the fixed Google Year in Search 2025 source and observation window.",
  "The current importer requires two Trends and four to six manually authored Opportunity hypotheses; this generic preparation contract does not generate Opportunities.",
  "The lifecycle CLI and audit binding are restricted to the existing approved manifest. Generic import and lifecycle support need separate review.",
  "Source authority and factual claims remain unverified by this preparation tool, even when a review decision is self-attested as SUPPORTED.",
] as const;

export function prepareGenericTrendManifest(
  input: unknown,
): GenericTrendManifestPreparation {
  const parsed = genericTrendManifestPreparationSchema.safeParse(input);
  const issues = parsed.success
    ? []
    : parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        code: issue.code === "custom" ? issue.message : issue.code.toUpperCase(),
      }));
  const evidenceMode = parsed.success
    ? parsed.data.evidenceMode
    : input !== null && typeof input === "object" &&
        "evidenceMode" in input &&
        (input.evidenceMode === "EXTERNAL_SOURCE_CLAIM" || input.evidenceMode === "SYNTHETIC_FIXTURE")
      ? input.evidenceMode
      : "UNKNOWN";

  const reasons: string[] = [...importerLimitations];
  if (!parsed.success) reasons.unshift("GENERIC_MANIFEST_STRUCTURE_INCOMPLETE");
  if (evidenceMode === "SYNTHETIC_FIXTURE") {
    reasons.push("SYNTHETIC_FIXTURE_CANNOT_BE_IMPORTED_AS_PRODUCTION_EVIDENCE");
  }
  if (parsed.success && parsed.data.trends.some((trend) => trend.factualReview.decision === "REJECTED")) {
    reasons.push("FACTUAL_REVIEW_REJECTED");
  } else if (
    !parsed.success ||
    parsed.data.trends.some((trend) => trend.factualReview.decision !== "SUPPORTED")
  ) {
    reasons.push("FACTUAL_REVIEW_READINESS_NOT_ESTABLISHED");
  }

  const structuralStatus = !parsed.success
    ? "INCOMPLETE"
    : parsed.data.trends.some((trend) => trend.factualReview.decision === "REJECTED")
      ? "FACTUAL_REVIEW_REJECTED"
      : "READY_FOR_HUMAN_REVIEW";

  return {
    manifestType: "VENTUREX_GENERIC_TREND_PREPARATION_RESULT",
    manifestVersion: 1,
    evidenceMode,
    structuralStatus,
    sourceAuthority: "NOT_VERIFIED_BY_PREPARATION_TOOL",
    factualVerification: "NOT_VERIFIED_BY_PREPARATION_TOOL",
    factualReviewIdentityAssurance: "SELF_ATTESTED_NOT_AUTHENTICATED",
    publicationApproval: "NOT_REQUESTED",
    importerCompatibility: "UNSUPPORTED_BY_CURRENT_V1_IMPORTER",
    importReadiness: {
      status: "NOT_READY_FOR_IMPORT",
      reasons,
    },
    issues,
    ...(parsed.success ? { manifest: parsed.data } : {}),
  };
}
