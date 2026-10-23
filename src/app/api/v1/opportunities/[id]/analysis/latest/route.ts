import { NextResponse } from "next/server";

import { AIAnalysisService } from "../../../../../../../ai-analysis/service";
import { AIAnalysisAccessContextError, AIAnalysisResourceNotFoundError, AIAnalysisUnauthenticatedError } from "../../../../../../../ai-analysis/domain";
import { opportunityIdSchema } from "../../../../../../../opportunity/domain";

export const runtime = "nodejs";

type RouteContext = { readonly params: Promise<{ readonly id: string }> };

function response(requestId: string, status: number, body: Record<string, unknown>): Response {
  return NextResponse.json(body, {
    status,
    headers: { "X-Request-Id": requestId, "Cache-Control": "private, no-store" },
  });
}

export async function GET(_request: Request, route: RouteContext): Promise<Response> {
  const requestId = `req_${crypto.randomUUID()}`;
  try {
    const { id } = await route.params;
    if (!opportunityIdSchema.safeParse(id).success) {
      return response(requestId, 404, { success: false, error: { code: "RESOURCE_NOT_FOUND", message: "Opportunity tidak ditemukan." }, requestId });
    }
    const data = await new AIAnalysisService().getLatest(id);
    return response(requestId, 200, { success: true, data, requestId });
  } catch (error) {
    if (error instanceof AIAnalysisUnauthenticatedError) {
      return response(requestId, 401, { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required." }, requestId });
    }
    if (error instanceof AIAnalysisAccessContextError) {
      return response(requestId, 422, { success: false, error: { code: "PROFILE_INCOMPLETE", message: "Lengkapi profil sesuai tipe akun sebelum membuka AI Analysis." }, requestId });
    }
    if (error instanceof AIAnalysisResourceNotFoundError) {
      return response(requestId, 404, { success: false, error: { code: "RESOURCE_NOT_FOUND", message: "Opportunity tidak ditemukan." }, requestId });
    }
    console.error("AI Opportunity Analysis retrieval failed", {
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return response(requestId, 500, { success: false, error: { code: "INTERNAL_ERROR", message: "Analisis belum dapat dimuat." }, requestId });
  }
}
