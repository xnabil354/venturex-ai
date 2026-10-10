import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { EmailAlreadyExistsError } from "../../../../../auth/errors";
import { AuthService } from "../../../../../auth/service";
import { registrationSchema } from "../../../../../auth/validation";

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

export async function POST(request: Request): Promise<Response> {
  const requestId = `req_${crypto.randomUUID()}`;
  const responseHeaders = { "X-Request-Id": requestId };

  try {
    const input = registrationSchema.parse(await request.json());
    const user = await new AuthService().register(input);
    return NextResponse.json(
      { success: true, data: user, requestId },
      { status: 201, headers: responseHeaders },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Data registrasi belum valid.",
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

    if (error instanceof EmailAlreadyExistsError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "EMAIL_ALREADY_EXISTS",
            message: "Email sudah digunakan. Silakan login atau gunakan email lain.",
          },
          requestId,
        },
        { status: 409, headers: responseHeaders },
      );
    }

    console.error("Authentication registration failed", {
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
