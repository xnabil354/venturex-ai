export class SyntheticDemoInvalidRequestError extends Error {
  override readonly name = "SyntheticDemoInvalidRequestError";
}
export class SyntheticDemoRateLimitedError extends Error {
  override readonly name = "SyntheticDemoRateLimitedError";
  constructor(readonly reason: "RATE_LIMITED" | "BUSY", readonly upstreamStatus: number | null = null) { super("The local demo is temporarily unavailable."); }
}
export class SyntheticDemoProviderFailureError extends Error {
  override readonly name = "SyntheticDemoProviderFailureError";
  constructor(
    readonly category: SyntheticDemoProviderFailureCategory = "UNKNOWN_PROVIDER_ERROR",
    readonly upstreamStatus: number | null = null,
    readonly outboundAttempted: boolean | null = null,
    readonly responseDiagnostic: Readonly<{
      failure: "EMPTY_TEXT" | "INVALID_JSON" | "SCHEMA_VALIDATION_FAILED";
      jsonRootType?: "object" | "array" | "string" | "number" | "boolean" | "null";
      issueCount?: number;
      issues?: readonly Readonly<{ path: string; code: string }>[];
    }> | null = null,
  ) { super("The synthetic 9Router provider request failed."); }
}

export type SyntheticDemoProviderFailureCategory =
  | "LIVE_MODE_NOT_SELECTED"
  | "LIVE_AUTHORIZATION_MISSING"
  | "LOCAL_DEMO_GUARD_DISABLED"
  | "API_KEY_MISSING"
  | "PROVIDER_MISMATCH"
  | "MODEL_MISMATCH"
  | "NINEROUTER_SMOKE_DISABLED"
  | "PUBLIC_HTTP_DEV_OPT_IN_REQUIRED"
  | "PROVIDER_CONFIGURATION_INVALID"
  | "SDK_CONFIGURATION_INVALID"
  | "LOCAL_REQUEST_REJECTED"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "UPSTREAM_HTTP"
  | "UPSTREAM_UNAVAILABLE"
  | "UPSTREAM_RATE_LIMIT"
  | "UPSTREAM_AUTH"
  | "INVALID_PROVIDER_RESPONSE"
  | "UNKNOWN_PROVIDER_ERROR";
export class SyntheticDemoProviderTimeoutError extends Error {
  override readonly name = "SyntheticDemoProviderTimeoutError";
  constructor(readonly outboundAttempted: boolean | null = null) { super("The synthetic 9Router provider request timed out."); }
}
export class SyntheticDemoResponseInvalidError extends Error {
  override readonly name = "SyntheticDemoResponseInvalidError";
}
