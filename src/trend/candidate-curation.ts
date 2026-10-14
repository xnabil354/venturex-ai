import { createHash } from "node:crypto";

import {
  BRIGHTDATA_TRENDS_ZONE,
  GOOGLE_TRENDS_TIME_WINDOWS_HOURS,
  type BrightDataGoogleTrendsBatchCandidate,
  type BrightDataScreenedCandidateBatch,
  type ProviderMetric,
} from "./brightdata-google-trends.ts";

export type CandidateCurationMode = "OFFLINE_SYNTHETIC" | "LIVE_PROVIDER";

export type CandidateCurationPacket = Readonly<{
  packetType: "VENTUREX_BRIGHTDATA_CANDIDATE_CURATION_REVIEW";
  schemaVersion: 1;
  mode: CandidateCurationMode;
  generatedAt: string;
  operatorBoundary: "LOCAL_CLI_IDENTITY_NOT_AUTHENTICATED_OR_AUDIT_RECORDED";
  candidate: Readonly<{
    id: string;
    query: string;
    geo: "ID";
    classification: BrightDataScreenedCandidateBatch["candidates"][number]["classification"];
    matchedKeywords: readonly string[];
    screeningExplanation: string;
    heuristicOnly: true;
  }>;
  response: Readonly<{
    status: "COMPLETE" | "PARTIAL";
    retrievedRecords: number;
    acceptedRecords: number;
    rejectedRecords: number;
    relatedQueriesAvailability: BrightDataScreenedCandidateBatch["fieldAvailability"]["relatedQueries"];
  }>;
  observations: readonly Readonly<{
    provider: "BRIGHTDATA";
    zone: typeof BRIGHTDATA_TRENDS_ZONE;
    sourceName: "Google Trends Trending Now";
    sourceUrl: string;
    retrievalTimestamp: string | null;
    providerStartedAtUnixSeconds: number;
    fieldAvailability: Readonly<{
      query: "AVAILABLE";
      geo: "AVAILABLE";
      volume: "AVAILABLE" | "UNAVAILABLE_NULL";
      volumeChange: "AVAILABLE" | "UNAVAILABLE_NULL";
      categories: "AVAILABLE";
      active: "AVAILABLE";
      startedAt: "AVAILABLE";
      relatedQueries: "AVAILABLE" | "UNAVAILABLE";
    }>;
    observationPeriod: Readonly<{
      status: "UNKNOWN";
      start: null;
      end: null;
      reason: string;
    }>;
    metrics: Readonly<{
      volume: Readonly<{ value: ProviderMetric; unit: "UNSPECIFIED" }>;
      volumeChange: Readonly<{ value: ProviderMetric; unit: "UNSPECIFIED" }>;
      active: Readonly<{ value: boolean; unit: null; semantics: "PROVIDER_FLAG_UNVERIFIED" }>;
      categories: Readonly<{ itemCount: number; valuesIncluded: false }>;
      relatedQueries: Readonly<{
        availability: "AVAILABLE" | "UNAVAILABLE";
        itemCount: number | null;
        valuesIncluded: false;
      }>;
    }>;
  }>[];
  supportingEvidence: readonly Readonly<{
    kind: "PROVIDER_OBSERVATION" | "SYNTHETIC_FIXTURE";
    sourceName: "Google Trends Trending Now";
    sourceReference: string;
    sourceDate: null;
    retrievalTimestamp: string | null;
    supportingDetail: string;
    limitations: readonly string[];
  }>[];
  relevanceHypothesis: Readonly<{
    status: "HEURISTIC_ONLY" | "NO_FNB_HYPOTHESIS";
    statement: string;
    factualApproval: false;
  }>;
  evidenceSufficiency: "INSUFFICIENT_FOR_CATALOG_VALIDATION";
  catalogFieldsNotSupplied: readonly string[];
  importReadiness: Readonly<{
    status: "NOT_READY_FOR_IMPORT";
    compatibleWithCurrentManifest: false;
    reasons: readonly string[];
  }>;
  humanReviewRequired: readonly string[];
  limitations: readonly string[];
}>;

export class CandidateCurationError extends Error {
  override readonly name = "CandidateCurationError";

  constructor(
    readonly code:
      | "NO_SELECTION"
      | "DUPLICATE_SELECTION"
      | "DUPLICATE_CANDIDATE_IDENTITY"
      | "CANDIDATE_NOT_FOUND"
      | "INVALID_SOURCE_REFERENCE"
      | "INVALID_CANDIDATE",
  ) {
    super("Candidate curation could not prepare the requested review packet.");
  }
}

