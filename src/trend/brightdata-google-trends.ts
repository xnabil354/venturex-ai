import "server-only";

import { z } from "zod";

import {
  FNB_CANDIDATE_CLASSIFICATIONS,
  screenFnbCandidates,
  type FnbCandidateClassification,
  type ScreenedFnbCandidate,
} from "./fnb-candidate-screening.ts";

export const BRIGHTDATA_TRENDS_ENDPOINT = "https://api.brightdata.com/request";
export const GOOGLE_TRENDS_INDONESIA_TARGET =
  "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1";
export const BRIGHTDATA_TRENDS_ZONE = "venturex_trends_serp";
export const GOOGLE_TRENDS_TIME_WINDOWS_HOURS = [4, 24, 48, 168] as const;
export type GoogleTrendsTimeWindowHours = (typeof GOOGLE_TRENDS_TIME_WINDOWS_HOURS)[number];

export function buildGoogleTrendsTrendingNowTarget(
  hours: GoogleTrendsTimeWindowHours,
): string {
  return `${GOOGLE_TRENDS_INDONESIA_TARGET}&hours=${hours}`;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const MIN_TIMEOUT_MS = 250;
const MAX_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_DIAGNOSTIC_FIELDS = 64;
const MAX_DIAGNOSTIC_ISSUES = 20;

const configSchema = z.object({
  enabled: z.enum(["true", "false"]).default("false"),
  apiKey: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().min(1).optional(),
  ),
  timeoutMs: z.coerce
    .number()
    .int()
    .min(MIN_TIMEOUT_MS)
    .max(MAX_TIMEOUT_MS)
    .default(DEFAULT_TIMEOUT_MS),
}).superRefine((config, context) => {
  if (config.enabled === "true" && !config.apiKey) {
    context.addIssue({
      code: "custom",
      path: ["apiKey"],
      message: "Required when Bright Data collection is enabled",
    });
  }
});

const environmentNames: Readonly<Record<string, string>> = {
  enabled: "BRIGHTDATA_TRENDS_ENABLED",
  apiKey: "BRIGHTDATA_TRENDS_API_KEY",
  timeoutMs: "BRIGHTDATA_TRENDS_TIMEOUT_MS",
};

export class BrightDataConfigurationError extends Error {
  override readonly name = "BrightDataConfigurationError";

  constructor(readonly environmentVariables: readonly string[]) {
    super(
      "Invalid Bright Data Trends configuration: " +
        environmentVariables.join(", "),
    );
  }
}

export type BrightDataEnvironment = Readonly<Record<string, string | undefined>>;

export type BrightDataTrendsConfig = {
  readonly enabled: boolean;
  readonly apiKey: string | undefined;
  readonly timeoutMs: number;
  readonly zone: typeof BRIGHTDATA_TRENDS_ZONE;
};

export function parseBrightDataTrendsConfig(
  environment: BrightDataEnvironment = process.env,
): BrightDataTrendsConfig {
  const parsed = configSchema.safeParse({
    enabled: environment.BRIGHTDATA_TRENDS_ENABLED,
    apiKey: environment.BRIGHTDATA_TRENDS_API_KEY,
    timeoutMs: environment.BRIGHTDATA_TRENDS_TIMEOUT_MS,
  });

  if (!parsed.success) {
    const variables = [
      ...new Set(
        parsed.error.issues.map((issue) => {
          const key = String(issue.path[0] ?? "");
          return environmentNames[key] ?? "Bright Data configuration";
        }),
      ),
    ];
    throw new BrightDataConfigurationError(variables);
  }

  return {
    enabled: parsed.data.enabled === "true",
    apiKey: parsed.data.apiKey,
    timeoutMs: parsed.data.timeoutMs,
    zone: BRIGHTDATA_TRENDS_ZONE,
  };
}

// Preserve the provider's numeric, display-string, or null metric representation.
// This permissive boundary is not an exhaustive Google Trends metric schema.
const providerMetricSchema = z.union([z.number().finite(), z.string()]).nullable();

const googleTrendsRecordSchema = z.object({
  query: z.string().max(500).refine((value) => value.trim().length > 0),
  geo: z.literal("ID"),
  volume: providerMetricSchema,
  volume_change: providerMetricSchema,
  categories: z.array(z.unknown()),
  active: z.boolean(),
  started_at: z.number().int().nonnegative().safe(),
  related_queries: z.array(z.string()).optional(),
}).passthrough();

export type ProviderMetric = z.infer<typeof providerMetricSchema>;

