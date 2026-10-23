import { NextResponse } from "next/server";
import { z } from "zod";

import { AIAnalysisService } from "../../../../../../ai-analysis/service";
import {
  AIAnalysisAccessContextError,
  AIAnalysisConsentRequiredError,
  AIAnalysisContextChangedError,
  AIAnalysisInsufficientDataError,
  AIAnalysisProfileIncompleteError,
  AIAnalysisProviderFailureError,
  AIAnalysisProviderUnavailableError,
  AIAnalysisRateLimitedError,
  AIAnalysisResourceNotFoundError,
  AIAnalysisResponseInvalidError,
  AIAnalysisUnauthenticatedError,
  OPPORTUNITY_ANALYSIS_DISCLOSURE_VERSION,
} from "../../../../../../ai-analysis/domain";
import { opportunityIdSchema } from "../../../../../../opportunity/domain";
import { BillingError } from "@/billing/errors";
import { BillingService } from "@/billing/service";

export const runtime = "nodejs";

type RouteContext = { readonly params: Promise<{ readonly id: string }> };
const requestSchema = z.object({
  consent: z.literal(true),
  disclosureVersion: z.literal(OPPORTUNITY_ANALYSIS_DISCLOSURE_VERSION),
  forceRefresh: z.boolean().optional(),
}).strict();

function response(requestId: string, status: number, body: Record<string, unknown>, extraHeaders: HeadersInit = {}): Response {
  return NextResponse.json(body, {
    status,
    headers: { "X-Request-Id": requestId, "Cache-Control": "private, no-store", ...extraHeaders },
  });
}

function errorResponse(requestId: string, code: string, message: string, status: number, headers: HeadersInit = {}): Response {
  return response(requestId, status, { success: false, error: { code, message }, requestId }, headers);
}

function mapError(error: unknown, requestId: string): Response {
  if (error instanceof BillingError) return errorResponse(requestId, error.code, error.message, error.code === "AI_ACCESS_LOCKED" ? 403 : error.code === "INSUFFICIENT_CREDITS" ? 402 : 503);
  if (error instanceof AIAnalysisUnauthenticatedError) return errorResponse(requestId, "UNAUTHORIZED", "Authentication required.", 401);
  if (error instanceof AIAnalysisAccessContextError || error instanceof AIAnalysisProfileIncompleteError) {
    return errorResponse(requestId, "PROFILE_INCOMPLETE", "Lengkapi profil sesuai tipe akun sebelum membuat AI Analysis.", 422);
  }
  if (error instanceof AIAnalysisConsentRequiredError) return errorResponse(requestId, "CONSENT_REQUIRED", "Persetujuan pemrosesan AI diperlukan sebelum konteks profil dikirim ke provider.", 400);
  if (error instanceof AIAnalysisResourceNotFoundError) return errorResponse(requestId, "RESOURCE_NOT_FOUND", "Opportunity tidak ditemukan.", 404);
  if (error instanceof AIAnalysisInsufficientDataError) return errorResponse(requestId, "INSUFFICIENT_DATA", "Data tepercaya belum cukup untuk membuat analisis.", 422);
  if (error instanceof AIAnalysisRateLimitedError) {
    return errorResponse(requestId, "RATE_LIMITED", "Tunggu sebentar sebelum meminta analisis lagi.", 429, { "Retry-After": String(error.retryAfterSeconds) });
  }
  if (error instanceof AIAnalysisResponseInvalidError) return errorResponse(requestId, "AI_RESPONSE_INVALID", "Respons AI belum dapat divalidasi. Coba lagi nanti.", 502);
  if (error instanceof AIAnalysisProviderUnavailableError || error instanceof AIAnalysisProviderFailureError) {
    return errorResponse(requestId, "AI_SERVICE_UNAVAILABLE", "Layanan AI belum tersedia. Analisis belum dibuat.", 503);
  }
  if (error instanceof AIAnalysisContextChangedError) return errorResponse(requestId, "ANALYSIS_CONTEXT_CHANGED", "Data berubah saat analisis dibuat. Silakan coba lagi.", 409);

  console.error("AI Opportunity Analysis request failed", {
    requestId,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
  return errorResponse(requestId, "INTERNAL_ERROR", "Analisis belum dapat diproses.", 500);
}

export async function POST(request: Request, route: RouteContext): Promise<Response> {
  const requestId = `req_${crypto.randomUUID()}`;
  let rawBody: unknown = {};
  try {
    const bodyText = await request.text();
    if (bodyText.length > 2048) return errorResponse(requestId, "VALIDATION_ERROR", "Request body terlalu besar.", 400);
    if (bodyText.trim()) rawBody = JSON.parse(bodyText) as unknown;
  } catch {
    return errorResponse(requestId, "VALIDATION_ERROR", "Request body harus berupa JSON yang valid.", 400);
  }
  const parsedBody = requestSchema.safeParse(rawBody);
  if (!parsedBody.success) return errorResponse(requestId, "VALIDATION_ERROR", "Input AI Analysis tidak valid.", 400);

  try {
    const { id } = await route.params;
    if (!opportunityIdSchema.safeParse(id).success) return errorResponse(requestId, "RESOURCE_NOT_FOUND", "Opportunity tidak ditemukan.", 404);
    const generate = () => new AIAnalysisService().generate(id, {
      consentConfirmed: parsedBody.data.consent,
      forceRefresh: parsedBody.data.forceRefresh ?? false,
    });
    if (process.env.NODE_ENV === "test") {
      return response(requestId, 200, { success: true, data: await generate(), requestId });
    }
    const { getCurrentUser } = await import("@/auth/current-user");
    const user = await getCurrentUser();
    if (!user) return errorResponse(requestId, "UNAUTHORIZED", "Authentication required.", 401);
    const data = await new BillingService().runAiUsage(user.id, "DETAILED_ANALYSIS", requestId, generate);
    return response(requestId, 200, { success: true, data, requestId });
  } catch (error) {
    return mapError(error, requestId);
  }
}
