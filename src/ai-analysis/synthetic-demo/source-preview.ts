import "server-only";

import {
  BrightDataGoogleTrendsProvider,
  BrightDataProviderError,
  type BrightDataResponseDiagnostic,
  type BrightDataScreenedCandidateBatch,
} from "@/trend/brightdata-google-trends";

import { isSyntheticDemoEnabled, type SyntheticDemoEnvironment } from "./access";
import { BRIGHTDATA_DEMO_SOURCE_CONTEXT, type BrightDataDemoSourcePreview } from "./source-preview-contract";

export const BRIGHTDATA_DEMO_LIVE_AUTHORIZED_FLAG = "VENTUREX_LOCAL_DEMO_BRIGHTDATA_LIVE_AUTHORIZED";
export const BRIGHTDATA_DEMO_PRECHECK_CONFIRMED_FLAG = "VENTUREX_LOCAL_DEMO_BRIGHTDATA_PRECHECK_CONFIRMED";
export const MAX_BRIGHTDATA_DEMO_REQUESTS_PER_PROCESS = 1;

export interface BrightDataDemoRequestBudget {
  consume(): boolean;
}

export class ProcessBrightDataDemoRequestBudget implements BrightDataDemoRequestBudget {
  consume(): boolean {
    const globalState = globalThis as typeof globalThis & { __venturexLocalDemoBrightDataRequestCount?: number };
    const current = globalState.__venturexLocalDemoBrightDataRequestCount ?? 0;
    if (current >= MAX_BRIGHTDATA_DEMO_REQUESTS_PER_PROCESS) return false;
    globalState.__venturexLocalDemoBrightDataRequestCount = current + 1;
    return true;
  }
}

type BrightDataDemoProvider = Pick<BrightDataGoogleTrendsProvider, "collectAndScreenCandidateBatch">;
type BrightDataDemoScreenedBatch = Pick<
  BrightDataScreenedCandidateBatch,
  "status" | "candidates" | "totalRecords" | "acceptedRecords" | "rejectedRecords" | "fieldAvailability" | "screeningSummary"
>;

function noRequest(reason: "LIVE_REQUEST_DISABLED" | "LIVE_REQUEST_NOT_AUTHORIZED" | "PRECHECK_NOT_CONFIRMED" | "CONFIGURATION_NOT_READY"): BrightDataDemoSourcePreview {
  return {
    ...BRIGHTDATA_DEMO_SOURCE_CONTEXT,
    mode: "NOT_EXECUTED",
    attempted: false,
    reason,
  };
}

function safeResponseMetadata(diagnostic: BrightDataResponseDiagnostic | undefined, fallbackStatus: number) {
  if (!diagnostic) {
    return {
      httpStatus: fallbackStatus,
      contentType: null,
      responseBytes: null,
      rootType: "not_read",
    };
  }

  return {
    httpStatus: diagnostic.httpStatus,
    contentType: diagnostic.contentType?.slice(0, 120) ?? null,
    responseBytes: diagnostic.responseBytes,
    rootType: diagnostic.rootType,
    ...(diagnostic.arrayLength === undefined ? {} : { arrayLength: diagnostic.arrayLength }),
    ...(diagnostic.topLevelFields === undefined ? {} : { topLevelFields: diagnostic.topLevelFields.map((field) => ({ ...field })) }),
    ...(diagnostic.firstRecordFields === undefined ? {} : { firstRecordFields: diagnostic.firstRecordFields.map((field) => ({ ...field })) }),
    ...(diagnostic.validationIssues === undefined ? {} : {
      validationIssues: diagnostic.validationIssues.map(({ path, code }) => ({ path: [...path], code })),
    }),
  };
}

function safeRecordSummary(batch: BrightDataDemoScreenedBatch) {
  const candidates = batch.candidates.flatMap((candidate) => {
    const observation = candidate.observations[0];
    if (!observation) return [];

    const title = safeDisplayText(candidate.query, 160);
    if (!title.value) return [];

    const volume = safeMetric(observation.volume);
    const volumeChange = safeMetric(observation.volumeChange);
    const relatedQueries = observation.relatedQueries;
    return [{
      title: title.value,
      classification: candidate.classification,
      observationCount: candidate.observations.length,
      active: observation.active,
      startedAtUnixSeconds: observation.startedAtUnixSeconds,
      volume: volume.value,
      volumeChange: volumeChange.value,
      categoriesCount: observation.categories.length,
      relatedQueries: relatedQueries.availability === "AVAILABLE"
        ? { availability: "AVAILABLE" as const, count: relatedQueries.values.length }
        : { availability: "UNAVAILABLE" as const, count: null },
      displayTruncated: title.truncated || volume.truncated || volumeChange.truncated,
    }];
  });

  return {
    total: batch.totalRecords,
    accepted: batch.acceptedRecords,
    rejected: batch.rejectedRecords,
    screenedGroups: batch.screeningSummary.uniqueScreenedGroups,
    classifications: batch.screeningSummary.classifications,
    relatedQueries: batch.fieldAvailability.relatedQueries,
    candidates: candidates.slice(0, 10),
    omittedCandidates: Math.max(0, candidates.length - 10),
  };
}