export type RelatedQueriesData =
  | Readonly<{
      availability: "AVAILABLE";
      values: readonly string[];
    }>
  | Readonly<{
      availability: "UNAVAILABLE";
      reason: "MISSING_FROM_PROVIDER_RESPONSE";
    }>;

export type BrightDataGoogleTrendsCandidate = {
  readonly query: string;
  readonly geo: "ID";
  readonly volume: ProviderMetric;
  readonly volumeChange: ProviderMetric;
  readonly categories: readonly unknown[];
  readonly active: boolean;
  readonly startedAtUnixSeconds: number;
  readonly relatedQueries: readonly string[];
  readonly provenance: {
    readonly provider: "BRIGHTDATA";
    readonly zone: typeof BRIGHTDATA_TRENDS_ZONE;
    readonly sourceName: "Google Trends Trending Now";
    readonly sourceUrl: string;
    readonly retrievedAt: string;
  };
};

export type BrightDataGoogleTrendsBatchCandidate = Omit<
  BrightDataGoogleTrendsCandidate,
  "relatedQueries"
> &
  Readonly<{
    relatedQueries: RelatedQueriesData;
  }>;

export type BrightDataProviderErrorCode =
  | "DISABLED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "UPSTREAM_ERROR"
  | "RESPONSE_TOO_LARGE"
  | "INVALID_JSON"
  | "INVALID_RESPONSE";

type DiagnosticValueType =
  | "array"
  | "boolean"
  | "null"
  | "number"
  | "object"
  | "string";

type DiagnosticField = Readonly<{
  name: string;
  type: DiagnosticValueType;
}>;

export type BrightDataRelatedQueriesRejectionReason =
  | "RELATED_QUERIES_NULL"
  | "RELATED_QUERIES_STRING"
  | "RELATED_QUERIES_NUMBER"
  | "RELATED_QUERIES_BOOLEAN"
  | "RELATED_QUERIES_OBJECT"
  | "RELATED_QUERIES_ARRAY_ITEM_TYPE";

type RelatedQueriesType = DiagnosticValueType | "missing";

type RelatedQueriesTypeCounts = Readonly<Record<RelatedQueriesType, number>>;

export type BrightDataRelatedQueriesAvailabilityCounts = Readonly<{
  available: number;
  unavailable: number;
  invalid: number;
  uninspectable: number;
}>;

export type BrightDataCandidateBatch = Readonly<{
  status: "COMPLETE" | "PARTIAL";
  candidates: readonly BrightDataGoogleTrendsBatchCandidate[];
  totalRecords: number;
  acceptedRecords: number;
  rejectedRecords: number;
  fieldAvailability: Readonly<{
    relatedQueries: BrightDataRelatedQueriesAvailabilityCounts;
  }>;
  rejectionReasons: Readonly<
    Partial<Record<BrightDataRelatedQueriesRejectionReason, number>>
  >;
}>;

export type BrightDataScreenedCandidateBatch = Omit<
  BrightDataCandidateBatch,
  "candidates"
> &
  Readonly<{
    candidates: readonly ScreenedFnbCandidate<BrightDataGoogleTrendsBatchCandidate>[];
    /** @deprecated Use screeningSummary.uniqueScreenedGroups; includes every classification. */
    screenedRecords: number;
    screeningSummary: Readonly<{
      inputRecords: number;
      acceptedParsedRecords: number;
      rejectedParsedRecords: number;
      uniqueScreenedGroups: number;
      classifications: Readonly<Record<FnbCandidateClassification, number>>;
    }>;
  }>;

export type BrightDataResponseDiagnostic = Readonly<{
  httpStatus: number;
  contentType: string | null;
  responseBytes: number | null;
  rootType:
    | DiagnosticValueType
    | "invalid_json"
    | "not_parsed"
    | "not_read";
  arrayLength?: number;
  topLevelFields?: readonly DiagnosticField[];
  firstRecordFields?: readonly DiagnosticField[];
  totalRecords?: number;
  acceptedRecords?: number;
  rejectedRecords?: number;
  rejectionReasons?: Readonly<
    Partial<Record<BrightDataRelatedQueriesRejectionReason, number>>
  >;
  relatedQueriesTypes?: RelatedQueriesTypeCounts;
  fieldAvailability?: BrightDataRelatedQueriesAvailabilityCounts;
  invalidRelatedQueryArrayItems?: number;
  totalSchemaIssueCount?: number;
  validationIssues?: readonly Readonly<{
    path: readonly (number | string)[];
    code: string;
  }>[];
}>;

