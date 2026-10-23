import { z } from "zod";

import { verifyDuitkuCallback } from "@/billing/duitku";
import { BillingService } from "@/billing/service";
import { getServerEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const callbackSchema = z.object({
  merchantCode: z.string().min(1).max(64), amount: z.string().regex(/^\d+$/u), merchantOrderId: z.string().min(1).max(96),
  resultCode: z.string().min(1).max(16), reference: z.string().max(128).optional(), paymentCode: z.string().max(64).optional(), signature: z.string().regex(/^[a-f0-9]{64}$/iu),
}).strict();

export async function POST(request: Request): Promise<Response> {
  const env = getServerEnv();
  if (!env.DUITKU_MERCHANT_CODE || !env.DUITKU_API_KEY) return new Response("unavailable", { status: 503 });
  try {
    const form = await request.formData();
    const raw = Object.fromEntries(form.entries());
    const parsed = callbackSchema.safeParse(raw);
    if (!parsed.success || !verifyDuitkuCallback(parsed.data, env.DUITKU_MERCHANT_CODE, env.DUITKU_API_KEY)) return new Response("invalid", { status: 400 });
    const outcome = await new BillingService().settleCallback({ merchantOrderId: parsed.data.merchantOrderId, amount: parsed.data.amount, resultCode: parsed.data.resultCode, ...(parsed.data.reference ? { reference: parsed.data.reference } : {}), ...(parsed.data.paymentCode ? { paymentMethod: parsed.data.paymentCode } : {}), signatureValid: true });
    return new Response(outcome === "ACK" ? "OK" : "invalid", { status: outcome === "ACK" ? 200 : 400 });
  } catch {
    return new Response("invalid", { status: 400 });
  }
}
