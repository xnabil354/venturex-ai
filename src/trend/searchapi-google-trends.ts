import "server-only";

import { z } from "zod";
import { isSearchApiTrendsNoData } from "./searchapi-trends-no-data";
import { normalizeCompetitorSample, competitorSearchQuery } from "./searchapi-competitor-sample";
import type { CompetitorSample } from "../opportunity/entrepreneur-analysis-contract";

import type { TrendRadarRequest, TrendRadarQueryRow } from "./trend-radar-contract";
import type { TrendRegionalInterest, TrendTimeSeries } from "./trend-radar-interest-contract";
import { normalizeSearchApiRegionalInterest, normalizeSearchApiTimeSeries, TrendRadarInterestDataError } from "./trend-radar-interest-data";
import { getJakartaToday, isShortTrendRadarPeriod, toSearchApiProperty, toSearchApiTime } from "./trend-radar-contract";
import {
  GOOGLE_TRENDS_FOOD_AND_DRINK_CATEGORY,
  SearchApiTrendsError,
  readSearchApiConfig,
  type SearchApiConfig,
  type SearchApiConfigResult,
  type SearchApiInterestResult,
  type SearchApiRelatedQueries,
} from "./searchapi-google-trends-config";

export * from "./searchapi-google-trends-config";


const providerRowSchema = z.object({
  position: z.number().int().positive(),
  query: z.string().trim().min(1),
  values: z.union([z.string(), z.number()]).optional(),
  extracted_value: z.number().finite().nonnegative().optional(),
  link: z.string().optional(),
}).passthrough();

const providerResponseSchema = z.object({
  related_queries: z.object({
    top: z.array(z.unknown()),
    rising: z.array(z.unknown()),
  }),
}).passthrough();

