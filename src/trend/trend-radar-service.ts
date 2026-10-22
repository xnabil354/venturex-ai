import "server-only";

import { USER_TYPES, type SafeUser } from "@/auth/user-types";
import { BusinessProfileService } from "@/profile/business-service";
import { EntrepreneurProfileService } from "@/profile/service";
import { ReferenceRepository } from "@/reference/repository";
import { businessQueryOptions } from "./business-query-options";

import {
  getSearchApiGoogleTrendsAdapter,
  SearchApiTrendsError,
  type SearchApiInterestResult,
  type SearchApiGoogleTrendsAdapter,
} from "./searchapi-google-trends";
import type { TrendRegionalInterest, TrendRadarInterestResponse, TrendTimeSeries } from "./trend-radar-interest-contract";
import {
  InvalidTrendRadarTimeError,
  toSearchApiTime,
  type TrendRadarRequest,
  type TrendRadarResponse,
} from "./trend-radar-contract";

export class TrendRadarServiceError extends Error {
  override readonly name = "TrendRadarServiceError";

  constructor(readonly code: "PROFILE_INCOMPLETE") {
    super(code);
  }
}

export type TrendRadarProfileQueryResolver = (
  userId: SafeUser["id"],
  userType: NonNullable<SafeUser["userType"]>,
  queryKey?: string,
) => Promise<string>;

function cleanProfileQuery(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 80);
}

export async function resolveTrendRadarProfileQuery(
  userId: SafeUser["id"],
  userType: NonNullable<SafeUser["userType"]>,
  queryKey?: string,
): Promise<string> {
  if (userType === USER_TYPES.ENTREPRENEUR) {
    if (queryKey) throw new TrendRadarServiceError("PROFILE_INCOMPLETE");
    const profile = await new EntrepreneurProfileService().getForEdit(userId);
    return cleanProfileQuery(profile.preferredProductType);
  }
  if (userType === USER_TYPES.UMKM_EXISTING) {
    const profile = await new BusinessProfileService().getForEdit(userId);
    if (!queryKey || queryKey === "business") return cleanProfileQuery(profile.businessName);
    const categories = queryKey === "category" ? await new ReferenceRepository().listActiveFnbCategories() : [];
    const option = businessQueryOptions(profile, categories.find(c => c.id === profile.businessCategoryId)?.name).find(o => o.key === queryKey);
    if (!option) throw new TrendRadarServiceError("PROFILE_INCOMPLETE");
    return option.query;
  }
  return "";
}

