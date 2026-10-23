import { NextResponse } from "next/server";

import { savedOpportunityPageQuerySchema } from "@/opportunity/saved-dto";
import {
  SavedOpportunityAccessContextError,
  SavedOpportunityInvalidQueryError,
  SavedOpportunityService,
  SavedOpportunityUnauthenticatedError,
} from "@/opportunity/saved-service";

export const runtime = "nodejs";

const ALLOWED_QUERY_KEYS = new Set(["page", "pageSize", "sort", "order"]);

function response(requestId: string, status: number, body: Record<string, unknown>): Response {
  return NextResponse.json(body, {
    status,
    headers: { "X-Request-Id": requestId, "Cache-Control": "private, no-store" },
  });
}

function errorResponse(requestId: string, code: string, message: string, status: number): Response {
  return response(requestId, status, { success: false, error: { code, message }, requestId });
}

export async function GET(request: Request): Promise<Response> {
  const requestId = `req_${crypto.randomUUID()}`;
  const params = new URL(request.url).searchParams;
  const entries = [...params.entries()];
  if (entries.some(([key]) => !ALLOWED_QUERY_KEYS.has(key))
    || [...ALLOWED_QUERY_KEYS].some((key) => params.getAll(key).length > 1)) {
    return errorResponse(requestId, "VALIDATION_ERROR", "Parameter daftar Saved Opportunities tidak valid.", 400);
  }

  const queryInput = Object.fromEntries(entries);
  const parsedQuery = savedOpportunityPageQuerySchema.safeParse(queryInput);
  if (!parsedQuery.success) {
    return errorResponse(requestId, "VALIDATION_ERROR", "Pagination atau sorting Saved Opportunities tidak valid.", 400);
  }

  try {
    const data = await new SavedOpportunityService().listPageForCurrentUser(parsedQuery.data);
    return response(requestId, 200, { success: true, data, requestId });
  } catch (error) {
    if (error instanceof SavedOpportunityUnauthenticatedError) {
      return errorResponse(requestId, "UNAUTHORIZED", "Authentication required.", 401);
    }
    if (error instanceof SavedOpportunityAccessContextError) {
      return errorResponse(requestId, "PROFILE_INCOMPLETE", "Selesaikan profil sebelum membuka simpanan.", 422);
    }
    if (error instanceof SavedOpportunityInvalidQueryError) {
      return errorResponse(requestId, "VALIDATION_ERROR", "Pagination atau sorting Saved Opportunities tidak valid.", 400);
    }
    console.error("Saved Opportunities API request failed", {
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return errorResponse(requestId, "INTERNAL_ERROR", "Daftar simpanan belum dapat dimuat.", 500);
  }
}