function sourceUrl(value: string | undefined): string | null {
  if (!value || value.length > 2_048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "trends.google.com" || url.pathname !== "/trends/explore" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function mapTopRows(rows: readonly unknown[]): { readonly data: readonly TrendRadarQueryRow[]; readonly omitted: number } {
  const data: TrendRadarQueryRow[] = [];
  for (const raw of rows) {
    const parsed = providerRowSchema.safeParse(raw);
    if (!parsed.success) continue;
    data.push({
      position: parsed.data.position,
      query: parsed.data.query,
      interestIndex: parsed.data.extracted_value ?? null,
      sourceUrl: sourceUrl(parsed.data.link),
    });
  }
  return { data, omitted: rows.length - data.length };
}

function mapRisingRows(rows: readonly unknown[]): { readonly data: readonly TrendRadarQueryRow[]; readonly omitted: number } {
  const data: TrendRadarQueryRow[] = [];
  for (const raw of rows) {
    const parsed = providerRowSchema.safeParse(raw);
    if (!parsed.success) continue;
    const providerLabel = typeof parsed.data.values === "string"
      ? parsed.data.values
      : typeof parsed.data.values === "number" ? String(parsed.data.values) : null;
    const isBreakout = providerLabel?.trim().toLocaleLowerCase("en-US") === "breakout";
    data.push({
      position: parsed.data.position,
      query: parsed.data.query,
      growthLabel: providerLabel,
      growthPercent: isBreakout ? null : parsed.data.extracted_value ?? null,
      isBreakout,
      sourceUrl: sourceUrl(parsed.data.link),
    });
  }
  return { data, omitted: rows.length - data.length };
}

export function normalizeSearchApiRelatedQueries(value: unknown): {
  readonly top: readonly TrendRadarQueryRow[];
  readonly rising: readonly TrendRadarQueryRow[];
  readonly omittedInvalidRows: { readonly top: number; readonly rising: number };
} {
  if (isSearchApiTrendsNoData(value)) {
    return { top: [], rising: [], omittedInvalidRows: { top: 0, rising: 0 } };
  }
  const parsed = providerResponseSchema.safeParse(value);
  if (!parsed.success) throw new SearchApiTrendsError("PROVIDER_RESPONSE_INVALID");
  const top = mapTopRows(parsed.data.related_queries.top);
  const rising = mapRisingRows(parsed.data.related_queries.rising);
  return {
    top: top.data,
    rising: rising.data,
    omittedInvalidRows: { top: top.omitted, rising: rising.omitted },
  };
}

type CacheEntry = { readonly value: unknown; readonly expiresAt: number };
type RequestBudget = { localDate: string; used: number };
type ProviderResponse = Omit<SearchApiRelatedQueries, "cacheStatus" | "expiresAt">;

function safeDiagnosticValue(value: unknown): string | null {
  return typeof value === "string"
    && value.length <= 128
    && /^[A-Za-z0-9._: -]+$/u.test(value.trim())
    ? value.trim()
    : null;
}

function relatedQueryProviderDiagnostics(payload: unknown, httpStatus: number, durationMs: number) {
  const parsed = providerResponseSchema.safeParse(payload);
  if (!parsed.success && !isSearchApiTrendsNoData(payload)) throw new SearchApiTrendsError("PROVIDER_RESPONSE_INVALID", httpStatus);
  const metadata = z.object({
    search_metadata: z.object({
      id: z.unknown().optional(),
      status: z.unknown().optional(),
    }).passthrough().optional(),
  }).passthrough().safeParse(payload);
  const searchMetadata = metadata.success ? metadata.data.search_metadata : undefined;
  return {
    httpStatus,
    searchStatus: safeDiagnosticValue(searchMetadata?.status),
    requestId: safeDiagnosticValue(searchMetadata?.id),
    durationMs: Math.max(0, Math.round(durationMs)),
    rawCounts: {
      top: parsed.success ? parsed.data.related_queries.top.length : 0,
      rising: parsed.success ? parsed.data.related_queries.rising.length : 0,
    },
  } as const;
}

export class SearchApiGoogleTrendsAdapter {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<unknown>>();
  private budget: RequestBudget = { localDate: "", used: 0 };

  constructor(
    private readonly configResolver: () => SearchApiConfigResult = () => readSearchApiConfig(),
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async relatedQueries(productQuery: string, request: TrendRadarRequest, requestedTime?: string): Promise<SearchApiRelatedQueries> {
    const configuration = this.configResolver();
    if (!configuration.enabled) throw new SearchApiTrendsError("FEATURE_DISABLED");
    const config = configuration.config;
    const time = requestedTime ?? toSearchApiTime(request, this.now());
    const geo = request.geo ?? "";
    const key = JSON.stringify(["RELATED_QUERIES", productQuery, time, request.property, geo, config.timezoneOffsetMinutes, config.category]);
    const nowMs = this.now().getTime();
    this.pruneCache(nowMs);
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > nowMs) {
      return {
        ...(cached.value as ProviderResponse),
        expiresAt: new Date(cached.expiresAt).toISOString(),
        cacheStatus: "HIT",
      };
    }

    const active = this.inflight.get(key);
    if (active) {
      const value = await active as ProviderResponse;
      const ttl = isShortTrendRadarPeriod(request) ? config.shortCacheTtlMs : config.longCacheTtlMs;
      return {
        ...value,
        expiresAt: new Date(Date.parse(value.retrievedAt) + ttl).toISOString(),
        cacheStatus: "COALESCED",
      };
    }

    this.reserveBudget(config, this.now());
    const pending = this.fetchRelatedQueries(config, productQuery, request, time);
    this.inflight.set(key, pending);
    try {
      const value = await pending;
      const ttl = isShortTrendRadarPeriod(request) ? config.shortCacheTtlMs : config.longCacheTtlMs;
      const expiresAt = Date.parse(value.retrievedAt) + ttl;
      this.cache.set(key, { value, expiresAt });
      return { ...value, expiresAt: new Date(expiresAt).toISOString(), cacheStatus: "NETWORK" };
    } finally {
      this.inflight.delete(key);
    }
  }

  async foodAndDrinkRelatedQueries(
    request: TrendRadarRequest,
  ): Promise<SearchApiRelatedQueries> {
    const configuration = this.configResolver();
    if (!configuration.enabled) throw new SearchApiTrendsError("FEATURE_DISABLED");
    const config = configuration.config;
    const time = toSearchApiTime(request, this.now());
    const key = JSON.stringify([
      "NOTIFICATION_FOOD_AND_DRINK_RELATED_QUERIES",
      time,
      request.property,
      request.geo ?? "",
      config.timezoneOffsetMinutes,
      GOOGLE_TRENDS_FOOD_AND_DRINK_CATEGORY,
    ]);
    const nowMs = this.now().getTime();
    this.pruneCache(nowMs);
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > nowMs)
      return {
        ...(cached.value as ProviderResponse),
        expiresAt: new Date(cached.expiresAt).toISOString(),
        cacheStatus: "HIT",
      };
    const active = this.inflight.get(key);
    if (active) {
      const value = (await active) as ProviderResponse;
      return {
        ...value,
        expiresAt: new Date(
          Date.parse(value.retrievedAt) + config.longCacheTtlMs,
        ).toISOString(),
        cacheStatus: "COALESCED",
      };
    }
    this.reserveBudget(config, this.now());
    const pending = this.fetchRelatedQueries(
      config,
      null,
      request,
      time,
      GOOGLE_TRENDS_FOOD_AND_DRINK_CATEGORY,
    );
    this.inflight.set(key, pending);
    try {
      const value = await pending;
      const expiresAt = Date.parse(value.retrievedAt) + config.longCacheTtlMs;
      this.cache.set(key, { value, expiresAt });
      return {
        ...value,
        expiresAt: new Date(expiresAt).toISOString(),
        cacheStatus: "NETWORK",
      };
    } finally {
      this.inflight.delete(key);
    }
  }

  async interestOverTime(productQuery: string, request: TrendRadarRequest, requestedTime?: string): Promise<SearchApiInterestResult<TrendTimeSeries>> {
    return this.requestInterestDataset(productQuery, request, requestedTime, "TIMESERIES", (payload) => normalizeSearchApiTimeSeries(payload, productQuery));
  }

  async interestByRegion(productQuery: string, request: TrendRadarRequest, requestedTime?: string): Promise<SearchApiInterestResult<TrendRegionalInterest>> {
    return this.requestInterestDataset(productQuery, request, requestedTime, "GEO_MAP", (payload) => normalizeSearchApiRegionalInterest(payload, productQuery));
  }

  async localCompetitors(product: string, city: string, province?: string | null): Promise<CompetitorSample> {
    const configuration = this.configResolver();
    if (!configuration.enabled) throw new SearchApiTrendsError("FEATURE_DISABLED");
    const config = configuration.config;
    const query = competitorSearchQuery(product, city, province);
    const key = JSON.stringify(["LOCAL_COMPETITOR_SAMPLE_V2", query, city]);
    this.pruneCache(this.now().getTime());
    const cached = this.cache.get(key);
    if (cached) return cached.value as CompetitorSample;
    const inflight = this.inflight.get(key);
    if (inflight) return await inflight as CompetitorSample;
    this.reserveBudget(config, this.now());
    const pending = (async () => {
      const url = new URL(config.baseUrl);
      url.searchParams.set("engine", "google_maps");
      url.searchParams.set("q", query);
      url.searchParams.set("hl", "id");
      try {
        const response = await this.fetcher(url, { method: "GET", headers: { Authorization: `Bearer ${config.apiKey}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(config.geoMapTimeoutMs) });
        if (!response.ok) throw new SearchApiTrendsError(response.status === 429 ? "PROVIDER_RATE_LIMITED" : "PROVIDER_UNAVAILABLE", response.status);
        const raw = await response.text();
        if (raw.length > 1_000_000) throw new SearchApiTrendsError("PROVIDER_RESPONSE_INVALID");
        const value = normalizeCompetitorSample(JSON.parse(raw) as unknown, query, city, this.now().toISOString());
        this.cache.set(key, { value, expiresAt: this.now().getTime() + config.longCacheTtlMs });
        return value;
      } catch (error) {
        if (error instanceof SearchApiTrendsError) throw error;
        if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) throw new SearchApiTrendsError("PROVIDER_TIMEOUT");
        throw new SearchApiTrendsError("PROVIDER_RESPONSE_INVALID");
      }
    })();
    this.inflight.set(key, pending);
    try { return await pending; } finally { this.inflight.delete(key); }
  }

  private async requestInterestDataset<T extends TrendTimeSeries | TrendRegionalInterest>(
    productQuery: string,
    request: TrendRadarRequest,
    requestedTime: string | undefined,
    dataType: "TIMESERIES" | "GEO_MAP",
    normalize: (payload: unknown) => T,
  ): Promise<SearchApiInterestResult<T>> {
    const configuration = this.configResolver();
    if (!configuration.enabled) throw new SearchApiTrendsError("FEATURE_DISABLED");
    const config = configuration.config;
    const time = requestedTime ?? toSearchApiTime(request, this.now());
    const geo = request.geo ?? "";
    const region = dataType === "GEO_MAP" ? (geo ? "REGION" : "COUNTRY") : null;
    const key = JSON.stringify([dataType, productQuery, time, request.property, geo, region, config.timezoneOffsetMinutes, config.category]);
    const nowMs = this.now().getTime();
    this.pruneCache(nowMs);
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > nowMs) {
      return { ...(cached.value as Omit<SearchApiInterestResult<T>, "cacheStatus">), cacheStatus: "HIT" } as SearchApiInterestResult<T>;
    }

    const active = this.inflight.get(key);
    if (active) {
      return { ...(await active as Omit<SearchApiInterestResult<T>, "cacheStatus">), cacheStatus: "COALESCED" } as SearchApiInterestResult<T>;
    }

    this.reserveBudget(config, this.now());
    const pending = this.fetchInterestDataset(config, productQuery, request, time, dataType, normalize);
    this.inflight.set(key, pending);
    try {
      const value = await pending;
      const ttl = isShortTrendRadarPeriod(request) ? config.shortCacheTtlMs : config.longCacheTtlMs;
      this.cache.set(key, { value, expiresAt: this.now().getTime() + ttl });
      return { ...value, cacheStatus: "NETWORK" };
    } finally {
      this.inflight.delete(key);
    }
  }

  private async fetchInterestDataset<T extends TrendTimeSeries | TrendRegionalInterest>(
    config: SearchApiConfig,
    productQuery: string,
    request: TrendRadarRequest,
    time: string,
    dataType: "TIMESERIES" | "GEO_MAP",
    normalize: (payload: unknown) => T,
  ): Promise<T & { readonly retrievedAt: string; readonly time: string }> {
    const url = new URL(config.baseUrl);
    url.searchParams.set("engine", "google_trends");
    url.searchParams.set("data_type", dataType);
    url.searchParams.set("q", productQuery);
    url.searchParams.set("geo", request.geo ?? "");
    url.searchParams.set("cat", String(config.category));
    url.searchParams.set("tz", String(config.timezoneOffsetMinutes));
    url.searchParams.set("time", time);
    if (dataType === "GEO_MAP") url.searchParams.set("region", request.geo ? "REGION" : "COUNTRY");
    const property = toSearchApiProperty(request.property);
    if (property) url.searchParams.set("gprop", property);

    let response: Response;
    try {
      response = await this.fetcher(url, {
        method: "GET",
        headers: { Authorization: "Bearer " + config.apiKey, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(dataType === "GEO_MAP" ? config.geoMapTimeoutMs : config.timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) throw new SearchApiTrendsError("PROVIDER_TIMEOUT");
      throw new SearchApiTrendsError("PROVIDER_UNAVAILABLE");
    }
    if (response.status === 429) throw new SearchApiTrendsError("PROVIDER_RATE_LIMITED", response.status);
    if (response.status === 402) throw new SearchApiTrendsError("PROVIDER_QUOTA_EXCEEDED", response.status);
    if (response.status === 401 || response.status === 403) throw new SearchApiTrendsError("PROVIDER_AUTH_FAILED", response.status);
    if (!response.ok) throw new SearchApiTrendsError("PROVIDER_UNAVAILABLE", response.status);

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) {
        throw new SearchApiTrendsError("PROVIDER_TIMEOUT");
      }
      throw new SearchApiTrendsError("PROVIDER_RESPONSE_INVALID", response.status);
    }
    let normalized: T;
    try {
      normalized = normalize(payload);
    } catch (error) {
      if (error instanceof TrendRadarInterestDataError) throw new SearchApiTrendsError("PROVIDER_RESPONSE_INVALID", response.status);
      throw error;
    }
    return { ...normalized, retrievedAt: this.now().toISOString(), time };
  }

  private reserveBudget(config: SearchApiConfig, now: Date): void {
    const localDate = getJakartaToday(now);
    if (this.budget.localDate !== localDate) this.budget = { localDate, used: 0 };
    if (this.budget.used >= config.maxRequestsPerDay) throw new SearchApiTrendsError("REQUEST_BUDGET_EXCEEDED");
    this.budget.used += 1;
  }

  private pruneCache(now: number): void {
    for (const [key, entry] of this.cache) if (entry.expiresAt <= now) this.cache.delete(key);
  }

  private async fetchRelatedQueries(
    config: SearchApiConfig,
    productQuery: string | null,
    request: TrendRadarRequest,
    time: string,
    category: number = config.category,
  ): Promise<ProviderResponse> {
    const url = new URL(config.baseUrl);
    url.searchParams.set("engine", "google_trends");
    url.searchParams.set("data_type", "RELATED_QUERIES");
    if (productQuery) url.searchParams.set("q", productQuery);
    url.searchParams.set("geo", request.geo ?? "");
    url.searchParams.set("cat", String(category));
    url.searchParams.set("tz", String(config.timezoneOffsetMinutes));
    url.searchParams.set("time", time);
    const property = toSearchApiProperty(request.property);
    if (property) url.searchParams.set("gprop", property);

    const startedAt = performance.now();
    const timeoutSignal = AbortSignal.timeout(config.relatedQueriesTimeoutMs);
    let response: Response;
    try {
      response = await this.fetcher(url, {
        method: "GET",
        headers: { Authorization: "Bearer " + config.apiKey, Accept: "application/json" },
        cache: "no-store",
        signal: timeoutSignal,
      });
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        throw new SearchApiTrendsError("PROVIDER_TIMEOUT");
      }
      throw new SearchApiTrendsError("PROVIDER_UNAVAILABLE");
    }
    if (response.status === 429) throw new SearchApiTrendsError("PROVIDER_RATE_LIMITED", response.status);
    if (response.status === 402) throw new SearchApiTrendsError("PROVIDER_QUOTA_EXCEEDED", response.status);
    if (response.status === 401 || response.status === 403) throw new SearchApiTrendsError("PROVIDER_AUTH_FAILED", response.status);
    if (!response.ok) throw new SearchApiTrendsError("PROVIDER_UNAVAILABLE", response.status);

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) {
        throw new SearchApiTrendsError("PROVIDER_TIMEOUT");
      }
      throw new SearchApiTrendsError("PROVIDER_RESPONSE_INVALID", response.status);
    }
    const durationMs = performance.now() - startedAt;
    let normalized: ReturnType<typeof normalizeSearchApiRelatedQueries>;
    try {
      // ASVS 1.5.2: external JSON is accepted only through the strict row schema.
      normalized = normalizeSearchApiRelatedQueries(payload);
    } catch (error) {
      if (error instanceof SearchApiTrendsError && error.code === "PROVIDER_RESPONSE_INVALID") {
        throw new SearchApiTrendsError("PROVIDER_RESPONSE_INVALID", response.status);
      }
      throw error;
    }
    return {
      ...normalized,
      retrievedAt: this.now().toISOString(),
      time,
      providerDiagnostics: relatedQueryProviderDiagnostics(payload, response.status, durationMs),
    };
  }
}

declare global {
  var __venturexSearchApiGoogleTrendsAdapter: SearchApiGoogleTrendsAdapter | undefined;
}

export function getSearchApiGoogleTrendsAdapter(): SearchApiGoogleTrendsAdapter {
  if (!(globalThis.__venturexSearchApiGoogleTrendsAdapter instanceof SearchApiGoogleTrendsAdapter)) {
    globalThis.__venturexSearchApiGoogleTrendsAdapter = new SearchApiGoogleTrendsAdapter();
  }
  return globalThis.__venturexSearchApiGoogleTrendsAdapter;
}
