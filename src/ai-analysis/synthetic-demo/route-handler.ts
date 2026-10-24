import { randomUUID } from "node:crypto";
import { readBoundedRequestText } from "../../lib/http-request";
import { syntheticDemoRequestSchema } from "./contracts";
import {
  getSyntheticDemoPostBlockReason,
  type SyntheticDemoEnvironment,
} from "./access";
import {
  SyntheticDemoInvalidRequestError,
  SyntheticDemoProviderFailureError,
  SyntheticDemoProviderTimeoutError,
  SyntheticDemoRateLimitedError,
  SyntheticDemoResponseInvalidError,
  SyntheticDemoService,
} from "./service";

const MAX_REQUEST_BYTES = 1_024;

function json(body: unknown, status: number, requestId: string): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0", "X-Request-Id": requestId },
  });
}

export function createSyntheticDemoPOST(dependencies: {
  readonly env: SyntheticDemoEnvironment;
  readonly service: Pick<SyntheticDemoService, "generate">;
}) {
  return async function POST(request: Request): Promise<Response> {
    const requestId = randomUUID();
    const accessBlockReason = getSyntheticDemoPostBlockReason(request, dependencies.env);
    if (accessBlockReason) return json({ error: "DEMO_UNAVAILABLE", diagnostic: { category: accessBlockReason } }, 404, requestId);
    if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
      return json({ error: "INVALID_REQUEST" }, 415, requestId);
    }

    const bodyText = await readBoundedRequestText(request, MAX_REQUEST_BYTES);
    if (bodyText === null) return json({ error: "INVALID_REQUEST" }, 413, requestId);

    let body: unknown;
    try {
      body = JSON.parse(bodyText) as unknown;
    } catch {
      return json({ error: "INVALID_REQUEST" }, 400, requestId);
    }
    const parsed = syntheticDemoRequestSchema.safeParse(body);
    if (!parsed.success) return json({ error: "INVALID_REQUEST" }, 400, requestId);

    try {
      return json({ data: await dependencies.service.generate(parsed.data) }, 200, requestId);
    } catch (error) {
      if (error instanceof SyntheticDemoInvalidRequestError) return json({ error: "INVALID_REQUEST" }, 400, requestId);
      if (error instanceof SyntheticDemoRateLimitedError) return json({
        error: error.reason,
        diagnostic: { category: error.upstreamStatus === 429 ? "UPSTREAM_RATE_LIMIT" : "REQUEST_BUDGET_EXHAUSTED", upstreamStatus: error.upstreamStatus },
      }, 429, requestId);
      if (error instanceof SyntheticDemoResponseInvalidError) return json({ error: "DEMO_RESPONSE_INVALID", diagnostic: { category: "INVALID_RESPONSE" } }, 502, requestId);
      if (error instanceof SyntheticDemoProviderTimeoutError) {
        const diagnostic = { category: "TIMEOUT", upstreamStatus: null, outboundAttempted: error.outboundAttempted };
        console.warn("venturex_synthetic_ninerouter_failed", { requestId, ...diagnostic });
        return json({ error: "DEMO_TIMEOUT", diagnostic }, 503, requestId);
      }
      if (error instanceof SyntheticDemoProviderFailureError) {
        const diagnostic = { category: error.category, upstreamStatus: error.upstreamStatus, outboundAttempted: error.outboundAttempted };
        console.warn("venturex_synthetic_ninerouter_failed", { requestId, ...diagnostic });
        if (error.category === "UPSTREAM_UNAVAILABLE") {
          return json({ error: "DEMO_UPSTREAM_UNAVAILABLE", diagnostic }, 503, requestId);
        }
        if (error.category === "UPSTREAM_AUTH") {
          return json({ error: "DEMO_PROVIDER_AUTH_FAILED", diagnostic }, 502, requestId);
        }
        if (error.category === "NETWORK_ERROR") {
          return json({ error: "DEMO_PROVIDER_CONNECTION_FAILED", diagnostic }, 503, requestId);
        }
        if (["API_KEY_MISSING", "PROVIDER_MISMATCH", "MODEL_MISMATCH", "NINEROUTER_SMOKE_DISABLED", "PUBLIC_HTTP_DEV_OPT_IN_REQUIRED", "PROVIDER_CONFIGURATION_INVALID", "SDK_CONFIGURATION_INVALID"].includes(error.category)) {
          return json({ error: "DEMO_PROVIDER_CONFIGURATION_UNAVAILABLE", diagnostic }, 503, requestId);
        }
        if (error.category === "INVALID_PROVIDER_RESPONSE") {
          return json({
            error: "DEMO_RESPONSE_INVALID",
            diagnostic: { ...diagnostic, category: "INVALID_RESPONSE", response: error.responseDiagnostic },
          }, 502, requestId);
        }
        return json({ error: "DEMO_PROVIDER_UNAVAILABLE", diagnostic }, 503, requestId);
      }
      console.error("venturex_synthetic_ninerouter_failed", { requestId, category: "UNKNOWN_PROVIDER_ERROR", outboundAttempted: null });
      return json({ error: "DEMO_UNAVAILABLE", diagnostic: { category: "UNKNOWN_PROVIDER_ERROR", outboundAttempted: null } }, 503, requestId);
    }
  };
}
