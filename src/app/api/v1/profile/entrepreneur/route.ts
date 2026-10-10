import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getCurrentUser } from "../../../../../auth/current-user";
import {
  CurrentUserNotFoundError,
} from "../../../../../auth/errors";
import {
  EntrepreneurProfileForbiddenError,
  EntrepreneurProfileNotFoundError,
  EntrepreneurProfileStateError,
  InvalidReferenceDataError,
} from "../../../../../profile/errors";
import { EntrepreneurProfileService } from "../../../../../profile/service";

export const runtime = "nodejs";

function getValidationFields(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".");
    if (field) {
      fields[field] = [...(fields[field] ?? []), issue.message];
    }
  }
  return fields;
}

export async function PUT(request: Request): Promise<Response> {
  const requestId = `req_${crypto.randomUUID()}`;
  const responseHeaders = { "X-Request-Id": requestId };

  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required." },
          requestId,
        },
        { status: 401, headers: responseHeaders },
      );
    }

    const data = await new EntrepreneurProfileService().save(
      await request.json(),
      currentUser.id,
    );
    return NextResponse.json(
      { success: true, data, requestId },
      { status: 200, headers: responseHeaders },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Data profile belum valid.",
            fields: getValidationFields(error),
          },
          requestId,
        },
        { status: 400, headers: responseHeaders },
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Request body harus berupa JSON yang valid.",
          },
          requestId,
        },
        { status: 400, headers: responseHeaders },
      );
    }

    if (error instanceof EntrepreneurProfileForbiddenError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Akses profile tidak diizinkan." },
          requestId,
        },
        { status: 403, headers: responseHeaders },
      );
    }

    if (error instanceof InvalidReferenceDataError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "RESOURCE_NOT_FOUND", message: "Reference data tidak ditemukan." },
          requestId,
        },
        { status: 404, headers: responseHeaders },
      );
    }

    if (error instanceof CurrentUserNotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "RESOURCE_NOT_FOUND", message: "Akun tidak ditemukan." },
          requestId,
        },
        { status: 404, headers: responseHeaders },
      );
    }

    if (error instanceof EntrepreneurProfileStateError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "CONFLICT", message: "Status onboarding belum siap untuk disimpan." },
          requestId,
        },
        { status: 409, headers: responseHeaders },
      );
    }

    if (error instanceof EntrepreneurProfileNotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "RESOURCE_NOT_FOUND", message: "Entrepreneur profile tidak ditemukan." },
          requestId,
        },
        { status: 404, headers: responseHeaders },
      );
    }

    console.error("Entrepreneur profile save failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Terjadi kesalahan pada server." },
        requestId,
      },
      { status: 500, headers: responseHeaders },
    );
  }
}
