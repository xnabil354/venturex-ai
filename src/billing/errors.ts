export class BillingError extends Error {
  override readonly name = "BillingError";
  constructor(readonly code: "BILLING_NOT_CONFIGURED" | "AI_ACCESS_LOCKED" | "INSUFFICIENT_CREDITS" | "PLAN_ALREADY_ACTIVE" | "CHECKOUT_UNAVAILABLE" | "CHECKOUT_UPSTREAM_TIMEOUT" | "INVALID_CALLBACK", message: string) {
    super(message);
  }
}
