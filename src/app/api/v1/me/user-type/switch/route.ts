import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  CurrentUserNotFoundError,
  UserTypeAlreadyActiveError,
  UserTypeSwitchNotAllowedError,
} from "../../../../../../auth/errors";
import { getCurrentUser } from "../../../../../../auth/current-user";
import { AuthService } from "../../../../../../auth/service";
import { userTypeSwitchSchema } from "../../../../../../auth/validation";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 256;

function headersFor(requestId: string): Record<string, string> {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Request-Id": requestId,
    Vary: "Cookie",
  };
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const targetUrl = new URL(request.url);
    return originUrl.origin === targetUrl.origin && !originUrl.username && !originUrl.password;
  } catch {
    return false;
  }
}

function validationFields(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string") continue;
    fields[field] = [...(fields[field] ?? []), issue.message];
  }
  return fields;
}

export async function POST(request: Request): Promise<Response> {
  const requestId = `req_${crypto.randomUUID()}`;
  const headers = headersFor(requestId);

  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Permintaan harus berasal dari aplikasi ini." }, requestId },
      { status: 403, headers },
    );
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Request body terlalu besar." }, requestId },
      { status: 400, headers },
    );
  }

  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required." }, requestId },
        { status: 401, headers },
      );
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Request body terlalu besar." }, requestId },
        { status: 400, headers },
      );
    }
    const input = userTypeSwitchSchema.parse(JSON.parse(rawBody));
    const user = await new AuthService().switchUserType(input, currentUser.id);

    return NextResponse.json({ success: true, data: user, requestId }, { headers });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Request body harus berupa JSON yang valid." }, requestId },
        { status: 400, headers },
      );
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Pilihan user type belum valid.", fields: validationFields(error) }, requestId },
        { status: 400, headers },
      );
    }
    if (error instanceof UserTypeSwitchNotAllowedError) {
      return NextResponse.json(
        { success: false, error: { code: "CONFLICT", message: "Ganti persona tersedia setelah onboarding selesai." }, requestId },
        { status: 409, headers },
      );
    }
    if (error instanceof UserTypeAlreadyActiveError) {
      return NextResponse.json(
        { success: false, error: { code: "CONFLICT", message: "Persona tersebut sudah aktif." }, requestId },
        { status: 409, headers },
      );
    }
    if (error instanceof CurrentUserNotFoundError) {
      return NextResponse.json(
        { success: false, error: { code: "RESOURCE_NOT_FOUND", message: "Akun tidak ditemukan." }, requestId },
        { status: 404, headers },
      );
    }

    console.error("User type switch failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Terjadi kesalahan pada server." }, requestId },
      { status: 500, headers },
    );
  }
}
