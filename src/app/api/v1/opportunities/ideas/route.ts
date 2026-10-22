import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import { getCurrentUser } from "@/auth/current-user";
import { NINEROUTER_ALLOW_PUBLIC_HTTP_DEV_ONLY_FLAG } from "@/ai-analysis/ninerouter";
import { PrivateOpportunityError, PrivateOpportunityHypothesisService } from "@/opportunity/private-hypothesis-service";
import { messageForPrivateOpportunityError } from "@/opportunity/private-opportunity-error-message";
import { PrivateHypothesisStateError } from "@/opportunity/private-hypothesis-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 10_240;

function json(data: unknown, status: number, requestId: string, isError = false, retryAfter?: number, metadata?: Readonly<Record<string, unknown>>): Response {
  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "X-Request-Id": requestId,
  });
  if (retryAfter && retryAfter > 0) headers.set("Retry-After", String(retryAfter));
  return Response.json(isError ? { error: data, requestId } : { data, ...metadata, requestId }, { status, headers });
}

function sameOriginMutation(request: Request): boolean {
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
    case "PROFILE_INCOMPLETE":
    case "PROFILE_CONTEXT_TOO_LARGE": return 422;
    case "INVALID_REQUEST": return 400;
    case "AI_RATE_LIMITED": return 429;
    case "AI_RESPONSE_INVALID": return 502;
    case "SOURCE_TOKEN_CONFIGURATION_UNAVAILABLE": return 503;
    case "INSECURE_PROVIDER_TRANSPORT": return 503;
    case "AI_UPSTREAM_AUTH_FAILED": return 502;
    case "PERSISTENCE_UNAVAILABLE": return 503;
    case "AI_FEATURE_DISABLED":
    case "AI_PROVIDER_CONFIGURATION_UNAVAILABLE":
    case "AI_UPSTREAM_UNAVAILABLE": return 503;
  }
}

function errorResponse(error: unknown, requestId: string): Response {
  if (error instanceof PrivateHypothesisStateError) return json({ code: error.code, message: error.code === "SAVED_PERMANENT" ? "Peluang tersimpan bersifat permanen dan tidak dapat dihapus atau diubah." : error.code === "ANALYSIS_CHANGED" ? "Analisis berubah atau perlu diperbarui. Muat ulang dan tinjau kembali sebelum menyimpan." : "Lengkapi analisis dan kedua skor sebelum menyimpan peluang." }, 409, requestId, true);
  if (error instanceof PrivateOpportunityError) {
    if (error.providerDiagnostic) {
      const eventName = error.providerDiagnostic.category === "CONTENT_POLICY_REJECTED"
        ? "venturex_private_opportunity_grounding_rejected"
        : "venturex_private_opportunity_provider_failure";
      console.warn(eventName, {
        requestId,
        provider: "ninerouter",
        model: "cx/gpt-6-luna-xhigh",
        ...error.providerDiagnostic,
      });
    }
    return json({
      code: error.code,
      message: messageForPrivateOpportunityError(error),
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
  if (!sameOriginMutation(request)) return json({ code: "FORBIDDEN", message: "Permintaan lintas origin ditolak." }, 403, requestId, true);
  try {
    const user = await getCurrentUser();
    const body = await readBody(request);
    const result = await new PrivateOpportunityHypothesisService().generateForUser(user, body, request.signal);
    if (result.outcome === "INSUFFICIENT_EVIDENCE") {
      return json([], 200, requestId, false, undefined, {
        outcome: result.outcome,
        reason: result.reason,
        limitations: result.limitations,
      });
    }
    return json(result.items, 201, requestId, false, undefined, { outcome: result.outcome });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const requestId = randomUUID();
  if (!isAllowedRequestHost(request)) return json({ code: "FORBIDDEN", message: "Fitur ini hanya tersedia dari aplikasi lokal." }, 403, requestId, true);
  if (!sameOriginMutation(request)) return json({ code: "FORBIDDEN", message: "Permintaan lintas origin ditolak." }, 403, requestId, true);
  try {
    const body = await readBody(request);
    if (typeof body !== "object" || body === null || Array.isArray(body)) throw new PrivateOpportunityError("INVALID_REQUEST");
    const parsed = z.object({ id: z.string().uuid(), saved: z.boolean(), reviewed: z.literal(true).optional(), analysisFingerprint: z.string().regex(/^[a-f0-9]{64}$/u).optional() }).strict().safeParse(body);
    if (!parsed.success) throw new PrivateOpportunityError("INVALID_REQUEST");
    const user = await getCurrentUser();
    const item = await new PrivateOpportunityHypothesisService().setSavedForUser(user, parsed.data.id, parsed.data.saved, parsed.data.reviewed === true, parsed.data.analysisFingerprint);
    return json(item, 200, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const requestId = randomUUID();
  if (!isAllowedRequestHost(request)) return json({ code: "FORBIDDEN", message: "Fitur ini hanya tersedia dari aplikasi lokal." }, 403, requestId, true);
  if (!sameOriginMutation(request)) return json({ code: "FORBIDDEN", message: "Permintaan lintas origin ditolak." }, 403, requestId, true);
  try {
    const body = await readBody(request);
    if (typeof body !== "object" || body === null || Array.isArray(body)) throw new PrivateOpportunityError("INVALID_REQUEST");
    const parsed = z.object({ id: z.string().uuid() }).strict().safeParse(body);
    if (!parsed.success) throw new PrivateOpportunityError("INVALID_REQUEST");
    const user = await getCurrentUser();
    await new PrivateOpportunityHypothesisService().removeForUser(user, parsed.data.id);
    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
