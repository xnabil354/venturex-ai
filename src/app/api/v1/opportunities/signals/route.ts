import "server-only";

import { randomUUID } from "node:crypto";
import { isSameOriginRequest } from "@/lib/http-request";

import { getCurrentUser } from "@/auth/current-user";
import { ONBOARDING_STATUSES, USER_TYPES } from "@/auth/user-types";
import { isSearchApiEvidenceTokenConfigured, SearchApiEvidenceTokenError } from "@/opportunity/searchapi-evidence-token";
import { SearchApiOpportunitySignalError, SearchApiOpportunitySignalService } from "@/opportunity/searchapi-opportunity-signal-service";
import { SearchApiTrendsError } from "@/trend/searchapi-google-trends";
import { isSupportedGoogleTrendsGeo } from "@/trend/searchapi-google-trends-geography";
import { trendRadarRequestSchema } from "@/trend/trend-radar-contract";
import { TrendRadarServiceError } from "@/trend/trend-radar-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 2_048;

function json(data: unknown, status: number, requestId: string, isError = false): Response {
  return Response.json(isError ? { error: data, requestId } : { data, requestId }, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Request-Id": requestId,
    },
  });
}

function isLoopbackHost(host: string): boolean {
  try {
    const hostname = new URL(`http://${host}`).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
  } catch {
    return false;
  }
}

function isAllowedRequestHost(request: Request): boolean {
  if (process.env.NODE_ENV !== "development"
    || (process.env.NINEROUTER_ALLOW_PUBLIC_HTTP_DEV_ONLY !== "true"
      && process.env.NINEROUTER_ALLOW_LOOPBACK_HTTP_DEV_ONLY !== "true")) return true;
  const host = request.headers.get("host");
  try {
    return host !== null && isLoopbackHost(host) && isLoopbackHost(new URL(request.url).host);
  } catch {
    return false;
  }
}