type SafeDiagnosticCallback = (
  diagnostic: BrightDataResponseDiagnostic,
) => void;

const errorMessages: Readonly<Record<BrightDataProviderErrorCode, string>> = {
  DISABLED: "Bright Data Google Trends collection is disabled.",
  TIMEOUT: "Bright Data Google Trends request timed out.",
  NETWORK_ERROR: "Bright Data Google Trends request failed.",
  UPSTREAM_ERROR: "Bright Data Google Trends provider returned an error.",
  RESPONSE_TOO_LARGE: "Bright Data Google Trends response exceeded the size limit.",
  INVALID_JSON: "Bright Data Google Trends response was not valid JSON.",
  INVALID_RESPONSE: "Bright Data Google Trends response did not match the expected schema.",
};

export class BrightDataProviderError extends Error {
  override readonly name = "BrightDataProviderError";
  readonly statusCode: number | undefined;

  constructor(
    readonly code: BrightDataProviderErrorCode,
    statusCode?: number,
  ) {
    super(errorMessages[code]);
    this.statusCode = statusCode;
  }
}

type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type BrightDataGoogleTrendsProviderDependencies = {
  readonly environment?: BrightDataEnvironment;
  readonly fetcher?: FetchImplementation;
  readonly now?: () => Date;
  /** Optional metadata-only hook. It is invoked only when NODE_ENV is development. */
  readonly onDevelopmentDiagnostic?: SafeDiagnosticCallback;
};

class ResponseSizeLimitError extends Error {
  constructor(readonly observedBytes: number) {
    super("Response size limit exceeded");
  }
}

type BoundedResponseBody = Readonly<{
  text: string;
  byteLength: number;
}>;

async function readBoundedResponseBody(
  response: Response,
): Promise<BoundedResponseBody> {
  const reader = response.body?.getReader();
  if (!reader) {
    return { text: "", byteLength: 0 };
  }

  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const nextLength = byteLength + value.byteLength;
      if (nextLength > MAX_RESPONSE_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // Cancellation is best-effort; the size limit still fails closed.
        }
        throw new ResponseSizeLimitError(MAX_RESPONSE_BYTES + 1);
      }

      byteLength = nextLength;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    text: new TextDecoder().decode(bytes),
    byteLength,
  };
}

function diagnosticType(value: unknown): DiagnosticValueType {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";

  const valueType = typeof value;
  if (valueType === "boolean" || valueType === "number" || valueType === "string") {
    return valueType;
  }
  return "object";
}

function diagnosticFieldName(name: string): string {
  return /^[A-Za-z0-9_]{1,80}$/.test(name) ? name : "[redacted]";
}

function diagnosticFields(
  value: unknown,
): readonly DiagnosticField[] | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  return Object.entries(value)
    .slice(0, MAX_DIAGNOSTIC_FIELDS)
    .map(([name, fieldValue]) => ({
      name: diagnosticFieldName(name),
      type: diagnosticType(fieldValue),
    }));
}

function safeDiagnosticPath(
  path: readonly PropertyKey[],
): readonly (number | string)[] {
  return path.slice(0, 12).map((part) =>
    typeof part === "number" ? part : diagnosticFieldName(String(part)),
  );
}

function safeContentType(response: Response): string | null {
  const header = response.headers.get("content-type");
  if (!header) return null;

  const mediaType = header.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType && /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mediaType)
    ? mediaType
    : "other";
}

