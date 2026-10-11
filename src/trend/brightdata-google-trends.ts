import "server-only";

import { z } from "zod";

import {
  screenFnbCandidates,
  type ScreenedFnbCandidate,
} from "./fnb-candidate-screening";

export const BRIGHTDATA_TRENDS_ENDPOINT = "https://api.brightdata.com/request";
export const GOOGLE_TRENDS_INDONESIA_TARGET =
  "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1";
export const BRIGHTDATA_TRENDS_ZONE = "venturex_trends_serp";

const DEFAULT_TIMEOUT_MS = 10_000;
const MIN_TIMEOUT_MS = 250;
const MAX_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_CHARACTERS = 1_000_000;

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
  related_queries: z.array(z.string()),
}).passthrough();

const googleTrendsResponseSchema = z.array(googleTrendsRecordSchema);

export type ProviderMetric = z.infer<typeof providerMetricSchema>;

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
    readonly sourceUrl: typeof GOOGLE_TRENDS_INDONESIA_TARGET;
    readonly retrievedAt: string;
  };
};

export type BrightDataProviderErrorCode =
  | "DISABLED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "UPSTREAM_ERROR"
  | "RESPONSE_TOO_LARGE"
  | "INVALID_JSON"
  | "INVALID_RESPONSE";

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
};

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
): BrightDataGoogleTrendsCandidate {
  return {
    query: record.query,
    geo: record.geo,
    volume: record.volume,
    volumeChange: record.volume_change,
    categories: record.categories,
    active: record.active,
    startedAtUnixSeconds: record.started_at,
    relatedQueries: record.related_queries,
    provenance: {
      provider: "BRIGHTDATA",
      zone,
      sourceName: "Google Trends Trending Now",
      sourceUrl: GOOGLE_TRENDS_INDONESIA_TARGET,
      retrievedAt,
    },
  };
}

export class BrightDataGoogleTrendsProvider {
  private readonly config: BrightDataTrendsConfig;
  private readonly fetcher: FetchImplementation;
  private readonly now: () => Date;

  constructor(dependencies: BrightDataGoogleTrendsProviderDependencies = {}) {
    this.config = parseBrightDataTrendsConfig(dependencies.environment);
    this.fetcher = dependencies.fetcher ?? globalThis.fetch;
    this.now = dependencies.now ?? (() => new Date());
  }

  async collectCandidates(): Promise<readonly BrightDataGoogleTrendsCandidate[]> {
    if (!this.config.enabled) {
      throw new BrightDataProviderError("DISABLED");
    }

    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new BrightDataConfigurationError([
        "BRIGHTDATA_TRENDS_API_KEY",
      ]);
    }

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
          url: GOOGLE_TRENDS_INDONESIA_TARGET,
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
      throw new BrightDataProviderError("UPSTREAM_ERROR", response.status);
    }

    let responseText: string;
    try {
      responseText = await response.text();
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new BrightDataProviderError("TIMEOUT");
      }
      throw new BrightDataProviderError("NETWORK_ERROR");
    }

    if (responseText.length > MAX_RESPONSE_CHARACTERS) {
      throw new BrightDataProviderError("RESPONSE_TOO_LARGE");
    }

    let responseJson: unknown;
    try {
      responseJson = JSON.parse(responseText) as unknown;
    } catch {
      throw new BrightDataProviderError("INVALID_JSON");
    }

    const parsed = googleTrendsResponseSchema.safeParse(responseJson);
    if (!parsed.success) {
      throw new BrightDataProviderError("INVALID_RESPONSE");
    }

    const retrievedAt = this.now().toISOString();
    return parsed.data.map((record) =>
      mapProviderRecord(record, retrievedAt, this.config.zone),
    );
  }

  async collectAndScreenCandidates(): Promise<
    readonly ScreenedFnbCandidate[]
  > {
    return screenFnbCandidates(await this.collectCandidates());
  }
}
