import { randomUUID } from "node:crypto";

import { getCurrentUser } from "@/auth/current-user";
import { BillingService } from "@/billing/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: { code: "UNAUTHORIZED", message: "Silakan masuk terlebih dahulu." }, requestId }, { status: 401, headers: { "Cache-Control": "private, no-store", "X-Request-Id": requestId } });
  try {
    const data = await new BillingService().summaryForUser(user.id);
    return Response.json({ data, requestId }, { headers: { "Cache-Control": "private, no-store", "X-Request-Id": requestId } });
  } catch {
    return Response.json({ error: { code: "BILLING_UNAVAILABLE", message: "Informasi paket belum dapat dimuat." }, requestId }, { status: 503, headers: { "Cache-Control": "private, no-store", "X-Request-Id": requestId } });
  }
}
