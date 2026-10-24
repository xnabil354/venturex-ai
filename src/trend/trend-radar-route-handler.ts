import { randomUUID } from "node:crypto";
import { isSameOriginRequest } from "../lib/http-request";

import { ONBOARDING_STATUSES, isUserType, type SafeUser } from "@/auth/user-types";

import { SearchApiTrendsError } from "./searchapi-google-trends";
import { isSupportedGoogleTrendsGeo } from "./searchapi-google-trends-geography";
import { trendRadarRequestSchema } from "./trend-radar-contract";
import { TrendRadarServiceError } from "./trend-radar-service";

type TrendRadarServicePort = {
  getRelatedQueries(
    userId: SafeUser["id"],
    userType: NonNullable<SafeUser["userType"]>,
    request: ReturnType<typeof trendRadarRequestSchema.parse>,
    requestId: string,
  ): Promise<unknown>;
};

type UserResolver = () => Promise<SafeUser | null>;

const MAX_BODY_BYTES = 2_048;

function jsonResponse(requestId: string, status: number, body: Record<string, unknown>): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Request-Id": requestId,
    },
  });
}

function errorResponse(requestId: string, code: string, message: string, status: number): Response {
  return jsonResponse(requestId, status, {
    success: false,
    error: { code, message },
    requestId,
  });
}

function mapError(error: unknown, requestId: string, operation: "related_queries" | "interest"): Response {
  if (error instanceof TrendRadarServiceError) {
    return errorResponse(requestId, error.code, "Kueri dari profil belum tersedia. Lengkapi profil terlebih dahulu.", 422);
  }
  if (error instanceof SearchApiTrendsError) {
    switch (error.code) {
      case "FEATURE_DISABLED":
        return errorResponse(requestId, error.code, "Fitur tren belum tersedia saat ini.", 503);
      case "CONFIGURATION_INVALID":
        return errorResponse(requestId, error.code, "Konfigurasi layanan Trend Radar belum valid.", 503);
      case "REQUEST_BUDGET_EXCEEDED":
        return errorResponse(requestId, error.code, "Batas permintaan Trend Radar hari ini telah tercapai. Coba lagi besok.", 429);
      case "PROVIDER_RATE_LIMITED":
        return errorResponse(requestId, error.code, "Terlalu banyak permintaan. Coba lagi nanti.", 429);
      case "PROVIDER_QUOTA_EXCEEDED":
        return errorResponse(requestId, error.code, "Data tren gagal dimuat. Coba lagi nanti.", 503);
      case "PROVIDER_TIMEOUT":
        return errorResponse(requestId, error.code, "Data tren gagal dimuat. Coba lagi.", 504);
      case "PROVIDER_AUTH_FAILED":
      case "PROVIDER_UNAVAILABLE":
        return errorResponse(requestId, error.code, "Data tren gagal dimuat. Coba lagi nanti.", 503);
      case "PROVIDER_RESPONSE_INVALID":
        return errorResponse(requestId, error.code, "Data tren tidak dapat ditampilkan.", 502);
    }
  }
  if (error instanceof Error && error.name === "InvalidTrendRadarTimeError") {
    return errorResponse(requestId, "VALIDATION_ERROR", "Rentang waktu tidak valid untuk zona waktu Asia/Jakarta.", 400);
  }
  console.error(`trend_radar_${operation}_failed`, {
    requestId,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
  return errorResponse(requestId, "INTERNAL_ERROR", "Trend Radar belum dapat dimuat.", 500);
}

export function createTrendRadarRelatedQueriesPOST(dependencies: {
  readonly resolveUser: UserResolver;
  readonly service: TrendRadarServicePort;
}): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const requestId = "req_" + randomUUID();
    if (!isSameOriginRequest(request)) {
      return errorResponse(requestId, "FORBIDDEN_ORIGIN", "Permintaan harus berasal dari aplikasi ini.", 403);
    }

    let rawBody: unknown;
    try {
      const bodyText = await request.text();
      if (new TextEncoder().encode(bodyText).byteLength > MAX_BODY_BYTES) {
        return errorResponse(requestId, "VALIDATION_ERROR", "Ukuran permintaan terlalu besar.", 400);
      }
      rawBody = JSON.parse(bodyText) as unknown;
    } catch {
      return errorResponse(requestId, "VALIDATION_ERROR", "Body harus berupa JSON yang valid.", 400);
    }

    const parsed = trendRadarRequestSchema.safeParse(rawBody);
    if (!parsed.success || !isSupportedGoogleTrendsGeo(parsed.data.geo ?? "")) {
      return errorResponse(requestId, "VALIDATION_ERROR", "Filter Trend Radar tidak valid.", 400);
    }

    try {
      const user = await dependencies.resolveUser();
      if (!user) return errorResponse(requestId, "UNAUTHORIZED", "Silakan masuk untuk membuka Trend Radar.", 401);
      if (user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED || !isUserType(user.userType)) {
        return errorResponse(requestId, "PROFILE_INCOMPLETE", "Selesaikan onboarding sebelum membuka Trend Radar.", 422);
      }
      const data = await dependencies.service.getRelatedQueries(user.id, user.userType, parsed.data, requestId);
      return jsonResponse(requestId, 200, { success: true, data, requestId });
    } catch (error) {
      return mapError(error, requestId, "related_queries");
    }
  };
}

export function createTrendRadarInterestPOST(dependencies: {
  readonly resolveUser: UserResolver;
  readonly service: {
    getInterest(
      userId: SafeUser["id"],
      userType: NonNullable<SafeUser["userType"]>,
      request: ReturnType<typeof trendRadarRequestSchema.parse>,
      requestId: string,
    ): Promise<unknown>;
  };
}): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const requestId = "req_" + randomUUID();
    if (!isSameOriginRequest(request)) {
      return errorResponse(requestId, "FORBIDDEN_ORIGIN", "Permintaan harus berasal dari aplikasi ini.", 403);
    }

    let rawBody: unknown;
    try {
      const bodyText = await request.text();
      if (new TextEncoder().encode(bodyText).byteLength > MAX_BODY_BYTES) {
        return errorResponse(requestId, "VALIDATION_ERROR", "Ukuran permintaan terlalu besar.", 400);
      }
      rawBody = JSON.parse(bodyText) as unknown;
    } catch {
      return errorResponse(requestId, "VALIDATION_ERROR", "Body harus berupa JSON yang valid.", 400);
    }

    const parsed = trendRadarRequestSchema.safeParse(rawBody);
    if (!parsed.success || !isSupportedGoogleTrendsGeo(parsed.data.geo ?? "")) {
      return errorResponse(requestId, "VALIDATION_ERROR", "Filter Trend Radar tidak valid.", 400);
    }

    try {
      const user = await dependencies.resolveUser();
      if (!user) return errorResponse(requestId, "UNAUTHORIZED", "Silakan masuk untuk membuka Trend Radar.", 401);
      if (user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED || !isUserType(user.userType)) {
        return errorResponse(requestId, "PROFILE_INCOMPLETE", "Selesaikan onboarding sebelum membuka Trend Radar.", 422);
      }
      const data = await dependencies.service.getInterest(user.id, user.userType, parsed.data, requestId);
      return jsonResponse(requestId, 200, { success: true, data, requestId });
    } catch (error) {
      return mapError(error, requestId, "interest");
    }
  };
}
