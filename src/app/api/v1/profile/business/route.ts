import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getCurrentUser } from "../../../../../auth/current-user";
import { CurrentUserNotFoundError } from "../../../../../auth/errors";
import {
  BusinessProfileForbiddenError,
  BusinessProfileNotFoundError,
  BusinessProfileStateError,
  InvalidBusinessReferenceDataError,
} from "../../../../../profile/business-errors";
import { BusinessProfileService } from "../../../../../profile/business-service";

export const runtime = "nodejs";

type RouteError = {
  readonly code: string;
  readonly message: string;
  readonly status: number;
};

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

function errorResponse(
  requestId: string,
  responseHeaders: HeadersInit,
  error: RouteError,
): Response {
  return NextResponse.json(
    {
      success: false,
      error: { code: error.code, message: error.message },
      requestId,
    },
    { status: error.status, headers: responseHeaders },
  );
}

export async function PUT(request: Request): Promise<Response> {
  const requestId = `req_${crypto.randomUUID()}`;
  const responseHeaders = { "X-Request-Id": requestId };

  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return errorResponse(requestId, responseHeaders, {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
        status: 401,
      });
    }

    const data = await new BusinessProfileService().save(
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
            message: "Data profile bisnis belum valid.",
            fields: getValidationFields(error),
          },
          requestId,
        },
        { status: 400, headers: responseHeaders },
      );
    }

    if (error instanceof SyntaxError) {
      return errorResponse(requestId, responseHeaders, {
        code: "VALIDATION_ERROR",
        message: "Request body harus berupa JSON yang valid.",
        status: 400,
      });
    }

    if (error instanceof BusinessProfileForbiddenError) {
      return errorResponse(requestId, responseHeaders, {
        code: "FORBIDDEN",
        message: "Akses profile bisnis tidak diizinkan.",
        status: 403,
      });
    }

    if (error instanceof BusinessProfileStateError) {
      return errorResponse(requestId, responseHeaders, {
        code: "CONFLICT",
        message: "Status onboarding belum siap untuk menyimpan profile bisnis.",
        status: 409,
      });
    }

    if (error instanceof InvalidBusinessReferenceDataError) {
      return errorResponse(requestId, responseHeaders, {
        code: "VALIDATION_ERROR",
        message: "Reference data bisnis tidak valid atau tidak aktif.",
        status: 400,
      });
    }

    if (error instanceof CurrentUserNotFoundError) {
      return errorResponse(requestId, responseHeaders, {
        code: "RESOURCE_NOT_FOUND",
        message: "Akun tidak ditemukan.",
        status: 404,
      });
    }

    if (error instanceof BusinessProfileNotFoundError) {
      return errorResponse(requestId, responseHeaders, {
        code: "RESOURCE_NOT_FOUND",
        message: "Business profile tidak ditemukan.",
        status: 404,
      });
    }

    console.error("Business profile save failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return errorResponse(requestId, responseHeaders, {
      code: "INTERNAL_ERROR",
      message: "Terjadi kesalahan pada server.",
      status: 500,
    });
  }
}
