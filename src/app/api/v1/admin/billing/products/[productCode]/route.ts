import { randomUUID } from "node:crypto";

import { z } from "zod";

import { getCurrentAdmin } from "@/auth/current-admin";
import { BillingAdminError, updateProductSetting } from "@/billing/admin";
import { isBillingProductCode } from "@/billing/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ amount: z.number().int().positive().max(100_000_000), credits: z.number().int().min(1).max(10_000), version: z.number().int().positive() }).strict();

function sameOrigin(request: Request): boolean {
  try {
    const origin = new URL(request.headers.get("origin") ?? "");
    const host = request.headers.get("host");
    return Boolean(host) && origin.host === host && origin.pathname === "/" && !origin.search && !origin.hash;
  } catch { return false; }
}

export async function PATCH(request: Request, context: { params: Promise<{ productCode: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const headers = { "Cache-Control": "private, no-store", "X-Request-Id": requestId };
  // ASVS 3.5.1: cookie-authenticated state changes require the same origin.
  if (!sameOrigin(request)) return Response.json({ error: { code: "FORBIDDEN", message: "Permintaan lintas origin ditolak." }, requestId }, { status: 403, headers });
  const admin = await getCurrentAdmin();
  if (!admin) return Response.json({ error: { code: "FORBIDDEN", message: "Akses admin diperlukan." }, requestId }, { status: 403, headers });
  const { productCode } = await context.params;
  if (!isBillingProductCode(productCode)) return Response.json({ error: { code: "NOT_FOUND", message: "Produk tidak ditemukan." }, requestId }, { status: 404, headers });
  let body: z.infer<typeof bodySchema>;
  try {
    const text = await request.text();
    if (text.length > 512) throw new Error("too large");
    body = bodySchema.parse(JSON.parse(text) as unknown);
  } catch {
    return Response.json({ error: { code: "INVALID_REQUEST", message: "Nilai harga atau kredit tidak valid." }, requestId }, { status: 400, headers });
  }
  try {
    const data = await updateProductSetting({ adminId: admin.id, productCode, amount: body.amount, credits: body.credits, expectedVersion: body.version });
    return Response.json({ data, requestId }, { headers });
  } catch (error) {
    if (error instanceof BillingAdminError) return Response.json({ error: { code: error.code, message: error.message }, requestId }, { status: error.code === "VERSION_CONFLICT" ? 409 : 404, headers });
    return Response.json({ error: { code: "BILLING_UNAVAILABLE", message: "Konfigurasi belum dapat disimpan." }, requestId }, { status: 503, headers });
  }
}
