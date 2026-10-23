import "server-only";

import { randomUUID } from "node:crypto";
import { ZodError } from "zod";

import type { SafeUser, UserType } from "@/auth/user-types";
import {
  getSearchApiGoogleTrendsAdapter,
  SearchApiTrendsError,
  type SearchApiGoogleTrendsAdapter,
  type SearchApiRelatedQueries,
} from "@/trend/searchapi-google-trends";
import { resolveTrendRadarProfileQuery, TrendRadarServiceError } from "@/trend/trend-radar-service";
import {
  toSearchApiProperty,
  toSearchApiTime,
  type TrendRadarQueryRow,
  type TrendRadarRequest,
} from "@/trend/trend-radar-contract";

import {
  evidenceFromTrendRow,
  searchApiOpportunitySignalOptionSchema,
  type SearchApiOpportunitySignalsResponse,
  type SearchApiOpportunityEvidence,
  type SearchApiOpportunitySourceType,
} from "./searchapi-evidence-contract";
import { SearchApiEvidenceTokenError, sealSearchApiOpportunityEvidence } from "./searchapi-evidence-token";

export type SearchApiOpportunitySignalDiagnostics = Readonly<{
  providerHttpStatus: number;
  providerSearchStatus: string | null;
  providerRequestId: string | null;
  providerDurationMs: number;
  cacheStatus: SearchApiRelatedQueries["cacheStatus"];
  networkRequestOccurred: boolean;
  rawTopCount: number;
  rawRisingCount: number;
  normalizedTopCount: number;
  normalizedRisingCount: number;
  invalidTopCount: number;
  invalidRisingCount: number;
  acceptedTopCount: number;
  acceptedRisingCount: number;
  rejectedTopCount: number;
  rejectedRisingCount: number;
  rejectionReasons: readonly Readonly<{ code: "EVIDENCE_CONTRACT_REJECTED"; count: number }>[];
  createdTokenCount: number;
}>;

export type SearchApiOpportunitySignalErrorCode =
  | "CACHE_INCONSISTENT"
  | "EVIDENCE_ROWS_REJECTED"
  | "EVIDENCE_TOKEN_CREATION_FAILED";

export class SearchApiOpportunitySignalError extends Error {
  override readonly name = "SearchApiOpportunitySignalError";

  constructor(readonly code: SearchApiOpportunitySignalErrorCode) {
    super(code);
  }
}

export type OpportunitySignalProfileQueryResolver = (
  userId: SafeUser["id"],
  userType: UserType,
  queryKey?: string,
) => Promise<string>;

function periodLabel(request: TrendRadarRequest): string {
  if (request.period === "year") return String(request.year);
  if (request.period === "custom-date") return `${request.startDate} – ${request.endDate}`;
  if (request.period === "custom-hour") return `${request.startDateTime} – ${request.endDateTime} WIB`;
  return request.period;
}

function exploreUrl(productQuery: string, time: string, property: TrendRadarRequest["property"], geo: string): string {
  const url = new URL("https://trends.google.com/trends/explore");
  url.searchParams.set("geo", geo);
  url.searchParams.set("date", time);
  url.searchParams.set("q", productQuery);
  const providerProperty = toSearchApiProperty(property);
  if (providerProperty) url.searchParams.set("gprop", providerProperty);
  return url.toString();
}

