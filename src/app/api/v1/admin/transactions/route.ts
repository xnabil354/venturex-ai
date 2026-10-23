import { randomUUID } from "node:crypto";

import { z } from "zod";

import { getCurrentAdmin } from "@/auth/current-admin";
import { listTransactions } from "@/billing/admin";
import { isBillingProductCode } from "@/billing/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(["PENDING", "PAID", "FAILED", "EXPIRED"]).optional(),
  productCode: z.string().max(32).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
}).strict();

export async function GET(request: Request): Promise<Response> {
  const requestId = randomUUID();
  const headers = { "Cache-Control": "private, no-store", "X-Request-Id": requestId };
  if (!(await getCurrentAdmin())) return Response.json({ error: { code: "FORBIDDEN", message: "Akses admin diperlukan." }, requestId }, { status: 403, headers });
  const raw = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success || (parsed.data.productCode && !isBillingProductCode(parsed.data.productCode))) return Response.json({ error: { code: "INVALID_REQUEST", message: "Filter transaksi tidak valid." }, requestId }, { status: 400, headers });
  const productCode = parsed.data.productCode && isBillingProductCode(parsed.data.productCode) ? parsed.data.productCode : undefined;
  const data = await listTransactions({
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
    ...(productCode ? { productCode } : {}),
    ...(parsed.data.from ? { from: new Date(`${parsed.data.from}T00:00:00.000Z`) } : {}),
    ...(parsed.data.to ? { to: new Date(`${parsed.data.to}T00:00:00.000Z`) } : {}),
  });
  return Response.json({ data, requestId }, { headers });
}