type ScreenedCandidate = BrightDataScreenedCandidateBatch["candidates"][number];

const coreCatalogReadinessReasons = [
  "The current importer accepts a complete version-1 catalog manifest (two Trends and four to six Opportunity hypotheses), not a single provider candidate.",
  "The current version-1 manifest is specific to Google Year in Search 2025, including fixed source references and a fixed observation window; this Trending Now observation does not satisfy that source contract.",
  "Curated summary, description, business relevance, and affected audiences still require human decisions; this command does not create Opportunity hypotheses.",
] as const;

const candidateLimitations = [
  "The collection target URL identifies Google Trends Trending Now for Indonesia; it is not a candidate-specific source page.",
  "The deterministic F&B screening classification is heuristic triage, not factual validation or evidence of demand, purchase intent, revenue, or commercial viability.",
  "The adapter does not define units or full semantics for volume or volume_change; the provider values are preserved without interpretation.",
  "The provider-reported started_at value is preserved separately and is not treated as an observation-period boundary.",
] as const;

const humanReviewChecklist = [
  "Open and verify the source and query context; confirm that this provider observation matches the official source material.",
  "Decide whether the query represents an in-scope F&B signal and choose the Trend taxonomy and F&B subject area from evidence.",
  "Establish the signal direction and observation period from authoritative source information; do not infer them from retrieval time, started_at, volume, or volume_change.",
  "Write a factual Trend title, summary, and description that distinguish observation from interpretation.",
  "Add traceable supporting sources and their limitations; retain sourceDate as unknown unless the source supplies it.",
  "Decide the general business relevance and affected user types; do not personalize this explanation or generate an Opportunity automatically.",
  "Check the intended import target. The current version-1 importer is restricted to its reviewed Year in Search 2025 manifest contract.",
] as const;

function assertCandidateSource(
  candidate: ScreenedCandidate,
): asserts candidate is ScreenedCandidate {
  if (!candidate || !Array.isArray(candidate.observations) || candidate.observations.length === 0) {
    throw new CandidateCurationError("INVALID_CANDIDATE");
  }

  for (const observation of candidate.observations) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(observation.provenance.sourceUrl);
    } catch {
      throw new CandidateCurationError("INVALID_SOURCE_REFERENCE");
    }
    const queryEntries = [...parsedUrl.searchParams.entries()];
    const queryNamesAreSupported = queryEntries.every(([name]) =>
      ["geo", "hl", "brd_json", "hours"].includes(name),
    );
    const hoursValues = parsedUrl.searchParams.getAll("hours");
    const supportedHours = hoursValues.length === 0 || (
      hoursValues.length === 1 && GOOGLE_TRENDS_TIME_WINDOWS_HOURS.some((hours) => String(hours) === hoursValues[0])
    );
    if (
      parsedUrl.protocol !== "https:" ||
      parsedUrl.origin !== "https://trends.google.com" ||
      parsedUrl.pathname !== "/trending" ||
      parsedUrl.searchParams.getAll("geo").length !== 1 ||
      parsedUrl.searchParams.get("geo") !== "ID" ||
      parsedUrl.searchParams.getAll("hl").length !== 1 ||
      parsedUrl.searchParams.get("hl") !== "id" ||
      parsedUrl.searchParams.getAll("brd_json").length !== 1 ||
      parsedUrl.searchParams.get("brd_json") !== "1" ||
      !queryNamesAreSupported ||
      !supportedHours ||
      observation.provenance.provider !== "BRIGHTDATA" ||
      observation.provenance.zone !== BRIGHTDATA_TRENDS_ZONE ||
      observation.provenance.sourceName !== "Google Trends Trending Now" ||
      !Number.isFinite(Date.parse(observation.provenance.retrievedAt))
    ) {
      throw new CandidateCurationError("INVALID_SOURCE_REFERENCE");
    }
  }
}

export function candidateCurationId(candidate: ScreenedCandidate): string {
  assertCandidateSource(candidate);
  const firstObservation = candidate.observations[0];
  if (!firstObservation) {
    throw new CandidateCurationError("INVALID_CANDIDATE");
  }
  const normalizedIdentity = candidate.normalizedQuery ||
    candidate.query.trim().toLocaleLowerCase("id-ID");
  const identity = JSON.stringify([
    firstObservation.provenance.sourceUrl,
    firstObservation.geo,
    normalizedIdentity,
    candidate.observations.map((observation) => ({
      query: observation.query,
      volume: observation.volume,
      volumeChange: observation.volumeChange,
      categories: observation.categories,
      active: observation.active,
      startedAtUnixSeconds: observation.startedAtUnixSeconds,
      relatedQueries: observation.relatedQueries,
    })),
  ]);
  const digest = createHash("sha256").update(identity).digest("hex");
  return `gtrends-${digest}`;
}

