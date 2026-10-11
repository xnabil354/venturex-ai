import { NextResponse } from "next/server";

import {
  OpportunityComparisonAccessContextError,
  OpportunityComparisonInvalidRequestError,
  OpportunityComparisonResourceNotFoundError,
  OpportunityComparisonService,
  OpportunityComparisonUnauthenticatedError,
} from "@/opportunity/compare-service";

export const runtime = "nodejs";
const MAX_BODY_LENGTH = 4096;

function response(requestId: string, status: number, body: Record<string, unknown>): Response {
  return NextResponse.json(body, {
    status,
    headers: { "X-Request-Id": requestId, "Cache-Control": "private, no-store" },
  });
}

function errorResponse(requestId: string, code: string, message: string, status: number): Response {
  return response(requestId, status, { success: false, error: { code, message }, requestId });
}

async function readBoundedBody(request: Request): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let byteLength = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      byteLength += chunk.value.byteLength;
      if (byteLength > MAX_BODY_LENGTH) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request): Promise<Response> {
  const requestId = `req_${crypto.randomUUID()}`;
  const rawContentLength = request.headers.get("content-length");
  const contentLength = rawContentLength === null ? null : Number(rawContentLength);
  if (contentLength !== null && Number.isFinite(contentLength) && contentLength > MAX_BODY_LENGTH) {
    return errorResponse(requestId, "VALIDATION_ERROR", "Request body terlalu besar.", 400);
  }

  let body: unknown;
  try {
    const text = await readBoundedBody(request);
    if (text === null) {
      return errorResponse(requestId, "VALIDATION_ERROR", "Request body terlalu besar.", 400);
    }
    body = JSON.parse(text) as unknown;
  } catch {
    return errorResponse(requestId, "VALIDATION_ERROR", "Request body harus berupa JSON yang valid.", 400);
  }

  try {
    const data = await new OpportunityComparisonService().compare(body);
    return response(requestId, 200, { success: true, data, requestId });
  } catch (error) {
    if (error instanceof OpportunityComparisonUnauthenticatedError) {
      return errorResponse(requestId, "UNAUTHORIZED", "Authentication required.", 401);
    }
    if (error instanceof OpportunityComparisonAccessContextError) {
      return errorResponse(requestId, "PROFILE_INCOMPLETE", "Selesaikan onboarding sebelum membandingkan Opportunity.", 422);
    }
    if (error instanceof OpportunityComparisonInvalidRequestError) {
      return errorResponse(requestId, "VALIDATION_ERROR", "Pilih dua atau tiga Opportunity yang berbeda.", 400);
    }
    if (error instanceof OpportunityComparisonResourceNotFoundError) {
      return errorResponse(requestId, "RESOURCE_NOT_FOUND", "Satu atau lebih Opportunity tidak tersedia.", 404);
    }
    console.error("Opportunity comparison request failed", {
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return errorResponse(requestId, "INTERNAL_ERROR", "Perbandingan belum dapat dimuat.", 500);
  }
}
