import { NextResponse } from "next/server";

type ReferenceLoader<T> = () => Promise<readonly T[]>;

export async function getReferenceResponse<T>(
  loader: ReferenceLoader<T>,
): Promise<Response> {
  const requestId = `req_${crypto.randomUUID()}`;
  const responseHeaders = { "X-Request-Id": requestId };

  try {
    const data = await loader();
    return NextResponse.json(
      { success: true, data, requestId },
      { status: 200, headers: responseHeaders },
    );
  } catch (error) {
    console.error("Reference data lookup failed", {
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