function safeDisplayText(value: string, limit: number): { value: string; truncated: boolean } {
  const normalized = value
    .normalize("NFKC")
    .replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/gu, "")
    .replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu, "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  const characters = Array.from(normalized);
  return {
    value: characters.slice(0, limit).join(""),
    truncated: characters.length > limit,
  };
}

function safeMetric(value: BrightDataScreenedCandidateBatch["candidates"][number]["observations"][number]["volume"]) {
  if (typeof value !== "string") return { value, truncated: false };
  return safeDisplayText(value, 160);
}

export function buildBrightDataDemoPreviewSummary(
  batch: BrightDataDemoScreenedBatch,
  diagnostic: BrightDataResponseDiagnostic | undefined,
  retrievedAt: string,
) {
  return {
    ...BRIGHTDATA_DEMO_SOURCE_CONTEXT,
    retrievedAt,
    response: safeResponseMetadata(diagnostic, 200),
    completeness: batch.status,
    records: safeRecordSummary(batch),
  };
}

function blocked(
  reason: Extract<BrightDataDemoSourcePreview, { mode: "BLOCKED" }> ["reason"],
  attempted: boolean,
  diagnostic?: BrightDataResponseDiagnostic,
  fallbackStatus = 0,
): BrightDataDemoSourcePreview {
  return {
    ...BRIGHTDATA_DEMO_SOURCE_CONTEXT,
    mode: "BLOCKED",
    attempted,
    reason,
    ...(diagnostic || fallbackStatus ? { response: safeResponseMetadata(diagnostic, fallbackStatus || 0) } : {}),
  };
}

function providerFailureReason(error: unknown): Extract<BrightDataDemoSourcePreview, { mode: "BLOCKED" }> ["reason"] {
  if (error instanceof BrightDataProviderError) {
    if (error.code === "TIMEOUT") return "PROVIDER_TIMEOUT";
    if (error.code === "INVALID_JSON" || error.code === "INVALID_RESPONSE" || error.code === "RESPONSE_TOO_LARGE") {
      return "INVALID_RESPONSE";
    }
  }
  return "PROVIDER_UNAVAILABLE";
}

export async function createBrightDataDemoSourcePreview(options: {
  readonly env?: SyntheticDemoEnvironment;
  readonly budget?: BrightDataDemoRequestBudget;
  readonly createProvider?: (env: SyntheticDemoEnvironment, onDiagnostic: (diagnostic: BrightDataResponseDiagnostic) => void) => BrightDataDemoProvider;
  readonly now?: () => Date;
} = {}): Promise<BrightDataDemoSourcePreview> {
  const env = options.env ?? process.env;
  if (!isSyntheticDemoEnabled(env)) return noRequest("LIVE_REQUEST_DISABLED");
  if (env[BRIGHTDATA_DEMO_LIVE_AUTHORIZED_FLAG] !== "true") return noRequest("LIVE_REQUEST_NOT_AUTHORIZED");
  if (env[BRIGHTDATA_DEMO_PRECHECK_CONFIRMED_FLAG] !== "true") return noRequest("PRECHECK_NOT_CONFIRMED");
  if (env.BRIGHTDATA_TRENDS_ENABLED !== "true" || !env.BRIGHTDATA_TRENDS_API_KEY?.trim()) {
    return noRequest("CONFIGURATION_NOT_READY");
  }

  let diagnostic: BrightDataResponseDiagnostic | undefined;
  let provider: BrightDataDemoProvider;
  try {
    provider = (options.createProvider ?? ((providerEnv, onDiagnostic) => new BrightDataGoogleTrendsProvider({
      environment: providerEnv,
      onDevelopmentDiagnostic: onDiagnostic,
    })))(env, (nextDiagnostic) => { diagnostic = nextDiagnostic; });
  } catch {
    return blocked("CONFIGURATION_INVALID", false);
  }

  if (!(options.budget ?? new ProcessBrightDataDemoRequestBudget()).consume()) {
    return blocked("REQUEST_BUDGET_EXHAUSTED", false);
  }

  let batch: BrightDataDemoScreenedBatch;
  try {
    batch = await provider.collectAndScreenCandidateBatch();
  } catch (error) {
    return blocked(providerFailureReason(error), true, diagnostic, error instanceof BrightDataProviderError ? error.statusCode ?? 0 : 0);
  }

  return {
    ...buildBrightDataDemoPreviewSummary(
      batch,
      diagnostic,
      (options.now ?? (() => new Date()))().toISOString(),
    ),
    mode: "LIVE_VERIFIED" as const,
    attempted: true as const,
  };
}
