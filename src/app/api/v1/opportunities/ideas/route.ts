import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import { getCurrentUser } from "@/auth/current-user";
import { NINEROUTER_ALLOW_PUBLIC_HTTP_DEV_ONLY_FLAG } from "@/ai-analysis/ninerouter";
import { PrivateOpportunityError, PrivateOpportunityHypothesisService } from "@/opportunity/private-hypothesis-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 2_048;

function json(data: unknown, status: number, requestId: string, isError = false, retryAfter?: number): Response {
  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "X-Request-Id": requestId,
  });
  if (retryAfter && retryAfter > 0) headers.set("Retry-After", String(retryAfter));
  return Response.json(isError ? { error: data, requestId } : { data, requestId }, { status, headers });
}

function sameOriginPost(request: Request): boolean {
  const originValue = request.headers.get("origin");
  const hostValue = request.headers.get("host");
  if (!originValue || !hostValue) return false;
  try {
    const origin = new URL(originValue);
    return (origin.protocol === "http:" || origin.protocol === "https:")
      && origin.host === hostValue
      && origin.pathname === "/"
      && !origin.username && !origin.password && !origin.search && !origin.hash;
  } catch {
    return false;
  }
}

function isLoopbackHost(host: string): boolean {
  try {
    const hostname = new URL(`http://${host}`).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
  } catch {
    return false;
  }
}

function isLocalPublicHttpMode(): boolean {
  return process.env.NODE_ENV === "development"
    && process.env[NINEROUTER_ALLOW_PUBLIC_HTTP_DEV_ONLY_FLAG] === "true";
}

function isAllowedRequestHost(request: Request): boolean {
  if (!isLocalPublicHttpMode()) return true;
  const host = request.headers.get("host");
  return host !== null && isLoopbackHost(host) && isLoopbackHost(new URL(request.url).host);
}

async function readBody(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/u.test(contentLength) && Number(contentLength) > MAX_REQUEST_BYTES) {
    throw new PrivateOpportunityError("INVALID_REQUEST");
  }
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_REQUEST_BYTES) throw new PrivateOpportunityError("INVALID_REQUEST");
  try { return JSON.parse(text) as unknown; } catch { throw new PrivateOpportunityError("INVALID_REQUEST"); }
}

function statusFor(code: PrivateOpportunityError["code"]): number {
  switch (code) {
    case "UNAUTHENTICATED": return 401;
    case "FORBIDDEN":
    case "CONSENT_REQUIRED":
    case "SOURCE_PROCESSING_NOT_APPROVED": return 403;
    case "SOURCE_SIGNAL_UNAVAILABLE": return 404;
    case "PROFILE_INCOMPLETE": return 422;
    case "INVALID_REQUEST": return 400;
    case "AI_RATE_LIMITED": return 429;
    case "AI_RESPONSE_INVALID": return 502;
    case "AI_UPSTREAM_AUTH_FAILED": return 502;
    case "PERSISTENCE_UNAVAILABLE": return 503;
    case "AI_FEATURE_DISABLED":
    case "AI_PROVIDER_CONFIGURATION_UNAVAILABLE":
    case "AI_UPSTREAM_UNAVAILABLE": return 503;
  }
}