function buildResponseDiagnostic(
  response: Response,
  responseBytes: number | null,
  responseJson?: unknown,
  issues?: readonly z.ZodIssue[],
  invalidJson = false,
  batchDetails?: Readonly<{
    acceptedRecords: number;
    rejectedRecords: number;
    rejectionReasons: Readonly<
      Partial<Record<BrightDataRelatedQueriesRejectionReason, number>>
    >;
    relatedQueriesTypes: RelatedQueriesTypeCounts;
    fieldAvailability: BrightDataRelatedQueriesAvailabilityCounts;
    invalidRelatedQueryArrayItems: number;
    totalSchemaIssueCount: number;
  }>,
): BrightDataResponseDiagnostic {
  const rootType = invalidJson
    ? "invalid_json"
    : responseJson === undefined
      ? "not_parsed"
      : diagnosticType(responseJson);
  const arrayLength = Array.isArray(responseJson)
    ? responseJson.length
    : undefined;
  const firstRecord = Array.isArray(responseJson) ? responseJson[0] : undefined;
  const firstRecordFields = Array.isArray(responseJson)
    ? diagnosticFields(firstRecord)
    : undefined;
  const topLevelFields = Array.isArray(responseJson)
    ? undefined
    : diagnosticFields(responseJson);

  return {
    httpStatus: response.status,
    contentType: safeContentType(response),
    responseBytes,
    rootType,
    ...(arrayLength === undefined ? {} : { arrayLength }),
    ...(firstRecordFields ? { firstRecordFields } : {}),
    ...(topLevelFields ? { topLevelFields } : {}),
    ...(Array.isArray(responseJson)
      ? {
          totalRecords: responseJson.length,
          ...(batchDetails
            ? {
                acceptedRecords: batchDetails.acceptedRecords,
                rejectedRecords: batchDetails.rejectedRecords,
                rejectionReasons: batchDetails.rejectionReasons,
                relatedQueriesTypes: batchDetails.relatedQueriesTypes,
                fieldAvailability: batchDetails.fieldAvailability,
                invalidRelatedQueryArrayItems:
                  batchDetails.invalidRelatedQueryArrayItems,
                totalSchemaIssueCount: batchDetails.totalSchemaIssueCount,
              }
            : {}),
        }
      : {}),
    ...(issues
      ? {
          validationIssues: issues
            .slice(0, MAX_DIAGNOSTIC_ISSUES)
            .map((issue) => ({
              path: safeDiagnosticPath(issue.path),
              code: issue.code,
            })),
        }
      : {}),
  };
}

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

function mapProviderRecord(
  record: z.infer<typeof googleTrendsRecordSchema>,
  retrievedAt: string,
  zone: typeof BRIGHTDATA_TRENDS_ZONE,
  sourceUrl: string,
): BrightDataGoogleTrendsBatchCandidate {
  return {
    query: record.query,
    geo: record.geo,
    volume: record.volume,
    volumeChange: record.volume_change,
    categories: record.categories,
    active: record.active,
    startedAtUnixSeconds: record.started_at,
    relatedQueries:
      record.related_queries === undefined
        ? {
            availability: "UNAVAILABLE",
            reason: "MISSING_FROM_PROVIDER_RESPONSE",
          }
        : { availability: "AVAILABLE", values: record.related_queries },
    provenance: {
      provider: "BRIGHTDATA",
      zone,
      sourceName: "Google Trends Trending Now",
      sourceUrl,
      retrievedAt,
    },
  };
}

function getRelatedQueriesAvailabilityCounts(
  records: readonly unknown[],
): BrightDataRelatedQueriesAvailabilityCounts {
  const counts = { available: 0, unavailable: 0, invalid: 0, uninspectable: 0 };

  for (const record of records) {
    if (typeof record !== "object" || record === null || Array.isArray(record)) {
      counts.uninspectable += 1;
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(record, "related_queries")) {
      counts.unavailable += 1;
      continue;
    }

    const value = (record as Record<string, unknown>).related_queries;
    if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
      counts.available += 1;
    } else {
      counts.invalid += 1;
    }
  }

  return counts;
}

function toLegacyCandidate(
  candidate: BrightDataGoogleTrendsBatchCandidate,
): BrightDataGoogleTrendsCandidate {
  if (candidate.relatedQueries.availability !== "AVAILABLE") {
    throw new BrightDataProviderError("INVALID_RESPONSE");
  }

  return { ...candidate, relatedQueries: candidate.relatedQueries.values };
}

function getRelatedQueriesTypeCounts(
  records: readonly unknown[],
): Record<RelatedQueriesType, number> {
  const counts: Record<RelatedQueriesType, number> = {
    missing: 0,
    null: 0,
    string: 0,
    number: 0,
    boolean: 0,
    array: 0,
    object: 0,
  };

  for (const record of records) {
    if (typeof record !== "object" || record === null || Array.isArray(record)) {
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(record, "related_queries")) {
      counts.missing += 1;
      continue;
    }

    counts[diagnosticType((record as Record<string, unknown>).related_queries)] += 1;
  }

  return counts;
}