function responseError(error: unknown, requestId: string): Response {
  if (error instanceof SearchApiOpportunitySignalError) {
    if (error.code === "CACHE_INCONSISTENT") {
      return json({ code: error.code, message: "Hasil Google Trends kedaluwarsa atau tidak konsisten. Muat ulang sinyal." }, 502, requestId, true);
    }
    if (error.code === "EVIDENCE_ROWS_REJECTED") {
      return json({ code: error.code, message: "Data sinyal tidak dapat ditampilkan." }, 502, requestId, true);
    }
    return json({ code: error.code, message: "Bukti Google Trends belum dapat diamankan. Muat ulang sinyal." }, 500, requestId, true);
  }
  if (error instanceof SearchApiEvidenceTokenError && error.code === "CONFIGURATION_UNAVAILABLE") {
    return json({ code: "EVIDENCE_SIGNING_UNAVAILABLE", message: "Sinyal belum dapat diamankan untuk sesi ini. Atur AUTH_SECRET lokal dengan nilai acak yang kuat sebelum memuat sinyal." }, 503, requestId, true);
  }
  if (error instanceof SearchApiEvidenceTokenError) {
    return json({ code: "SOURCE_SIGNAL_UNAVAILABLE", message: "Sinyal kedaluwarsa atau tidak dapat diverifikasi. Muat ulang sinyal Google Trends." }, 409, requestId, true);
  }
  if (error instanceof TrendRadarServiceError) {
    return json({ code: error.code, message: "Kueri dari profil belum tersedia. Lengkapi profil terlebih dahulu." }, 422, requestId, true);
  }
  if (error instanceof SearchApiTrendsError) {
    switch (error.code) {
      case "FEATURE_DISABLED":
        return json({ code: error.code, message: "Sinyal tren belum tersedia saat ini." }, 503, requestId, true);
      case "CONFIGURATION_INVALID":
        return json({ code: error.code, message: "Konfigurasi Trend Radar belum valid." }, 503, requestId, true);
      case "REQUEST_BUDGET_EXCEEDED":
        return json({ code: error.code, message: "Batas permintaan Google Trends hari ini telah tercapai. Coba lagi besok." }, 429, requestId, true);
      case "PROVIDER_RATE_LIMITED":
        return json({ code: error.code, message: "Terlalu banyak permintaan. Coba lagi nanti." }, 429, requestId, true);
      case "PROVIDER_QUOTA_EXCEEDED":
        return json({ code: error.code, message: "Sinyal gagal dimuat. Coba lagi nanti." }, 503, requestId, true);
      case "PROVIDER_TIMEOUT":
        return json({ code: error.code, message: "Sinyal gagal dimuat. Coba lagi." }, 504, requestId, true);
      case "PROVIDER_AUTH_FAILED":
      case "PROVIDER_UNAVAILABLE":
        return json({ code: error.code, message: "Sinyal gagal dimuat. Coba lagi nanti." }, 503, requestId, true);
      case "PROVIDER_RESPONSE_INVALID":
        return json({ code: error.code, message: "Data sinyal tidak dapat ditampilkan." }, 502, requestId, true);
    }
  }
  if (error instanceof Error && error.name === "InvalidTrendRadarTimeError") {
    return json({ code: "VALIDATION_ERROR", message: "Rentang waktu Google Trends tidak valid." }, 400, requestId, true);
  }
  console.error("opportunity_searchapi_signals_failed", {
    requestId,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
  return json({ code: "SERVICE_UNAVAILABLE", message: "Sinyal Google Trends belum dapat dimuat." }, 503, requestId, true);
}

export async function POST(request: Request): Promise<Response> {
  const requestId = `req_${randomUUID()}`;
  if (!isAllowedRequestHost(request)) {
    return json({ code: "FORBIDDEN_HOST", message: "Fitur ini hanya tersedia dari aplikasi lokal." }, 403, requestId, true);
  }
  if (!isSameOriginRequest(request)) {
    return json({ code: "FORBIDDEN_ORIGIN", message: "Permintaan harus berasal dari aplikasi ini." }, 403, requestId, true);
  }

  let rawBody: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) {
      return json({ code: "VALIDATION_ERROR", message: "Ukuran permintaan terlalu besar." }, 400, requestId, true);
    }
    rawBody = JSON.parse(text) as unknown;
  } catch {
    return json({ code: "VALIDATION_ERROR", message: "Body harus berupa JSON yang valid." }, 400, requestId, true);
  }

  const parsed = trendRadarRequestSchema.safeParse(rawBody);
  if (!parsed.success || !isSupportedGoogleTrendsGeo(parsed.data.geo ?? "")) {
    return json({ code: "VALIDATION_ERROR", message: "Filter Google Trends tidak valid." }, 400, requestId, true);
  }

  try {
    const user = await getCurrentUser();
    if (!user) return json({ code: "UNAUTHENTICATED", message: "Silakan masuk untuk memuat sinyal." }, 401, requestId, true);
    if (user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED
      || (user.userType !== USER_TYPES.ENTREPRENEUR && user.userType !== USER_TYPES.UMKM_EXISTING)) {
      return json({ code: "PROFILE_INCOMPLETE", message: "Selesaikan profil sebelum memuat sinyal." }, 422, requestId, true);
    }
    if (!isSearchApiEvidenceTokenConfigured()) {
      return json({ code: "EVIDENCE_SIGNING_UNAVAILABLE", message: "Sinyal belum dapat diamankan untuk sesi ini. Atur AUTH_SECRET lokal dengan nilai acak yang kuat sebelum memuat sinyal." }, 503, requestId, true);
    }
    const data = await new SearchApiOpportunitySignalService().listForUser(
      user.id,
      user.userType,
      parsed.data,
      (diagnostics) => {
        if (process.env.NODE_ENV === "development") {
          console.info("opportunity_searchapi_signals_diagnostic", { requestId, ...diagnostics });
        }
      },
    );
    if (process.env.NODE_ENV === "development") {
      console.info("opportunity_searchapi_signals_response", {
        requestId,
        httpStatus: 200,
        responseStatus: "SUCCESS",
        returnedSignalCount: data.top.length + data.rising.length,
      });
    }
    return json(data, 200, requestId);
  } catch (error) {
    const response = responseError(error, requestId);
    if (process.env.NODE_ENV === "development") {
      const errorCode = error instanceof SearchApiTrendsError
        || error instanceof SearchApiEvidenceTokenError
        || error instanceof SearchApiOpportunitySignalError
        || error instanceof TrendRadarServiceError
        ? error.code
        : error instanceof Error && error.name === "InvalidTrendRadarTimeError" ? "VALIDATION_ERROR" : "SERVICE_UNAVAILABLE";
      console.warn("opportunity_searchapi_signals_error", {
        requestId,
        httpStatus: response.status,
        responseStatus: "ERROR",
        errorCode,
        upstreamStatus: error instanceof SearchApiTrendsError ? error.upstreamStatus : null,
      });
    }
    return response;
  }
}
