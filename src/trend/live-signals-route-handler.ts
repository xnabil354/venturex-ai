import { randomUUID } from "node:crypto";
import { liveTrendAnalysisRequestSchema } from "./live-signals-contract";
import { LiveSignalsError, type LiveTrendSignalsService } from "./live-signals";
import { GOOGLE_TRENDS_TIME_WINDOWS_HOURS, type GoogleTrendsTimeWindowHours } from "./brightdata-google-trends";
import { TrendSignalAnalysisError, type TrendSignalAnalysisService } from "../ai-analysis/trend-signal-analysis";
import { ONBOARDING_STATUSES, isUserType, type SafeUser } from "../auth/user-types";
import { BillingError } from "../billing/errors";

const MAX_ANALYSIS_REQUEST_BYTES = 2_048;
type UserResolver = () => Promise<SafeUser | null>;

function json(data: unknown, status: number, requestId: string, error = false): Response {
  return Response.json(error ? { error: data, requestId } : { data, requestId }, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Request-Id": requestId,
    },
  });
}

function isLoopbackRequest(request: Request): boolean {
  try {
    const hostname = new URL(request.url).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
  } catch {
    return false;
  }
}
function isSameOriginPost(request: Request): boolean {
  const originHeader = request.headers.get("origin");
  const hostHeader = request.headers.get("host");
  if (!originHeader || !hostHeader) return false;
  try {
    const origin = new URL(originHeader);
    return (origin.protocol === "http:" || origin.protocol === "https:")
      && origin.host === hostHeader
      && !origin.username && !origin.password && origin.pathname === "/" && !origin.search && !origin.hash;
  } catch {
    return false;
  }
}

function isLiveSignalsError(error: unknown): error is LiveSignalsError {
  return error instanceof LiveSignalsError || (typeof error === "object" && error !== null && (error as Error).name === "LiveSignalsError" && "code" in error);
}

function isTrendSignalAnalysisError(error: unknown): error is TrendSignalAnalysisError {
  return error instanceof TrendSignalAnalysisError || (typeof error === "object" && error !== null && (error as Error).name === "TrendSignalAnalysisError" && "code" in error);
}