function messageFor(code: PrivateOpportunityError["code"]): string {
  switch (code) {
    case "UNAUTHENTICATED": return "Silakan masuk sebelum membuat hipotesis peluang.";
    case "FORBIDDEN": return "Profil pengguna yang selesai diperlukan untuk membuat hipotesis.";
    case "PROFILE_INCOMPLETE": return "Lengkapi minat, segmen pelanggan, dan kanal usaha pada profil terlebih dahulu.";
    case "INVALID_REQUEST": return "Permintaan hipotesis tidak valid.";
    case "CONSENT_REQUIRED": return "Persetujuan pemrosesan profil diperlukan.";
    case "AI_FEATURE_DISABLED": return "Pembuatan hipotesis AI belum diaktifkan.";
    case "SOURCE_PROCESSING_NOT_APPROVED": return "Pemrosesan sinyal Bright Data oleh 9Router belum diizinkan.";
    case "AI_PROVIDER_CONFIGURATION_UNAVAILABLE": return "Konfigurasi 9Router belum siap atau tidak diizinkan pada lingkungan ini. Profil tidak dikirim.";
    case "SOURCE_SIGNAL_UNAVAILABLE": return "Sinyal live tidak tersedia, kedaluwarsa, atau bukan milik sesi ini.";
    case "AI_RATE_LIMITED": return "Tunggu sebelum meminta hipotesis lagi.";
    case "AI_RESPONSE_INVALID": return "Hasil 9Router tidak lolos validasi. Tidak ada hipotesis yang disimpan.";
    case "AI_UPSTREAM_AUTH_FAILED": return "9Router menolak autentikasi server. Periksa API key gateway dan penerusan header di VPS; tidak ada hipotesis yang disimpan.";
    case "PERSISTENCE_UNAVAILABLE": return "Hasil tervalidasi belum dapat disimpan. Tidak ada data katalog yang diubah.";
    case "AI_UPSTREAM_UNAVAILABLE": return "9Router tidak menyelesaikan permintaan. Tidak ada hasil simulasi yang ditampilkan.";
  }
}

function errorResponse(error: unknown, requestId: string): Response {
  if (error instanceof PrivateOpportunityError) {
    if (error.providerDiagnostic) {
      console.warn("venturex_private_opportunity_provider_failure", {
        requestId,
        provider: "ninerouter",
        model: "cx/gpt-6-luna-xhigh",
        ...error.providerDiagnostic,
      });
    }
    return json({
      code: error.code,
      message: messageFor(error.code),
      ...(process.env.NODE_ENV === "development" && error.providerDiagnostic
        ? { providerDiagnostic: error.providerDiagnostic }
        : {}),
    }, statusFor(error.code), requestId, true,
      error.code === "AI_RATE_LIMITED" ? error.retryAfterSeconds : undefined);
  }
  console.error("venturex_private_opportunity_request_failed", { requestId, errorName: error instanceof Error ? error.name : "UnknownError" });
  return json({ code: "SERVICE_UNAVAILABLE", message: "Hipotesis peluang belum dapat dimuat." }, 503, requestId, true);
}

export async function GET(request: Request): Promise<Response> {
  const requestId = randomUUID();
  if (!isAllowedRequestHost(request)) return json({ code: "FORBIDDEN", message: "Fitur ini hanya tersedia dari aplikasi lokal." }, 403, requestId, true);
  try {
    const user = await getCurrentUser();
    const savedOnly = new URL(request.url).searchParams.get("saved") === "true";
    const items = await new PrivateOpportunityHypothesisService().listForUser(user, savedOnly);
    return json(items, 200, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function POST(request: Request): Promise<Response> {
  const requestId = randomUUID();
  if (!isAllowedRequestHost(request)) return json({ code: "FORBIDDEN", message: "Fitur ini hanya tersedia dari aplikasi lokal." }, 403, requestId, true);
  if (!sameOriginPost(request)) return json({ code: "FORBIDDEN", message: "Permintaan lintas origin ditolak." }, 403, requestId, true);
  try {
    const user = await getCurrentUser();
    const items = await new PrivateOpportunityHypothesisService().generateForUser(user, await readBody(request));
    return json(items, 201, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const requestId = randomUUID();
  if (!isAllowedRequestHost(request)) return json({ code: "FORBIDDEN", message: "Fitur ini hanya tersedia dari aplikasi lokal." }, 403, requestId, true);
  if (!sameOriginPost(request)) return json({ code: "FORBIDDEN", message: "Permintaan lintas origin ditolak." }, 403, requestId, true);
  try {
    const body = await readBody(request);
    if (typeof body !== "object" || body === null || Array.isArray(body)) throw new PrivateOpportunityError("INVALID_REQUEST");
    const parsed = z.object({ id: z.string().uuid(), saved: z.boolean() }).strict().safeParse(body);
    if (!parsed.success) throw new PrivateOpportunityError("INVALID_REQUEST");
    const user = await getCurrentUser();
    const item = await new PrivateOpportunityHypothesisService().setSavedForUser(user, parsed.data.id, parsed.data.saved);
    return json(item, 200, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