export class SearchApiOpportunitySignalService {
  constructor(
    private readonly provider: SearchApiGoogleTrendsAdapter = getSearchApiGoogleTrendsAdapter(),
    private readonly resolveProfileQuery: OpportunitySignalProfileQueryResolver = resolveTrendRadarProfileQuery,
    private readonly environment: Readonly<Record<string, string | undefined>> = process.env,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async listForUser(
    userId: SafeUser["id"],
    userType: UserType,
    request: TrendRadarRequest,
    onDiagnostics?: (diagnostics: SearchApiOpportunitySignalDiagnostics) => void,
  ): Promise<SearchApiOpportunitySignalsResponse> {
    const productQuery = (await (request.queryKey ? this.resolveProfileQuery(userId, userType, request.queryKey) : this.resolveProfileQuery(userId, userType))).trim();
    if (!productQuery) throw new TrendRadarServiceError("PROFILE_INCOMPLETE");

    const time = toSearchApiTime(request, this.now());
    const result = await this.provider.relatedQueries(productQuery, request, time);
    const responseTime = this.now().getTime();
    const retrievedAt = Date.parse(result.retrievedAt);
    const expiresAt = Date.parse(result.expiresAt);
    if (!Number.isFinite(retrievedAt)
      || !Number.isFinite(expiresAt)
      || retrievedAt > responseTime
      || expiresAt <= responseTime
      || expiresAt <= retrievedAt
      || expiresAt - retrievedAt > 24 * 60 * 60 * 1_000) {
      throw new SearchApiOpportunitySignalError("CACHE_INCONSISTENT");
    }

    if (result.top.length === 0
      && result.rising.length === 0
      && (result.omittedInvalidRows.top > 0 || result.omittedInvalidRows.rising > 0)) {
      onDiagnostics?.(this.diagnosticsFor(result, 0, 0, 0, 0));
      throw new SearchApiTrendsError("PROVIDER_RESPONSE_INVALID", result.providerDiagnostics.httpStatus);
    }

    const geo = request.geo ?? "";
    const sourceUrl = exploreUrl(productQuery, result.time, request.property, geo);
    const context = {
      productQuery,
      period: periodLabel(request),
      providerTime: result.time,
      searchProperty: request.property,
      geo,
      retrievedAt: result.retrievedAt,
      expiresAt: result.expiresAt,
      url: sourceUrl,
    } as const;
    const top = this.createOptions(result.top, "RELATED_QUERY_TOP", userId, context);
    const rising = this.createOptions(result.rising, "RELATED_QUERY_RISING", userId, context);

    onDiagnostics?.(this.diagnosticsFor(result, top.acceptedCount, rising.acceptedCount, top.rejectedCount, rising.rejectedCount));
    if (top.acceptedCount === 0 && rising.acceptedCount === 0 && top.rejectedCount + rising.rejectedCount > 0) {
      throw new SearchApiOpportunitySignalError("EVIDENCE_ROWS_REJECTED");
    }

    return {
      provider: "SearchApi.io",
      productQuery,
      retrievedAt: result.retrievedAt,
      appliedFilters: { period: context.period, time: result.time, property: request.property, geo },
      top: top.options,
      rising: rising.options,
    };
  }

  private createOptions(
    rows: readonly TrendRadarQueryRow[],
    sourceType: SearchApiOpportunitySourceType,
    userId: SafeUser["id"],
    context: Parameters<typeof evidenceFromTrendRow>[2],
  ): { options: SearchApiOpportunitySignalsResponse["top"]; acceptedCount: number; rejectedCount: number } {
    const options: SearchApiOpportunitySignalsResponse["top"][number][] = [];
    let rejectedCount = 0;
    for (const row of rows) {
      let evidence: SearchApiOpportunityEvidence;
      try {
        evidence = evidenceFromTrendRow(row, sourceType, context);
      } catch (error) {
        if (error instanceof ZodError) {
          rejectedCount += 1;
          continue;
        }
        throw error;
      }
      let sourceToken: string;
      try {
        sourceToken = sealSearchApiOpportunityEvidence({ userId, evidence, env: this.environment, now: this.now() });
      } catch (error) {
        if (error instanceof SearchApiEvidenceTokenError && error.code === "CONFIGURATION_UNAVAILABLE") throw error;
        if (error instanceof SearchApiEvidenceTokenError) throw new SearchApiOpportunitySignalError("EVIDENCE_TOKEN_CREATION_FAILED");
        throw error;
      }
      try {
        options.push(searchApiOpportunitySignalOptionSchema.parse({ ...evidence, id: randomUUID(), sourceToken }));
      } catch (error) {
        if (error instanceof ZodError) {
          rejectedCount += 1;
          continue;
        }
        throw error;
      }
    }
    return { options, acceptedCount: options.length, rejectedCount };
  }

  private diagnosticsFor(
    result: SearchApiRelatedQueries,
    acceptedTopCount: number,
    acceptedRisingCount: number,
    rejectedTopCount: number,
    rejectedRisingCount: number,
  ): SearchApiOpportunitySignalDiagnostics {
    const rejectedCount = rejectedTopCount + rejectedRisingCount;
    return {
      providerHttpStatus: result.providerDiagnostics.httpStatus,
      providerSearchStatus: result.providerDiagnostics.searchStatus,
      providerRequestId: result.providerDiagnostics.requestId,
      providerDurationMs: result.providerDiagnostics.durationMs,
      cacheStatus: result.cacheStatus,
      networkRequestOccurred: result.cacheStatus === "NETWORK",
      rawTopCount: result.providerDiagnostics.rawCounts.top,
      rawRisingCount: result.providerDiagnostics.rawCounts.rising,
      normalizedTopCount: result.top.length,
      normalizedRisingCount: result.rising.length,
      invalidTopCount: result.omittedInvalidRows.top,
      invalidRisingCount: result.omittedInvalidRows.rising,
      acceptedTopCount,
      acceptedRisingCount,
      rejectedTopCount,
      rejectedRisingCount,
      rejectionReasons: rejectedCount > 0 ? [{ code: "EVIDENCE_CONTRACT_REJECTED", count: rejectedCount }] : [],
      createdTokenCount: acceptedTopCount + acceptedRisingCount,
    };
  }
}
