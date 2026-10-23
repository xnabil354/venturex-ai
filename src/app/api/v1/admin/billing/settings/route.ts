import { randomUUID } from "node:crypto";

import { getCurrentAdmin } from "@/auth/current-admin";
import { getBillingSettings } from "@/billing/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const headers = { "Cache-Control": "private, no-store", "X-Request-Id": requestId };
  if (!(await getCurrentAdmin())) {
    return Response.json({ error: { code: "FORBIDDEN", message: "Akses admin diperlukan." }, requestId }, { status: 403, headers });
  }
  try {
    return Response.json({ data: await getBillingSettings(), requestId }, { headers });
  } catch {
    return Response.json({ error: { code: "BILLING_UNAVAILABLE", message: "Konfigurasi billing belum dapat dimuat." }, requestId }, { status: 503, headers });
  }
}
