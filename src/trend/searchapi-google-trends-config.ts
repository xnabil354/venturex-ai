import "server-only";

import { z } from "zod";
import type { TrendRadarQueryRow } from "./trend-radar-contract";

const configSchema = z.object({
  SEARCHAPI_API_KEY: z.string().trim().min(1),
  SEARCHAPI_BASE_URL: z.string().url().default("https://www.searchapi.io/api/v1/search"),
  SEARCHAPI_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(30_000).default(10_000),
  SEARCHAPI_RELATED_QUERIES_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(30_000).default(30_000),
  SEARCHAPI_GEO_MAP_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(30_000).default(30_000),
  TREND_RADAR_SEARCHAPI_ENABLED: z.enum(["true", "false"]).default("false"),
  TREND_RADAR_TZ_MINUTES: z.literal("-420").default("-420"),
  TREND_RADAR_CATEGORY: z.literal("0").default("0"),
  TREND_RADAR_CACHE_TTL_SHORT_SECONDS: z.coerce.number().int().min(30).max(3_600).default(300),
  TREND_RADAR_CACHE_TTL_LONG_SECONDS: z.coerce.number().int().min(300).max(86_400).default(3_600),
  TREND_RADAR_MAX_PROVIDER_REQUESTS_PER_DAY: z.coerce.number().int().min(1).max(10_000).default(100),
}).strict();

export const GOOGLE_TRENDS_FOOD_AND_DRINK_CATEGORY = 71;

export type SearchApiConfig = {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly relatedQueriesTimeoutMs: number;
  readonly geoMapTimeoutMs: number;
  readonly enabled: true;
  readonly timezoneOffsetMinutes: -420;
  readonly category: 0;
  readonly shortCacheTtlMs: number;
  readonly longCacheTtlMs: number;
  readonly maxRequestsPerDay: number;
};

export type SearchApiConfigResult =
  | { readonly enabled: false }
  | { readonly enabled: true; readonly config: SearchApiConfig };

export type SearchApiRelatedQueries = {
  readonly top: readonly TrendRadarQueryRow[];
  readonly rising: readonly TrendRadarQueryRow[];
  readonly retrievedAt: string;
  readonly expiresAt: string;
  readonly time: string;
  readonly cacheStatus: "NETWORK" | "HIT" | "COALESCED";
  readonly omittedInvalidRows: { readonly top: number; readonly rising: number };
  readonly providerDiagnostics: {
    readonly httpStatus: number;
    readonly searchStatus: string | null;
    readonly requestId: string | null;
    readonly durationMs: number;
    readonly rawCounts: { readonly top: number; readonly rising: number };
  };
};

export type SearchApiInterestResult<T> = T & {
  readonly retrievedAt: string;
  readonly time: string;
  readonly cacheStatus: "NETWORK" | "HIT" | "COALESCED";
};

export type SearchApiErrorCode =
  | "FEATURE_DISABLED"
  | "CONFIGURATION_INVALID"
  | "REQUEST_BUDGET_EXCEEDED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_QUOTA_EXCEEDED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_AUTH_FAILED"
  | "PROVIDER_RESPONSE_INVALID";

export class SearchApiTrendsError extends Error {
  override readonly name = "SearchApiTrendsError";

  constructor(readonly code: SearchApiErrorCode, readonly upstreamStatus: number | null = null) {
    super(code);
  }
}

export function readSearchApiConfig(env: Readonly<Record<string, string | undefined>> = process.env): SearchApiConfigResult {
  const enabledValue = env.TREND_RADAR_SEARCHAPI_ENABLED;
  if (enabledValue === undefined || enabledValue === "false") return { enabled: false };
  if (enabledValue !== "true") throw new SearchApiTrendsError("CONFIGURATION_INVALID");

  const parsed = configSchema.safeParse({
    SEARCHAPI_API_KEY: env.SEARCHAPI_API_KEY,
    SEARCHAPI_BASE_URL: env.SEARCHAPI_BASE_URL,
    SEARCHAPI_TIMEOUT_MS: env.SEARCHAPI_TIMEOUT_MS,
    SEARCHAPI_RELATED_QUERIES_TIMEOUT_MS: env.SEARCHAPI_RELATED_QUERIES_TIMEOUT_MS,
    SEARCHAPI_GEO_MAP_TIMEOUT_MS: env.SEARCHAPI_GEO_MAP_TIMEOUT_MS,
    TREND_RADAR_SEARCHAPI_ENABLED: enabledValue,
    TREND_RADAR_TZ_MINUTES: env.TREND_RADAR_TZ_MINUTES,
    TREND_RADAR_CATEGORY: env.TREND_RADAR_CATEGORY,
    TREND_RADAR_CACHE_TTL_SHORT_SECONDS: env.TREND_RADAR_CACHE_TTL_SHORT_SECONDS,
    TREND_RADAR_CACHE_TTL_LONG_SECONDS: env.TREND_RADAR_CACHE_TTL_LONG_SECONDS,
    TREND_RADAR_MAX_PROVIDER_REQUESTS_PER_DAY: env.TREND_RADAR_MAX_PROVIDER_REQUESTS_PER_DAY,
  });
  if (!parsed.success) throw new SearchApiTrendsError("CONFIGURATION_INVALID");

  const base = new URL(parsed.data.SEARCHAPI_BASE_URL);
  const supportedBasePaths = new Set(["/", "/api/v1", "/api/v1/", "/api/v1/search", "/api/v1/search/"]);
  if (base.protocol !== "https:" || base.hostname !== "www.searchapi.io" || !supportedBasePaths.has(base.pathname)
      || base.username || base.password || base.search || base.hash) {
    throw new SearchApiTrendsError("CONFIGURATION_INVALID");
  }
  base.pathname = "/api/v1/search";

  return {
    enabled: true,
    config: {
      apiKey: parsed.data.SEARCHAPI_API_KEY,
      baseUrl: base.toString(),
      timeoutMs: parsed.data.SEARCHAPI_TIMEOUT_MS,
      relatedQueriesTimeoutMs: parsed.data.SEARCHAPI_RELATED_QUERIES_TIMEOUT_MS,
      geoMapTimeoutMs: parsed.data.SEARCHAPI_GEO_MAP_TIMEOUT_MS,
      enabled: true,
      timezoneOffsetMinutes: -420,
      category: 0,
      shortCacheTtlMs: parsed.data.TREND_RADAR_CACHE_TTL_SHORT_SECONDS * 1_000,
      longCacheTtlMs: parsed.data.TREND_RADAR_CACHE_TTL_LONG_SECONDS * 1_000,
      maxRequestsPerDay: parsed.data.TREND_RADAR_MAX_PROVIDER_REQUESTS_PER_DAY,
    },
  };
}