function providerMetric(value: ProviderMetric): Readonly<{
  value: ProviderMetric;
  unit: "UNSPECIFIED";
}> {
  return { value, unit: "UNSPECIFIED" };
}

function buildPacket(
  candidate: ScreenedCandidate,
  batch: BrightDataScreenedCandidateBatch,
  mode: CandidateCurationMode,
  generatedAt: string,
): CandidateCurationPacket {
  assertCandidateSource(candidate);
  const candidateId = candidateCurationId(candidate);
  const firstObservation = candidate.observations[0];
  if (!firstObservation) {
    throw new CandidateCurationError("INVALID_CANDIDATE");
  }

  const isOutOfScope = candidate.classification === "OUT_OF_SCOPE";
  const relevanceStatement = isOutOfScope
    ? "The screening heuristic did not identify this query as an in-scope F&B candidate. No F&B business-relevance hypothesis is supplied."
    : `${mode === "OFFLINE_SYNTHETIC" ? "The synthetic fixture was" : "The screening heuristic"} classified this query as ${candidate.classification}${candidate.matchedKeywords.length > 0 ? ` based on matched terms (${candidate.matchedKeywords.join(", ")})` : " after an ambiguity check"}. This is only a cue for human review, not a verified market or business claim.`;

  const observations = candidate.observations.map((observation) => ({
    provider: observation.provenance.provider,
    zone: observation.provenance.zone,
    sourceName: observation.provenance.sourceName,
    sourceUrl: observation.provenance.sourceUrl,
    retrievalTimestamp:
      mode === "LIVE_PROVIDER" ? observation.provenance.retrievedAt : null,
    providerStartedAtUnixSeconds: observation.startedAtUnixSeconds,
    fieldAvailability: {
      query: "AVAILABLE",
      geo: "AVAILABLE",
      volume: observation.volume === null ? "UNAVAILABLE_NULL" : "AVAILABLE",
      volumeChange: observation.volumeChange === null ? "UNAVAILABLE_NULL" : "AVAILABLE",
      categories: "AVAILABLE",
      active: "AVAILABLE",
      startedAt: "AVAILABLE",
      relatedQueries: observation.relatedQueries.availability,
    } as const,
    observationPeriod: {
      status: "UNKNOWN" as const,
      start: null,
      end: null,
      reason: "The adapter preserves started_at as a provider timestamp but has no verified contract equating it to a source observation-period boundary.",
    },
    metrics: {
      volume: providerMetric(observation.volume),
      volumeChange: providerMetric(observation.volumeChange),
      active: {
        value: observation.active,
        unit: null,
        semantics: "PROVIDER_FLAG_UNVERIFIED" as const,
      },
      categories: {
        itemCount: observation.categories.length,
        valuesIncluded: false as const,
      },
      relatedQueries: {
        availability: observation.relatedQueries.availability,
        itemCount:
          observation.relatedQueries.availability === "AVAILABLE"
            ? observation.relatedQueries.values.length
            : null,
        valuesIncluded: false as const,
      },
    },
  }));

  const sourceLimitations = [
    mode === "LIVE_PROVIDER"
      ? "Provider observation only; it has not been independently verified."
      : "Synthetic fixture only; no live provider observation or source verification occurred.",
    "Retrieval timestamp is collection metadata, not a source date or observation period.",
    "A single Trending Now target reference does not supply the independent source evidence required by the current curated manifest.",
  ];

  return {
    packetType: "VENTUREX_BRIGHTDATA_CANDIDATE_CURATION_REVIEW",
    schemaVersion: 1,
    mode,
    generatedAt,
    operatorBoundary: "LOCAL_CLI_IDENTITY_NOT_AUTHENTICATED_OR_AUDIT_RECORDED",
    candidate: {
      id: candidateId,
      query: candidate.query,
      geo: firstObservation.geo,
      classification: candidate.classification,
      matchedKeywords: candidate.matchedKeywords,
      screeningExplanation: candidate.explanation,
      heuristicOnly: true,
    },
    response: {
      status: batch.status,
      retrievedRecords: batch.totalRecords,
      acceptedRecords: batch.acceptedRecords,
      rejectedRecords: batch.rejectedRecords,
      relatedQueriesAvailability: batch.fieldAvailability.relatedQueries,
    },
    observations,
    supportingEvidence: [
      {
        kind: mode === "LIVE_PROVIDER" ? "PROVIDER_OBSERVATION" : "SYNTHETIC_FIXTURE",
        sourceName: firstObservation.provenance.sourceName,
        sourceReference: firstObservation.provenance.sourceUrl,
        sourceDate: null,
        retrievalTimestamp:
          mode === "LIVE_PROVIDER" ? firstObservation.provenance.retrievedAt : null,
        supportingDetail:
          mode === "LIVE_PROVIDER"
            ? "The provider returned the selected query for Indonesia in a Google Trends Trending Now response. This records what the provider returned; it does not independently verify the source claim or business relevance."
            : "This synthetic fixture imitates a Google Trends Trending Now record. No provider response was observed, and it is not evidence for a Trend or business claim.",
        limitations: sourceLimitations,
      },
    ],
    relevanceHypothesis: {
      status: isOutOfScope ? "NO_FNB_HYPOTHESIS" : "HEURISTIC_ONLY",
      statement: relevanceStatement,
      factualApproval: false,
    },
    evidenceSufficiency: "INSUFFICIENT_FOR_CATALOG_VALIDATION",
    catalogFieldsNotSupplied: [
      "Curated Trend title (the observed query is not an approved catalog title).",
      "Approved Trend taxonomy category and F&B subject area.",
      "Factual signal summary and description.",
      "Evidence-supported direction and source observation period.",
      "Human-reviewed supporting evidence meeting the intended import contract.",
      "General business-relevance explanation and affected user types.",
      "Manifest record identifiers and the complete manifest-level record set.",
      "Any Opportunity hypotheses; automatic Opportunity creation is outside this workflow.",
      "Factual-review and Product/Data Owner decisions.",
    ],
    importReadiness: {
      status: "NOT_READY_FOR_IMPORT",
      compatibleWithCurrentManifest: false,
      reasons: [
        ...coreCatalogReadinessReasons,
        mode === "LIVE_PROVIDER"
          ? "A provider response is not independent factual verification. A designated reviewer must check the source, F&B scope, taxonomy, direction, observation period, and limitations."
          : "Synthetic fixture data are not factual observations and cannot support catalog import or validation.",
        ...(batch.status === "PARTIAL"
          ? ["The input batch is PARTIAL; rejected records and unavailable auxiliary fields remain visible in this packet."]
          : []),
        ...(isOutOfScope
          ? ["The screener classified this candidate OUT_OF_SCOPE; it must not be curated as an F&B Trend without contrary factual evidence and review."]
          : []),
      ],
    },
    humanReviewRequired: [...humanReviewChecklist],
    limitations: [
      mode === "LIVE_PROVIDER"
        ? "The candidate is an observation returned by the provider and has not been independently verified against Google Trends."
        : "Synthetic fixture only; this candidate is not a real-world observation and must not be presented as market evidence.",
      ...candidateLimitations,
    ],
  };
}

