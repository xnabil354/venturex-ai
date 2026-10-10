import { NextResponse } from "next/server";

import {
  OpportunityFitInputContextAccessContextError,
  OpportunityFitInputContextEligibilityError,
  OpportunityFitInputContextUnauthenticatedError,
} from "../../../../../../opportunity/fit-input-context-service";
import { opportunityIdSchema } from "../../../../../../opportunity/domain";
import { FitScoreService } from "../../../../../../scoring/fit-score-service";
import { toFitScoreApiDto } from "../../../../../../scoring/fit-score-api-dto";

export const runtime = "nodejs";

type FitScoreRouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

type RouteError = {
  readonly code: string;
  readonly message: string;
  readonly status: number;
};

function errorResponse(
  requestId: string,
  headers: HeadersInit,
  error: RouteError,
): Response {
  return NextResponse.json(
    {
      success: false,
      error: { code: error.code, message: error.message },
      requestId,
    },
    { status: error.status, headers },
  );
}

export async function GET(
  _request: Request,
  context: FitScoreRouteContext,
): Promise<Response> {
  const requestId = `req_${crypto.randomUUID()}`;
  const headers = {
    "X-Request-Id": requestId,
    "Cache-Control": "private, no-store",
  };

  try {
    const { id } = await context.params;
    const parsedId = opportunityIdSchema.safeParse(id);
    if (!parsedId.success) {
      return errorResponse(requestId, headers, {
        code: "VALIDATION_ERROR",
        message: "Opportunity ID harus berupa UUID yang valid.",
        status: 400,
      });
    }

    // FitScoreService delegates session lookup and eligibility to the existing
    // server-side Fit Input Context service; the request supplies no identity.
    const result = await new FitScoreService().calculateForOpportunity(parsedId.data);
    if (result === null) {
      return errorResponse(requestId, headers, {
        code: "RESOURCE_NOT_FOUND",
        message: "Opportunity tidak ditemukan.",
        status: 404,
      });
    }

    return NextResponse.json(
      { success: true, data: { fitScore: toFitScoreApiDto(result) }, requestId },
      { status: 200, headers },
    );
  } catch (error) {
    if (error instanceof OpportunityFitInputContextUnauthenticatedError) {
      return errorResponse(requestId, headers, {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
        status: 401,
      });
    }

    if (error instanceof OpportunityFitInputContextAccessContextError) {
      return errorResponse(requestId, headers, {
        code: "PROFILE_INCOMPLETE",
        message: "Lengkapi profil sebelum menghitung Fit Score.",
        status: 422,
      });
    }

    if (error instanceof OpportunityFitInputContextEligibilityError) {
      return errorResponse(requestId, headers, {
        code: "RESOURCE_NOT_FOUND",
        message: "Opportunity tidak ditemukan.",
        status: 404,
      });
    }

    console.error("Fit Score API request failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return errorResponse(requestId, headers, {
      code: "INTERNAL_ERROR",
      message: "Terjadi kesalahan pada server.",
      status: 500,
    });
  }
}
