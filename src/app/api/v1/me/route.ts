import { NextResponse } from "next/server";

import { getCurrentUser } from "../../../../auth/current-user";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const requestId = `req_${crypto.randomUUID()}`;
  const responseHeaders = { "X-Request-Id": requestId };

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required.",
          },
          requestId,
        },
        { status: 401, headers: responseHeaders },
      );
    }

    return NextResponse.json(
      { success: true, data: user, requestId },
      { status: 200, headers: responseHeaders },
    );
  } catch (error) {
    console.error("Current user lookup failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Terjadi kesalahan pada server.",
        },
        requestId,
      },
      { status: 500, headers: responseHeaders },
    );
  }
}