function errorResponse(error: unknown, requestId: string): Response {
  if (error instanceof BillingError) {
    const status = error.code === "AI_ACCESS_LOCKED" ? 403 : error.code === "INSUFFICIENT_CREDITS" ? 402 : 503;
    return json({ code: error.code, message: error.message }, status, requestId, true);
  }
  if (isLiveSignalsError(error)) {
    const status = error.code === "DISPLAY_RIGHTS_UNVERIFIED" ? 403
      : error.code === "SNAPSHOT_NOT_FOUND" ? 404
        : error.code === "SOURCE_RATE_LIMITED" ? 429
          : error.code === "SOURCE_RESPONSE_INVALID" ? 502
            : error.code === "SOURCE_PROVIDER_TIMEOUT" ? 504 : 503;
    return json({ code: error.code, message: messageForLiveSignalsError(error.code) }, status, requestId, true);
  }
  if (isTrendSignalAnalysisError(error)) {
    const status = error.code === "UNAUTHENTICATED" ? 401
      : error.code === "FORBIDDEN" || error.code === "SOURCE_PROCESSING_NOT_APPROVED" ? 403
        : error.code === "SNAPSHOT_NOT_FOUND" ? 404
          : error.code === "RATE_LIMITED" ? 429
            : error.code === "PROFILE_INCOMPLETE" || error.code === "INSUFFICIENT_DATA" ? 422
              : error.code === "AI_RESPONSE_INVALID" || error.code === "AI_UPSTREAM_AUTH_FAILED" ? 502
                : error.code === "AI_UPSTREAM_TIMEOUT" ? 504 : 503;
    const retryAfter = error.code === "RATE_LIMITED" || error.code === "AI_UPSTREAM_UNAVAILABLE"
      || error.code === "AI_UPSTREAM_TIMEOUT" || error.code === "AI_UPSTREAM_NETWORK_FAILED" || error.code === "AI_UPSTREAM_FAILED"
      ? error.retryAfterSeconds : undefined;
    const response = json({
      code: error.code,
      message: messageForAnalysisError(error.code),
      ...(error.providerDiagnostic ? { providerDiagnostic: error.providerDiagnostic } : {}),
    }, status, requestId, true);
    if (!retryAfter) return response;
    const headers = new Headers(response.headers);
    headers.set("Retry-After", String(retryAfter));
    return new Response(response.body, { status: response.status, headers });
  }
  console.error("venturex_trends_request_failed", {
    requestId,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
  return json({ code: "SERVICE_UNAVAILABLE", message: "Layanan Google Trends sementara tidak tersedia." }, 503, requestId, true);
}

function messageForLiveSignalsError(code: LiveSignalsError["code"]): string {
  switch (code) {
    case "DISPLAY_RIGHTS_UNVERIFIED": return "Konten sumber Google Trends belum dapat ditampilkan sebelum izin penggunaan dikonfirmasi. Sumber belum dipanggil; konektivitas belum diperiksa.";
    case "LIVE_PREVIEW_DISABLED": return "Pengambilan sinyal live belum diaktifkan untuk lingkungan ini.";
    case "PROVIDER_NOT_CONFIGURED": return "Konfigurasi pengambilan Google Trends belum tersedia.";
    case "SOURCE_RATE_LIMITED": return "Refresh terlalu sering. Coba kembali setelah jeda singkat.";
    case "SOURCE_PROVIDER_TIMEOUT": return "Google Trends tidak merespons sebelum batas waktu.";
    case "SOURCE_RESPONSE_INVALID": return "Respons Google Trends tidak memenuhi kontrak data yang diharapkan.";
    case "SOURCE_PROVIDER_UNAVAILABLE": return "Pengambilan Google Trends sementara tidak tersedia.";
    case "SNAPSHOT_NOT_FOUND": return "Snapshot telah kedaluwarsa atau tidak tersedia untuk akun ini.";
  }
}

function messageForAnalysisError(code: TrendSignalAnalysisError["code"]): string {
  switch (code) {
    case "INVALID_REQUEST": return "Permintaan analisis tidak valid.";
    case "UNAUTHENTICATED": return "Silakan masuk untuk meminta analisis.";
    case "FORBIDDEN": return "Akun ini tidak berhak menggunakan analisis Trend.";
    case "PROFILE_INCOMPLETE": return "Lengkapi profil terlebih dahulu; tidak ada data profil yang dikirim.";
    case "INSUFFICIENT_DATA": return "Konteks profil atau observasi belum cukup untuk analisis.";
    case "SNAPSHOT_NOT_FOUND": return "Observasi telah kedaluwarsa atau bukan milik sesi ini.";
    case "CONSENT_REQUIRED": return "Persetujuan pemrosesan AI belum diberikan.";
    case "SOURCE_PROCESSING_NOT_APPROVED": return "Analisis belum tersedia saat ini.";
    case "AI_SERVICE_UNAVAILABLE": return "Analisis belum tersedia saat ini.";
    case "AI_FEATURE_DISABLED": return "Analisis belum tersedia saat ini.";
    case "AI_PROVIDER_CONFIGURATION_UNAVAILABLE": return "Analisis belum siap digunakan.";
    case "RATE_LIMITED": return "Analisis baru saja diminta. Tunggu sebelum mencoba kembali.";
    case "AI_RESPONSE_INVALID": return "Hasil analisis tidak dapat ditampilkan. Coba lagi.";
    case "AI_UPSTREAM_FAILED": return "Analisis gagal dimuat. Coba lagi.";
    case "AI_UPSTREAM_UNAVAILABLE": return "Analisis belum tersedia saat ini. Coba lagi nanti.";
    case "AI_UPSTREAM_TIMEOUT": return "Analisis terlalu lama. Coba lagi nanti.";
    case "AI_UPSTREAM_NETWORK_FAILED": return "Analisis gagal dimuat. Coba lagi.";
    case "AI_UPSTREAM_AUTH_FAILED": return "Analisis belum siap digunakan.";
  }
}

async function boundedRequestText(request: Request): Promise<string | null> {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/u.test(length) || Number(length) > MAX_ANALYSIS_REQUEST_BYTES)) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_ANALYSIS_REQUEST_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export function createLiveTrendSignalsRefreshPOST(dependencies: {
  readonly resolveUser: UserResolver;
  readonly service: Pick<LiveTrendSignalsService, "refresh">;
}) {
  return async function POST(request: Request): Promise<Response> {
    const requestId = `req_${randomUUID()}`;
    if (!isSameOriginPost(request)) return json({ code: "FORBIDDEN", message: "Permintaan lintas origin ditolak." }, 403, requestId, true);
    if (process.env.NODE_ENV !== "test" && !isLoopbackRequest(request)) return json({ code: "LIVE_PREVIEW_DISABLED", message: "Observasi Google Trends hanya tersedia dari aplikasi lokal." }, 403, requestId, true);
    const requestedHours = new URL(request.url).searchParams.get("hours");
    const timeWindowHours = requestedHours === null ? 24 : Number(requestedHours);
    if (!GOOGLE_TRENDS_TIME_WINDOWS_HOURS.includes(timeWindowHours as GoogleTrendsTimeWindowHours)) {
      return json({ code: "INVALID_TIME_WINDOW", message: "Pilih rentang 4, 24, 48, atau 168 jam." }, 400, requestId, true);
    }
    try {
      const user = await dependencies.resolveUser();
      if (!user) return json({ code: "UNAUTHORIZED", message: "Silakan masuk untuk memuat sinyal." }, 401, requestId, true);
      if (!isUserType(user.userType) || user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED) {
        return json({ code: "PROFILE_INCOMPLETE", message: "Profil lengkap diperlukan untuk Trend Radar." }, 422, requestId, true);
      }
      const result = await dependencies.service.refresh(user.id, timeWindowHours as GoogleTrendsTimeWindowHours);
      return json(result, 200, requestId);
    } catch (error) {
      return errorResponse(error, requestId);
    }
  };
}

export function createLiveTrendSignalsAnalysisPOST(dependencies: {
  readonly resolveUser: UserResolver;
  readonly service: Pick<TrendSignalAnalysisService, "generate">;
}) {
  return async function POST(request: Request): Promise<Response> {
    const requestId = `req_${randomUUID()}`;
    if (!isSameOriginPost(request)) return json({ code: "FORBIDDEN", message: "Permintaan lintas origin ditolak." }, 403, requestId, true);
    if (process.env.NODE_ENV !== "test" && !isLoopbackRequest(request)) return json({ code: "LIVE_PREVIEW_DISABLED", message: "Observasi Google Trends hanya tersedia dari aplikasi lokal." }, 403, requestId, true);
    try {
      const user = await dependencies.resolveUser();
      if (!user) return json({ code: "UNAUTHORIZED", message: "Silakan masuk untuk meminta analisis." }, 401, requestId, true);
      if (!isUserType(user.userType) || user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED) {
        return json({ code: "PROFILE_INCOMPLETE", message: "Profil lengkap diperlukan untuk analisis." }, 422, requestId, true);
      }
      if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
        return json({ code: "INVALID_REQUEST", message: "Permintaan analisis tidak valid." }, 400, requestId, true);
      }
      const text = await boundedRequestText(request);
      if (!text) return json({ code: "INVALID_REQUEST", message: "Permintaan analisis tidak valid." }, 400, requestId, true);
      let body: unknown;
      try { body = JSON.parse(text) as unknown; } catch { return json({ code: "INVALID_REQUEST", message: "Permintaan analisis tidak valid." }, 400, requestId, true); }
      const parsed = liveTrendAnalysisRequestSchema.safeParse(body);
      if (!parsed.success) return json({ code: "INVALID_REQUEST", message: "Permintaan analisis tidak valid." }, 400, requestId, true);
      const action = () => dependencies.service.generate(user, parsed.data, requestId);
      const result = await action();
      return json(result, 200, requestId);
    } catch (error) {
      return errorResponse(error, requestId);
    }
  };
}
