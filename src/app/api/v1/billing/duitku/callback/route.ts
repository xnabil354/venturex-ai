import { z } from "zod";

import { verifyDuitkuCallback } from "@/billing/duitku";
import { BillingService } from "@/billing/service";
import { getServerEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const callbackSchema = z.object({
  merchantCode: z.string().min(1).max(64), amount: z.string().regex(/^\d+$/u), merchantOrderId: z.string().min(1).max(96),
  resultCode: z.string().min(1).max(16), reference: z.string().max(128).optional(), paymentCode: z.string().max(64).optional(), signature: z.string().regex(/^[a-f0-9]{64}$/iu),
});

const CALLBACK_MAX_BYTES = 4096;
const requiredFields = ["merchantCode", "amount", "merchantOrderId", "resultCode", "signature"] as const;
const optionalFields = ["reference", "paymentCode"] as const;

function invalidCallback(reason: string): Response {
  console.warn("venturex_billing_callback_rejected", { reason });
  return new Response("invalid", { status: 400 });
}

export async function POST(request: Request): Promise<Response> {
  const env = getServerEnv();
  if (!env.DUITKU_MERCHANT_CODE || !env.DUITKU_API_KEY) return new Response("unavailable", { status: 503 });
  try {
    // ASVS 2.2.1 / 4.2: accept only Duitku's observed callback media type,
    // bound the body, and reject duplicate security-sensitive parameters.
    const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (contentType !== "application/x-www-form-urlencoded") return invalidCallback("UNSUPPORTED_CONTENT_TYPE");
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > CALLBACK_MAX_BYTES) return invalidCallback("BODY_TOO_LARGE");
    const form = new URLSearchParams(body);
    for (const field of requiredFields) {
      if (form.getAll(field).length !== 1) return invalidCallback("INVALID_PARAMETER_CARDINALITY");
    }
    for (const field of optionalFields) {
      if (form.getAll(field).length > 1) return invalidCallback("INVALID_PARAMETER_CARDINALITY");
    }
    // Zod strips provider extension fields (for example vaNumber and
    // settlementDate); only explicitly validated values reach settlement.
    const raw = Object.fromEntries(form.entries());
    const parsed = callbackSchema.safeParse(raw);
    if (!parsed.success) return invalidCallback("INVALID_PAYLOAD");
    if (!verifyDuitkuCallback(parsed.data, env.DUITKU_MERCHANT_CODE, env.DUITKU_API_KEY)) return invalidCallback("INVALID_SIGNATURE");
    const outcome = await new BillingService().settleCallback({ merchantOrderId: parsed.data.merchantOrderId, amount: parsed.data.amount, resultCode: parsed.data.resultCode, ...(parsed.data.reference ? { reference: parsed.data.reference } : {}), ...(parsed.data.paymentCode ? { paymentMethod: parsed.data.paymentCode } : {}), signatureValid: true });
    return new Response(outcome === "ACK" ? "OK" : "invalid", { status: outcome === "ACK" ? 200 : 400 });
  } catch {
    return invalidCallback("MALFORMED_REQUEST");
  }
}