export class TrendRadarService {
  constructor(
    private readonly provider: SearchApiGoogleTrendsAdapter = getSearchApiGoogleTrendsAdapter(),
    private readonly resolveProfileQuery: TrendRadarProfileQueryResolver = resolveTrendRadarProfileQuery,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getRelatedQueries(
    userId: SafeUser["id"],
    userType: NonNullable<SafeUser["userType"]>,
    request: TrendRadarRequest,
    requestId: string,
  ): Promise<TrendRadarResponse> {
    const productQuery = cleanProfileQuery(await (request.queryKey ? this.resolveProfileQuery(userId, userType, request.queryKey) : this.resolveProfileQuery(userId, userType)));
    if (!productQuery) throw new TrendRadarServiceError("PROFILE_INCOMPLETE");

    let time: string;
    try {
      time = toSearchApiTime(request, this.now());
    } catch (error) {
      if (error instanceof InvalidTrendRadarTimeError) throw error;
      throw new InvalidTrendRadarTimeError();
    }
    const result = await this.provider.relatedQueries(productQuery, request, time);

    return {
      provider: "SearchApi.io",
      retrievedAt: result.retrievedAt,
      cacheStatus: result.cacheStatus,
      appliedFilters: {
        period: request.period === "year" ? String(request.year) : request.period,
        time: result.time,
        property: request.property,
        geo: request.geo ?? "",
        category: 0,
        timezoneOffsetMinutes: -420,
        timezone: "Asia/Jakarta",
      },
      productQuery,
      top: [...result.top],
      rising: [...result.rising],
      omittedInvalidRows: result.omittedInvalidRows,
      requestId,
    };
  }

  async getInterest(
    userId: SafeUser["id"],
    userType: NonNullable<SafeUser["userType"]>,
    request: TrendRadarRequest,
    requestId: string,
  ): Promise<TrendRadarInterestResponse> {
    const productQuery = cleanProfileQuery(await (request.queryKey ? this.resolveProfileQuery(userId, userType, request.queryKey) : this.resolveProfileQuery(userId, userType)));
    if (!productQuery) throw new TrendRadarServiceError("PROFILE_INCOMPLETE");

    let time: string;
    try {
      time = toSearchApiTime(request, this.now());
    } catch (error) {
      if (error instanceof InvalidTrendRadarTimeError) throw error;
      throw new InvalidTrendRadarTimeError();
    }

    const [timeSeriesResult, regionalResult] = await Promise.allSettled([
      Promise.resolve().then(() => this.provider.interestOverTime(productQuery, request, time)),
      Promise.resolve().then(() => this.provider.interestByRegion(productQuery, request, time)),
    ]);
    const timeSeries = timeSeriesResult.status === "fulfilled" ? timeSeriesResult.value : null;
    const regionalInterest = regionalResult.status === "fulfilled" ? regionalResult.value : null;
    const filters = {
      period: request.period === "year" ? String(request.year) : request.period,
      time,
      property: request.property,
      geo: request.geo ?? "",
      category: 0 as const,
      timezoneOffsetMinutes: -420 as const,
      timezone: "Asia/Jakarta" as const,
    };

    return {
      provider: "SearchApi.io",
      productQuery,
      appliedFilters: filters,
      timeSeries: timeSeries ? withoutProviderMetadata(timeSeries) : null,
      regionalInterest: regionalInterest ? withoutProviderMetadata(regionalInterest) : null,
      availability: {
        timeSeries: availability(timeSeries, (value) => value.points.length > 0),
        regionalInterest: availability(regionalInterest, (value) => value.regions.length > 0),
      },
      datasets: {
        timeSeries: datasetMeta(timeSeries, timeSeriesResult.status === "rejected" ? timeSeriesResult.reason : null),
        regionalInterest: datasetMeta(regionalInterest, regionalResult.status === "rejected" ? regionalResult.reason : null),
      },
      requestId,
    };
  }
}

function withoutProviderMetadata<T extends TrendTimeSeries | TrendRegionalInterest>(
  result: SearchApiInterestResult<T>,
): T {
  const { retrievedAt: _retrievedAt, time: _time, cacheStatus: _cacheStatus, ...data } = result;
  return data as unknown as T;
}

function availability<T>(result: SearchApiInterestResult<T> | null, hasRows: (value: T) => boolean): "available" | "empty" | "failed" {
  if (!result) return "failed";
  return hasRows(result) ? "available" : "empty";
}

function datasetMeta<T>(result: SearchApiInterestResult<T> | null, failure: unknown) {
  return {
    status: result?.cacheStatus ?? null,
    retrievedAt: result?.retrievedAt ?? null,
    error: failure ? safeDatasetError(failure) : null,
  };
}

function safeDatasetError(error: unknown): { code: string; message: string } {
  if (!(error instanceof SearchApiTrendsError)) return { code: "INTERNAL_ERROR", message: "Data minat ini belum dapat dimuat." };
  const messages: Record<SearchApiTrendsError["code"], string> = {
    FEATURE_DISABLED: "Fitur tren belum tersedia saat ini.",
    CONFIGURATION_INVALID: "Konfigurasi layanan Trend Radar belum valid.",
    REQUEST_BUDGET_EXCEEDED: "Batas permintaan Trend Radar hari ini telah tercapai. Coba lagi besok.",
    PROVIDER_TIMEOUT: "Data tren gagal dimuat. Coba lagi.",
    PROVIDER_RATE_LIMITED: "Terlalu banyak permintaan. Coba lagi nanti.",
    PROVIDER_QUOTA_EXCEEDED: "Data tren gagal dimuat. Coba lagi nanti.",
    PROVIDER_UNAVAILABLE: "Data tren gagal dimuat. Coba lagi nanti.",
    PROVIDER_AUTH_FAILED: "Data tren gagal dimuat. Coba lagi nanti.",
    PROVIDER_RESPONSE_INVALID: "Data tren tidak dapat ditampilkan.",
  };
  return { code: error.code, message: messages[error.code] };
}

declare global {
  var __venturexTrendRadarService: TrendRadarService | undefined;
}

export function getTrendRadarService(): TrendRadarService {
  if (!(globalThis.__venturexTrendRadarService instanceof TrendRadarService)) {
    globalThis.__venturexTrendRadarService = new TrendRadarService();
  }
  return globalThis.__venturexTrendRadarService;
}
