export const BILLING_PRODUCTS = {
  PREMIUM_30: { code: "PREMIUM_30", kind: "PLAN", plan: "PREMIUM", name: "Premium · 30 hari" },
  PRO_30: { code: "PRO_30", kind: "PLAN", plan: "PRO", name: "Pro · 30 hari" },
  CREDITS_10: { code: "CREDITS_10", kind: "TOPUP", name: "10 kredit" },
  CREDITS_30: { code: "CREDITS_30", kind: "TOPUP", name: "30 kredit" },
  CREDITS_100: { code: "CREDITS_100", kind: "TOPUP", name: "100 kredit" },
} as const;

export type BillingProductCode = keyof typeof BILLING_PRODUCTS;
export type PlanTier = "FREE" | "PREMIUM" | "PRO";
export type AiUsageKind = "OPPORTUNITY_HYPOTHESIS" | "DETAILED_ANALYSIS";

export function isBillingProductCode(value: unknown): value is BillingProductCode {
  return typeof value === "string" && value in BILLING_PRODUCTS;
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
}
