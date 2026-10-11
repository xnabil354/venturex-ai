import { NextResponse } from "next/server";

import { roadmapIdSchema } from "../../../../../roadmap/domain";
import { RoadmapUnauthenticatedError, StartupRoadmapService } from "../../../../../roadmap/service";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { readonly params: Promise<{ readonly roadmapId: string }> }): Promise<Response> {
  const requestId = `req_${crypto.randomUUID()}`;
  const headers = { "X-Request-Id": requestId, "Cache-Control": "private, no-store" };
  const { roadmapId } = await context.params;
  if (!roadmapIdSchema.safeParse(roadmapId).success) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Roadmap ID harus berupa UUID yang valid." }, requestId }, { status: 400, headers });
  }
  try {
    const data = await new StartupRoadmapService().getForCurrentUser(roadmapId);
    if (!data) return NextResponse.json({ success: false, error: { code: "RESOURCE_NOT_FOUND", message: "Roadmap tidak ditemukan." }, requestId }, { status: 404, headers });
    return NextResponse.json({ success: true, data, requestId }, { status: 200, headers });
  } catch (error) {
    if (error instanceof RoadmapUnauthenticatedError) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Authentication required." }, requestId }, { status: 401, headers });
    }
    console.error("Roadmap detail API request failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Roadmap belum dapat dimuat." }, requestId }, { status: 500, headers });
  }
}
