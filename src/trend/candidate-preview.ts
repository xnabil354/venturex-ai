import type { BrightDataScreenedCandidateBatch } from "./brightdata-google-trends";
import { candidateCurationId } from "./candidate-curation.ts";

export const MAX_CANDIDATE_PREVIEW_TITLES = 20;
const MAX_TITLE_LENGTH = 120;

export type CandidatePreviewMode = "OFFLINE_SYNTHETIC" | "LIVE_PROVIDER";

export type CandidatePreviewReport = Readonly<{
  mode: CandidatePreviewMode;
  source: string;
  generatedAt: string;
  retrievedAt: string | null;
  providerRequests: 0 | 1;
  status: "COMPLETE" | "PARTIAL";
  records: Readonly<{
    retrieved: number;
    accepted: number;
    rejected: number;
  }>;
  relatedQueriesAvailability: BrightDataScreenedCandidateBatch["fieldAvailability"]["relatedQueries"];
  screening: Readonly<{
    inputRecords: number;
    acceptedParsedRecords: number;
    rejectedParsedRecords: number;
    uniqueScreenedGroups: number;
    classifications: BrightDataScreenedCandidateBatch["screeningSummary"]["classifications"];
  }>;
  rejectionReasons: BrightDataScreenedCandidateBatch["rejectionReasons"];
  titles: readonly Readonly<{
    candidateId: string;
    classification: string;
    title: string;
  }>[];
  omittedTitles: number;
}>;

function sanitizeCandidateTitle(value: string): string {
  const sanitized = value
    .normalize("NFKC")
    .replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/gu, "")
    .replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu, "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  return Array.from(sanitized).slice(0, MAX_TITLE_LENGTH).join("");
}

export function createCandidatePreviewReport(
  batch: BrightDataScreenedCandidateBatch,
  options: Readonly<{
    mode: CandidatePreviewMode;
    generatedAt: string;
    retrievedAt: string | null;
  }>,
): CandidatePreviewReport {
  const candidates = batch.candidates
    .map((candidate) => ({
      candidateId: candidateCurationId(candidate),
      classification: candidate.classification,
      title: sanitizeCandidateTitle(candidate.query),
    }))
    .filter((candidate) => candidate.title.length > 0);

  return {
    mode: options.mode,
    source:
      options.mode === "OFFLINE_SYNTHETIC"
        ? "Synthetic fixture shaped like Google Trends Trending Now (Indonesia)"
        : "Google Trends Trending Now (Indonesia) via Bright Data SERP API",
    generatedAt: options.generatedAt,
    retrievedAt: options.mode === "LIVE_PROVIDER" ? options.retrievedAt : null,
    providerRequests: options.mode === "LIVE_PROVIDER" ? 1 : 0,
    status: batch.status,
    records: {
      retrieved: batch.totalRecords,
      accepted: batch.acceptedRecords,
      rejected: batch.rejectedRecords,
    },
    relatedQueriesAvailability: batch.fieldAvailability.relatedQueries,
    screening: batch.screeningSummary,
    rejectionReasons: batch.rejectionReasons,
    titles: candidates.slice(0, MAX_CANDIDATE_PREVIEW_TITLES),
    omittedTitles: Math.max(
      0,
      candidates.length - MAX_CANDIDATE_PREVIEW_TITLES,
    ),
  };
}

export function formatCandidatePreviewReport(
  report: CandidatePreviewReport,
): string {
  const lines = [
    "VENTUREX Bright Data Candidate Preview",
    `Mode: ${report.mode}`,
    `Source: ${report.source}`,
    `Preview generated at: ${report.generatedAt}`,
    `Provider retrieval timestamp: ${report.retrievedAt ?? "not applicable (offline fixture)"}`,
    `Provider requests: ${report.providerRequests}`,
    `Batch status: ${report.status}`,
    `Records: retrieved=${report.records.retrieved}, accepted=${report.records.accepted}, rejected=${report.records.rejected}`,
    `related_queries availability: available=${report.relatedQueriesAvailability.available}, unavailable=${report.relatedQueriesAvailability.unavailable}, invalid=${report.relatedQueriesAvailability.invalid}, uninspectable=${report.relatedQueriesAvailability.uninspectable}`,
    `Screening: input=${report.screening.inputRecords}, accepted=${report.screening.acceptedParsedRecords}, rejected=${report.screening.rejectedParsedRecords}, unique groups=${report.screening.uniqueScreenedGroups}`,
    `Classification counts: LIKELY_FNB=${report.screening.classifications.LIKELY_FNB}, REVIEW_REQUIRED=${report.screening.classifications.REVIEW_REQUIRED}, OUT_OF_SCOPE=${report.screening.classifications.OUT_OF_SCOPE}`,
    "Rejection reasons:",
    ...Object.entries(report.rejectionReasons).map(
      ([reason, count]) => `  ${reason}: ${count}`,
    ),
    "Candidate titles for manual inspection (maximum 20):",
    ...(report.titles.length === 0
      ? ["  No accepted candidate groups."]
      : report.titles.map(
          ({ candidateId, classification, title }) =>
            `  [${classification}] ${title} | candidate-id=${candidateId}`,
        )),
    ...(report.omittedTitles > 0
      ? [`  ${report.omittedTitles} additional title(s) omitted.`]
      : []),
    "Evidence limitations:",
    "  Screening is a deterministic keyword heuristic, not factual validation.",
    "  A Google Trends search signal does not establish purchases, demand, revenue, or commercial viability.",
    "  Accepted provider observations remain pre-lifecycle candidates; independent source review is required before any catalog decision.",
    "  Missing related_queries remains unavailable and keeps the batch PARTIAL.",
  ];

  return lines.join("\n") + "\n";
}