function getRelatedQueriesRejectionReason(
  record: unknown,
  issues: readonly z.ZodIssue[],
): BrightDataRelatedQueriesRejectionReason | undefined {
  if (
    issues.length === 0 ||
    !issues.every(
      (issue) =>
        issue.code === "invalid_type" && issue.path[0] === "related_queries",
    )
  ) {
    return undefined;
  }

  if (typeof record !== "object" || record === null || Array.isArray(record)) {
    return undefined;
  }

  const relatedQueries = (record as Record<string, unknown>).related_queries;
  if (relatedQueries === null) return "RELATED_QUERIES_NULL";
  if (typeof relatedQueries === "string") return "RELATED_QUERIES_STRING";
  if (typeof relatedQueries === "number") return "RELATED_QUERIES_NUMBER";
  if (typeof relatedQueries === "boolean") return "RELATED_QUERIES_BOOLEAN";
  if (Array.isArray(relatedQueries)) {
    return "RELATED_QUERIES_ARRAY_ITEM_TYPE";
  }
  if (typeof relatedQueries === "object") return "RELATED_QUERIES_OBJECT";
  return undefined;
}

function getInvalidRelatedQueriesArrayItemCount(
  issues: readonly z.ZodIssue[],
): number {
  return issues.filter(
    (issue) =>
      issue.code === "invalid_type" &&
      issue.path[0] === "related_queries" &&
      typeof issue.path[1] === "number",
  ).length;
}

export class BrightDataGoogleTrendsProvider {
  private readonly config: BrightDataTrendsConfig;
  private readonly fetcher: FetchImplementation;
  private readonly now: () => Date;
  private readonly onDevelopmentDiagnostic: SafeDiagnosticCallback | undefined;

  constructor(dependencies: BrightDataGoogleTrendsProviderDependencies = {}) {
    this.config = parseBrightDataTrendsConfig(dependencies.environment);
    this.fetcher = dependencies.fetcher ?? globalThis.fetch;
    this.now = dependencies.now ?? (() => new Date());
    this.onDevelopmentDiagnostic = dependencies.onDevelopmentDiagnostic;
  }

  private emitDevelopmentDiagnostic(
    diagnostic: BrightDataResponseDiagnostic,
  ): void {
    if (process.env.NODE_ENV !== "development" || !this.onDevelopmentDiagnostic) {
      return;
    }

    try {
      this.onDevelopmentDiagnostic(diagnostic);
    } catch {
      // Diagnostics must not change provider behavior.
    }
  }

  async collectCandidates(options: { readonly hours?: GoogleTrendsTimeWindowHours } = {}): Promise<readonly BrightDataGoogleTrendsCandidate[]> {
    const batch = await this.collectCandidateBatch(options);
    if (batch.status === "PARTIAL") {
      throw new BrightDataProviderError("INVALID_RESPONSE");
    }
    return batch.candidates.map(toLegacyCandidate);
  }

  /**
   * Explicit partial-result API. Rows are omitted only when every validation
   * issue is a related_queries invalid_type issue. All other schema failures
   * fail the complete response closed.
   */
  async collectCandidateBatch(options: { readonly hours?: GoogleTrendsTimeWindowHours } = {}): Promise<BrightDataCandidateBatch> {
    if (!this.config.enabled) {
      throw new BrightDataProviderError("DISABLED");
    }

    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new BrightDataConfigurationError([
        "BRIGHTDATA_TRENDS_API_KEY",
      ]);
    }

    const sourceUrl = options.hours === undefined
      ? GOOGLE_TRENDS_INDONESIA_TARGET
      : buildGoogleTrendsTrendingNowTarget(options.hours);