export function createCandidateCurationPackets(
  batch: BrightDataScreenedCandidateBatch,
  selectedCandidateIds: readonly string[],
  mode: CandidateCurationMode,
  generatedAt = new Date().toISOString(),
): readonly CandidateCurationPacket[] {
  if (selectedCandidateIds.length === 0) {
    throw new CandidateCurationError("NO_SELECTION");
  }
  if (new Set(selectedCandidateIds).size !== selectedCandidateIds.length) {
    throw new CandidateCurationError("DUPLICATE_SELECTION");
  }
  if (!Number.isFinite(Date.parse(generatedAt))) {
    throw new CandidateCurationError("INVALID_CANDIDATE");
  }

  const candidateById = new Map<string, ScreenedCandidate>();
  for (const candidate of batch.candidates) {
    const id = candidateCurationId(candidate);
    if (candidateById.has(id)) {
      throw new CandidateCurationError("DUPLICATE_CANDIDATE_IDENTITY");
    }
    candidateById.set(id, candidate);
  }

  const selected = selectedCandidateIds.map((id) => {
    const candidate = candidateById.get(id);
    if (!candidate) {
      throw new CandidateCurationError("CANDIDATE_NOT_FOUND");
    }
    return candidate;
  });

  return selected.map((candidate) => buildPacket(candidate, batch, mode, generatedAt));
}
