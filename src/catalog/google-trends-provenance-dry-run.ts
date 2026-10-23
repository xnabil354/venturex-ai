import {
  genericTrendManifestPreparationSchema,
  type GenericTrendManifestPreparationInput,
} from "./generic-trend-manifest";
import { trendEvidenceProvenanceInputSchema } from "../trend/trend-evidence-provenance.schema";

export type GoogleTrendsProvenanceDryRunIssue = Readonly<{
  path: string;
  code: string;
}>;

export type GoogleTrendsProvenanceDryRunResult =
  | Readonly<{
      status: "MAPPED";
      operation: "OFFLINE_DRY_RUN_ONLY";
      persistence: "NOT_PERFORMED";
      lifecycleTransition: "NONE";
      sourceAuthority: "NOT_VERIFIED";
      usageRightsReview: "NOT_APPROVED";
      importerReadiness: "NOT_READY_FOR_IMPORT";
      manifestId: string;
      records: readonly Readonly<{
        trendId: string;
        evidenceId: string;
        evidenceRecordPreview: Readonly<{
          id: string;
          trendId: string;
          sourceName: string;
          sourceReference: string;
          sourceDate: null;
          supportingDetail: string;
          limitationsText: string;
        }>;
        provenanceRecordPreview: ReturnType<typeof trendEvidenceProvenanceInputSchema.parse>;
        retainedManifestContext: Readonly<{
          providerName: string | null;
          retrievalTimestamp: string | null;
          relatedQueriesAvailability: "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";
          limitationItems: readonly string[];
          unavailableTrendFields: readonly string[];
          observationPeriod: GenericTrendManifestPreparationInput["trends"][number]["signal"]["observationPeriod"];
        }>;
      }>[];
      limitations: readonly string[];
    }>
  | Readonly<{
      status: "REJECTED";
      operation: "OFFLINE_DRY_RUN_ONLY";
      issues: readonly GoogleTrendsProvenanceDryRunIssue[];
    }>;

const mapperLimitations = [
  "This result is a typed mapping preview only; it does not write records or advance lifecycle state.",
  "Source authority, factual support, licensing, retention, and attribution rights are not verified or approved by this mapper.",
  "The current catalog importer and lifecycle remain bound to the separately reviewed historical manifest.",
  "Field-specific related-query availability is retained in this preview; migration 017 stores aggregate completeness and bounded metrics, not a dedicated related-query availability column.",
] as const;

function sanitizeIssues(issues: readonly {
  path: readonly PropertyKey[];
  code: string;
  message?: string;
}[]): readonly GoogleTrendsProvenanceDryRunIssue[] {
  return issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    code: issue.code === "custom" ? issue.message ?? "VALIDATION_FAILED" : issue.code.toUpperCase(),
  }));
}

/**
 * Maps explicitly supported Google Trends Indonesia evidence to an offline
 * preview of the existing TrendEvidence and provenance v1 representations.
 * This function has no database, filesystem, lifecycle, or network capability.
 */
export function mapGoogleTrendsManifestToProvenanceDryRun(
  input: unknown,
): GoogleTrendsProvenanceDryRunResult {
  const parsed = genericTrendManifestPreparationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "REJECTED",
      operation: "OFFLINE_DRY_RUN_ONLY",
      issues: sanitizeIssues(parsed.error.issues),
    };
  }

  if (parsed.data.evidenceMode !== "EXTERNAL_SOURCE_CLAIM") {
    return {
      status: "REJECTED",
      operation: "OFFLINE_DRY_RUN_ONLY",
      issues: [{ path: "evidenceMode", code: "SYNTHETIC_FIXTURE_NOT_MAPPABLE_TO_PRODUCTION_PROVENANCE" }],
    };
  }

  const records: {
    trendId: string;
    evidenceId: string;
    evidenceRecordPreview: {
      id: string;
      trendId: string;
      sourceName: string;
      sourceReference: string;
      sourceDate: null;
      supportingDetail: string;
      limitationsText: string;
    };
    provenanceRecordPreview: ReturnType<typeof trendEvidenceProvenanceInputSchema.parse>;
    retainedManifestContext: {
      providerName: string | null;
      retrievalTimestamp: string | null;
      relatedQueriesAvailability: "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";
      limitationItems: readonly string[];
      unavailableTrendFields: readonly string[];
      observationPeriod: GenericTrendManifestPreparationInput["trends"][number]["signal"]["observationPeriod"];
    };
  }[] = [];

  for (const trend of parsed.data.trends) {
    for (const evidence of trend.evidence) {
      if (!evidence.sourceProvenance) {
        return {
          status: "REJECTED",
          operation: "OFFLINE_DRY_RUN_ONLY",
          issues: [{
            path: `trends.${trend.id}.evidence.${evidence.id}.sourceProvenance`,
            code: "EXPLICIT_GOOGLE_TRENDS_BRIGHTDATA_PROVENANCE_REQUIRED",
          }],
        };
      }

      const { relatedQueriesAvailability, ...provenanceMetadata } = evidence.sourceProvenance;
      const provenance = trendEvidenceProvenanceInputSchema.safeParse({
        ...provenanceMetadata,
        trendEvidenceId: evidence.id,
        retrievedAt: evidence.retrievalTimestamp === null
          ? null
          : new Date(evidence.retrievalTimestamp),
      });
      if (!provenance.success) {
        return {
          status: "REJECTED",
          operation: "OFFLINE_DRY_RUN_ONLY",
          issues: sanitizeIssues(provenance.error.issues),
        };
      }

      records.push({
        trendId: trend.id,
        evidenceId: evidence.id,
        evidenceRecordPreview: {
          id: evidence.id,
          trendId: trend.id,
          sourceName: evidence.sourceName,
          sourceReference: evidence.sourceReference,
          sourceDate: null,
          supportingDetail: evidence.supportingDetail,
          limitationsText: [
            ...evidence.limitations.map((limitation) => `- ${limitation}`),
            `- Provider field related_queries availability: ${evidence.sourceProvenance.relatedQueriesAvailability}.`,
          ].join("\n"),
        },
        provenanceRecordPreview: provenance.data,
        retainedManifestContext: {
          providerName: evidence.providerName,
          retrievalTimestamp: evidence.retrievalTimestamp,
          relatedQueriesAvailability,
          limitationItems: evidence.limitations,
          unavailableTrendFields: trend.signal.unavailableFields,
          observationPeriod: trend.signal.observationPeriod,
        },
      });
    }
  }

  return {
    status: "MAPPED",
    operation: "OFFLINE_DRY_RUN_ONLY",
    persistence: "NOT_PERFORMED",
    lifecycleTransition: "NONE",
    sourceAuthority: "NOT_VERIFIED",
    usageRightsReview: "NOT_APPROVED",
    importerReadiness: "NOT_READY_FOR_IMPORT",
    manifestId: parsed.data.manifestId,
    records,
    limitations: mapperLimitations,
  };
}
