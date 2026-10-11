import { NextResponse } from "next/server";

import { opportunityIdSchema } from "@/opportunity/domain";
import {
  SavedOpportunityAccessContextError,
  SavedOpportunityService,
  SavedOpportunityUnauthenticatedError,
} from "@/opportunity/saved-service";

export const runtime = "nodejs";

type RouteContext = { readonly params: Promise<{ readonly opportunityId: string }> };

function response(requestId: string, status: number, body: Record<string, unknown>): Response {
  return NextResponse.json(body, {
    status,
    headers: { "X-Request-Id": requestId, "Cache-Control": "private, no-store" },
  });
}

function errorResponse(requestId: string, code: string, message: string, status: number): Response {
  return response(requestId, status, { success: false, error: { code, message }, requestId });
}

function mapError(error: unknown, requestId: string): Response {
  if (error instanceof SavedOpportunityUnauthenticatedError) {
    return errorResponse(requestId, "UNAUTHORIZED", "Authentication required.", 401);
  }
  if (error instanceof SavedOpportunityAccessContextError) {
    return errorResponse(requestId, "PROFILE_INCOMPLETE", "Selesaikan profil sebelum mengubah simpanan.", 422);
  }
  console.error("Saved Opportunity API request failed", {
    requestId,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
  return errorResponse(requestId, "INTERNAL_ERROR", "Status simpanan belum dapat diperbarui.", 500);
}

export async function POST(_request: Request, route: RouteContext): Promise<Response> {
  const requestId = `req_${crypto.randomUUID()}`;
  const { opportunityId } = await route.params;
  const parsedId = opportunityIdSchema.safeParse(opportunityId);
  if (!parsedId.success) {
    return errorResponse(requestId, "VALIDATION_ERROR", "Opportunity ID harus berupa UUID yang valid.", 400);
  }

  try {
    const result = await new SavedOpportunityService().saveForCurrentUser(parsedId.data);
    if (!result) return errorResponse(requestId, "RESOURCE_NOT_FOUND", "Opportunity tidak ditemukan.", 404);
    const status = result.created ? 201 : 200;
    return response(requestId, status, {
      success: true,
      data: { opportunityId: parsedId.data, saved: true },
      requestId,
    });
  } catch (error) {
    return mapError(error, requestId);
  }
}

export async function DELETE(_request: Request, route: RouteContext): Promise<Response> {
  const requestId = `req_${crypto.randomUUID()}`;
  const { opportunityId } = await route.params;
  const parsedId = opportunityIdSchema.safeParse(opportunityId);
  if (!parsedId.success) {
    return errorResponse(requestId, "VALIDATION_ERROR", "Opportunity ID harus berupa UUID yang valid.", 400);
  }

  try {
    const removed = await new SavedOpportunityService().setSaved(parsedId.data, false);
    if (removed === null) return errorResponse(requestId, "RESOURCE_NOT_FOUND", "Opportunity tidak ditemukan.", 404);
    return new Response(null, {
      status: 204,
      headers: { "X-Request-Id": requestId, "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return mapError(error, requestId);
  }
}
