import "server-only";

import { getServerEnv } from "@/lib/env";

import { createDuitkuSignature } from "./duitku";
import { BillingError } from "./errors";

type InvoiceResponse = {
  readonly paymentUrl?: string;
  readonly reference?: string;
  readonly statusCode?: string;
  readonly statusMessage?: string;
};

const DUITKU_SANDBOX_INQUIRY_URL = "https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry";
const DUITKU_SANDBOX_TEST_PAYMENT_METHOD = "VC";

export async function createDuitkuPopInvoice(input: {
  readonly merchantOrderId: string;
  readonly amount: number;
  readonly productDetails: string;
  readonly email: string;
}): Promise<{ paymentUrl: string; reference?: string }> {
  const env = getServerEnv();
  if (!env.DUITKU_MERCHANT_CODE || !env.DUITKU_API_KEY || !env.APP_URL) {
    throw new BillingError("BILLING_NOT_CONFIGURED", "Pembayaran sandbox belum dikonfigurasi.");
  }
  const baseUrl = new URL(env.APP_URL);
  if (baseUrl.protocol !== "https:" && !(process.env.NODE_ENV === "development" && (baseUrl.hostname === "localhost" || baseUrl.hostname === "127.0.0.1"))) {
    throw new BillingError("BILLING_NOT_CONFIGURED", "APP_URL pembayaran harus memakai HTTPS.");
  }
  let response: Response;
  try {
    response = await fetch(DUITKU_SANDBOX_INQUIRY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        merchantCode: env.DUITKU_MERCHANT_CODE,
        paymentAmount: input.amount,
        merchantOrderId: input.merchantOrderId,
        productDetails: input.productDetails,
        // VC is an active sandbox channel for this MVP. It directs to Duitku's
        // hosted page, where their documented test card can be used.
        paymentMethod: DUITKU_SANDBOX_TEST_PAYMENT_METHOD,
        customerVaName: "VENTUREX",
        email: input.email,
        itemDetails: [{ name: input.productDetails, price: input.amount, quantity: 1 }],
        callbackUrl: new URL("/api/v1/billing/duitku/callback", baseUrl).toString(),
        returnUrl: new URL("/billing/return", baseUrl).toString(),
        expiryPeriod: 60,
        signature: createDuitkuSignature(env.DUITKU_MERCHANT_CODE, input.merchantOrderId, input.amount, env.DUITKU_API_KEY),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new BillingError("CHECKOUT_UPSTREAM_TIMEOUT", "Duitku sandbox tidak merespons sebelum batas waktu.");
    }
    throw new BillingError("CHECKOUT_UNAVAILABLE", "Duitku sandbox belum dapat dihubungi.");
  }
  const body = await response.json().catch(() => ({})) as InvoiceResponse;
  const paymentUrl = body.paymentUrl;
  if (!response.ok || body.statusCode !== "00" || !paymentUrl) {
    throw new BillingError("CHECKOUT_UNAVAILABLE", "Duitku sandbox belum dapat membuat pembayaran.");
  }
  const parsedUrl = new URL(paymentUrl);
  if (parsedUrl.protocol !== "https:" || !parsedUrl.hostname.endsWith("duitku.com")) {
    throw new BillingError("CHECKOUT_UNAVAILABLE", "URL pembayaran dari provider tidak valid.");
  }
  return body.reference ? { paymentUrl: parsedUrl.toString(), reference: body.reference } : { paymentUrl: parsedUrl.toString() };
}