    let response: Response;
    try {
      response = await this.fetcher(BRIGHTDATA_TRENDS_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          zone: this.config.zone,
          url: sourceUrl,
          format: "raw",
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
        cache: "no-store",
      });
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new BrightDataProviderError("TIMEOUT");
      }
      throw new BrightDataProviderError("NETWORK_ERROR");
    }

    if (!response.ok) {
      this.emitDevelopmentDiagnostic(
        buildResponseDiagnostic(response, null, undefined),
      );
      throw new BrightDataProviderError("UPSTREAM_ERROR", response.status);
    }

    let responseBody: BoundedResponseBody;
    try {
      responseBody = await readBoundedResponseBody(response);
    } catch (error) {
      if (error instanceof ResponseSizeLimitError) {
        this.emitDevelopmentDiagnostic(
          buildResponseDiagnostic(response, error.observedBytes),
        );
        throw new BrightDataProviderError("RESPONSE_TOO_LARGE");
      }
      if (isTimeoutError(error)) {
        throw new BrightDataProviderError("TIMEOUT");
      }
      throw new BrightDataProviderError("NETWORK_ERROR");
    }

    let responseJson: unknown;
    try {
      responseJson = JSON.parse(responseBody.text) as unknown;
    } catch {
      this.emitDevelopmentDiagnostic(
        buildResponseDiagnostic(
          response,
          responseBody.byteLength,
          undefined,
          undefined,
          true,
        ),
      );
      throw new BrightDataProviderError("INVALID_JSON");
    }

    if (!Array.isArray(responseJson)) {
      this.emitDevelopmentDiagnostic(
        buildResponseDiagnostic(response, responseBody.byteLength, responseJson),
      );
      throw new BrightDataProviderError("INVALID_RESPONSE");
    }

    const retrievedAt = this.now().toISOString();
    const accepted: z.infer<typeof googleTrendsRecordSchema>[] = [];
    const allIssues: z.ZodIssue[] = [];
    const diagnosticIssues: z.ZodIssue[] = [];
    const rejectionReasons: Partial<
      Record<BrightDataRelatedQueriesRejectionReason, number>
    > = {};
    let hasUnsupportedSchemaError = false;

    for (const [recordIndex, record] of (responseJson as unknown[]).entries()) {
      const parsed = googleTrendsRecordSchema.safeParse(record);
      if (parsed.success) {
        accepted.push(parsed.data);
        continue;
      }

      allIssues.push(...parsed.error.issues);
      diagnosticIssues.push(
        ...parsed.error.issues.map((issue) => ({
          ...issue,
          path: [recordIndex, ...issue.path],
        })),
      );
      const rejectionReason = getRelatedQueriesRejectionReason(
        record,
        parsed.error.issues,
      );
      if (rejectionReason) {
        rejectionReasons[rejectionReason] =
          (rejectionReasons[rejectionReason] ?? 0) + 1;
      } else {
        hasUnsupportedSchemaError = true;
      }
    }

    const rejectedRecords = responseJson.length - accepted.length;
    const batchDetails = {
      acceptedRecords: accepted.length,
      rejectedRecords,
      rejectionReasons,
      relatedQueriesTypes: getRelatedQueriesTypeCounts(responseJson),
      fieldAvailability: getRelatedQueriesAvailabilityCounts(responseJson),
      invalidRelatedQueryArrayItems:
        getInvalidRelatedQueriesArrayItemCount(allIssues),
      totalSchemaIssueCount: allIssues.length,
    } as const;

    this.emitDevelopmentDiagnostic(
      buildResponseDiagnostic(
        response,
        responseBody.byteLength,
        responseJson,
        diagnosticIssues,
        false,
        batchDetails,
      ),
    );

    if (
      hasUnsupportedSchemaError ||
      (responseJson.length > 0 && accepted.length === 0)
    ) {
      throw new BrightDataProviderError("INVALID_RESPONSE");
    }

    return {
      status:
        rejectedRecords > 0 || batchDetails.fieldAvailability.unavailable > 0
          ? "PARTIAL"
          : "COMPLETE",
      candidates: accepted.map((record) =>
        mapProviderRecord(record, retrievedAt, this.config.zone, sourceUrl),
      ),
      totalRecords: responseJson.length,
      acceptedRecords: accepted.length,
      rejectedRecords,
      fieldAvailability: { relatedQueries: batchDetails.fieldAvailability },
      rejectionReasons,
    };
  }

  async collectAndScreenCandidates(options: { readonly hours?: GoogleTrendsTimeWindowHours } = {}): Promise<
    readonly ScreenedFnbCandidate[]
  > {
    return screenFnbCandidates(await this.collectCandidates(options));
  }

  async collectAndScreenCandidateBatch(options: { readonly hours?: GoogleTrendsTimeWindowHours } = {}): Promise<
    BrightDataScreenedCandidateBatch
  > {
    const batch = await this.collectCandidateBatch(options);
    const candidates = screenFnbCandidates(batch.candidates);
    const classifications = Object.fromEntries(
      FNB_CANDIDATE_CLASSIFICATIONS.map((classification) => [classification, 0]),
    ) as Record<FnbCandidateClassification, number>;
    for (const candidate of candidates) {
      classifications[candidate.classification] += 1;
    }
    return {
      ...batch,
      candidates,
      screenedRecords: candidates.length,
      screeningSummary: {
        inputRecords: batch.totalRecords,
        acceptedParsedRecords: batch.acceptedRecords,
        rejectedParsedRecords: batch.rejectedRecords,
        uniqueScreenedGroups: candidates.length,
        classifications,
      },
    };
  }
}
