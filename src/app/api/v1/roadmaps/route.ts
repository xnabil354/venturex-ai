import { NextResponse } from "next/server";
import { roadmapInputSchema, roadmapQuerySchema } from "../../../../roadmap/domain";
import {
  RoadmapAnalysisNotFoundError,
  RoadmapForbiddenError,
  RoadmapInsufficientContextError,
  RoadmapOpportunityNotFoundError,
  RoadmapProfileIncompleteError,
  RoadmapUnauthenticatedError,
  RoadmapUserIncompleteError,
  StartupRoadmapService,
} from "../../../../roadmap/service";

export const runtime = "nodejs";

function response(requestId: string, status: number, body: Record<string, unknown>): Response {
  return NextResponse.json(body, {
    status,
    headers: { "X-Request-Id": requestId, "Cache-Control": "private, no-store" },
  });
}

function errorBody(requestId: string, code: string, message: string, status: number): Response {
  return response(requestId, status, { success: false, error: { code, message }, requestId });
}

function mapError(error: unknown, requestId: string): Response {
  if (error instanceof RoadmapUnauthenticatedError) return errorBody(requestId, "UNAUTHORIZED", "Authentication required.", 401);
  if (error instanceof RoadmapForbiddenError) return errorBody(requestId, "ROADMAP_NOT_ALLOWED", "Roadmap tidak tersedia untuk tipe akun ini.", 403);
  if (error instanceof RoadmapUserIncompleteError || error instanceof RoadmapProfileIncompleteError) {
    return errorBody(requestId, "PROFILE_INCOMPLETE", "Lengkapi profil sesuai tipe akun sebelum membuat roadmap.", 422);
  }
  if (error instanceof RoadmapInsufficientContextError) return errorBody(requestId, "INSUFFICIENT_DATA", "Data tepercaya belum cukup untuk membuat roadmap.", 422);
  if (error instanceof RoadmapOpportunityNotFoundError || error instanceof RoadmapAnalysisNotFoundError) {
    return errorBody(requestId, "RESOURCE_NOT_FOUND", "Opportunity atau analisis tidak ditemukan.", 404);
  }
  console.error("Roadmap API request failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
  return errorBody(requestId, "ROADMAP_GENERATION_FAILED", "Roadmap belum dapat diproses.", 500);
}

export async function GET(request: Request): Promise<Response> {
  const requestId = `req_${crypto.randomUUID()}`;
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = roadmapQuerySchema.safeParse(params);
  if (!parsed.success) return errorBody(requestId, "VALIDATION_ERROR", "Parameter Roadmap tidak valid.", 400);
  try {
    const data = await new StartupRoadmapService().listForCurrentUser({
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      ...(parsed.data.type ? { type: parsed.data.type } : {}),
      ...(parsed.data.opportunityId ? { opportunityId: parsed.data.opportunityId } : {}),
      sort: parsed.data.sort,
      order: parsed.data.order,
    });
    return response(requestId, 200, { success: true, data, requestId });
  } catch (error) {
    return mapError(error, requestId);
  }
}

export async function POST(request: Request): Promise<Response> {
  const requestId = `req_${crypto.randomUUID()}`;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorBody(requestId, "VALIDATION_ERROR", "Request body harus berupa JSON yang valid.", 400);
  }
  const parsed = roadmapInputSchema.safeParse(body);
  if (!parsed.success) return errorBody(requestId, "VALIDATION_ERROR", "Input Roadmap tidak valid.", 400);
  try {
    const data = await new StartupRoadmapService().generate({
      opportunityId: parsed.data.opportunityId,
      ...(parsed.data.analysisId ? { analysisId: parsed.data.analysisId } : {}),
    });
    return response(requestId, 201, { success: true, data, requestId });
  } catch (error) {
    return mapError(error, requestId);
  }
}
