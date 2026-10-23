import { randomUUID } from "node:crypto";

import { z } from "zod";

import { getCurrentUser } from "@/auth/current-user";
import { BILLING_PRODUCTS, isBillingProductCode } from "@/billing/catalog";
import { createDuitkuPopInvoice } from "@/billing/checkout";
import { BillingError } from "@/billing/errors";
import { BillingService } from "@/billing/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ productCode: z.string().max(32) }).strict();
const lastCheckoutByUser = new Map<string, number>();

function sameOrigin(request: Request): boolean {
  try {
    const origin = new URL(request.headers.get("origin") ?? "");
    const host = request.headers.get("host");
    return !!host && origin.host === host && origin.pathname === "/" && !origin.search && !origin.hash;
  } catch { return false; }
}

export async function POST(request: Request): Promise<Response> {
  const requestId = randomUUID();
  const headers = { "Cache-Control": "private, no-store", "X-Request-Id": requestId };
  if (!sameOrigin(request)) return Response.json({ error: { code: "FORBIDDEN", message: "Permintaan lintas origin ditolak." }, requestId }, { status: 403, headers });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: { code: "UNAUTHORIZED", message: "Silakan masuk terlebih dahulu." }, requestId }, { status: 401, headers });
  const last = lastCheckoutByUser.get(user.id) ?? 0;
  if (Date.now() - last < 5_000) return Response.json({ error: { code: "RATE_LIMITED", message: "Tunggu sebentar sebelum membuat pembayaran berikutnya." }, requestId }, { status: 429, headers: { ...headers, "Retry-After": "5" } });
  let productCode: keyof typeof BILLING_PRODUCTS;
  try {
    const text = await request.text();
    if (text.length > 512) throw new Error("invalid");
    const parsed = bodySchema.safeParse(JSON.parse(text) as unknown);
    if (!parsed.success || !isBillingProductCode(parsed.data.productCode)) throw new Error("invalid");
    productCode = parsed.data.productCode;
  } catch {
    return Response.json({ error: { code: "INVALID_REQUEST", message: "Produk pembayaran tidak valid." }, requestId }, { status: 400, headers });
  }
  try {
    lastCheckoutByUser.set(user.id, Date.now());
    const product = BILLING_PRODUCTS[productCode];
    const payment = await new BillingService().createPendingPayment(user.id, productCode);
    const invoice = await createDuitkuPopInvoice({ merchantOrderId: payment.merchantOrderId, amount: payment.amount, productDetails: product.name, email: user.email });
    return Response.json({ data: { checkoutUrl: invoice.paymentUrl }, requestId }, { status: 201, headers });
  } catch (error) {
    console.error("venturex_billing_checkout_failed", { requestId, errorName: error instanceof Error ? error.name : "UnknownError" });
    const code = error instanceof BillingError ? error.code : "CHECKOUT_UNAVAILABLE";
    const message = code === "CHECKOUT_UPSTREAM_TIMEOUT"
      ? "Duitku sandbox belum merespons. Coba lagi beberapa saat lagi."
      : "Checkout belum dapat dibuat. Coba lagi nanti.";
    return Response.json({ error: { code, message }, requestId }, { status: 503, headers });
  }
}
