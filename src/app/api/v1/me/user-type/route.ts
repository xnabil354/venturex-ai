import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  CurrentUserNotFoundError,
  UserTypeAlreadySelectedError,
} from "../../../../../auth/errors";
import { getCurrentUser } from "../../../../../auth/current-user";
import { AuthService } from "../../../../../auth/service";
import { userTypeSelectionSchema } from "../../../../../auth/validation";

export const runtime = "nodejs";

function getValidationFields(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string") {
      continue;
    }
    fields[field] = [...(fields[field] ?? []), issue.message];
  }

  return fields;
}

export async function PATCH(request: Request): Promise<Response> {
  const requestId = `req_${crypto.randomUUID()}`;
  const responseHeaders = { "X-Request-Id": requestId };

  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
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

    const input = userTypeSelectionSchema.parse(await request.json());
    const user = await new AuthService().selectInitialUserType(
      input,
      currentUser.id,
    );

    return NextResponse.json(
      { success: true, data: user, requestId },
      { status: 200, headers: responseHeaders },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Pilihan user type belum valid.",
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

    if (error instanceof UserTypeAlreadySelectedError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CONFLICT",
            message: "User type sudah dipilih sebelumnya.",
          },
          requestId,
        },
        { status: 409, headers: responseHeaders },
      );
    }

    if (error instanceof CurrentUserNotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Akun tidak ditemukan.",
          },
          requestId,
        },
        { status: 404, headers: responseHeaders },
      );
    }

    console.error("User type selection failed", {
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
