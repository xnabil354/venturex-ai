import "server-only";
import { z } from "zod";
import { getCurrentUser } from "@/auth/current-user";
import { EntrepreneurAnalysisError, EntrepreneurAnalysisService } from "@/opportunity/entrepreneur-analysis-service";
import { BillingError } from "@/billing/errors";
import { BillingService } from "@/billing/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

function sameOrigin(request: Request): boolean {
  try {
    const value = request.headers.get("origin");
    if (!value) return false;
    const origin = new URL(value);
    const target = new URL(request.url);
    return origin.host === (request.headers.get("host") ?? target.host) && origin.protocol === target.protocol && origin.pathname === "/" && !origin.username && !origin.password && !origin.search && !origin.hash;
  } catch { return false; }
}

async function readBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new EntrepreneurAnalysisError("INVALID_REQUEST");
  const decoder = new TextDecoder();
  let size = 0, text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 2048) { await reader.cancel(); throw new EntrepreneurAnalysisError("INVALID_REQUEST"); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text) as unknown;
  } catch { throw new EntrepreneurAnalysisError("INVALID_REQUEST"); }
  finally { reader.releaseLock(); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store, max-age=0" };
  try {
    if (!sameOrigin(request)) throw new EntrepreneurAnalysisError("FORBIDDEN");
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) throw new EntrepreneurAnalysisError("INVALID_REQUEST");
    const user = await getCurrentUser();
    if (!user) throw new EntrepreneurAnalysisError("UNAUTHENTICATED");
    const parsed = await readBody(request);
    const deadline = AbortSignal.any([request.signal, AbortSignal.timeout(160_000)]);
    const data = await new BillingService().runAiUsage(user.id, "DETAILED_ANALYSIS", `detail-${id}-${crypto.randomUUID()}`, async () => {
      if (user.userType === "UMKM_EXISTING") {
        const { BusinessAnalysisService } = await import("@/opportunity/business-analysis-service");
        return new BusinessAnalysisService().analyze(user, id, parsed, deadline);
      }
      return new EntrepreneurAnalysisService().analyze(user, id, parsed, deadline);
    });
    return Response.json({ data }, { headers });
  } catch (error) {
    const code: string = error instanceof BillingError ? error.code : error instanceof EntrepreneurAnalysisError ? error.code : "UNAVAILABLE";
    const status = ({ UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, INVALID_REQUEST: 400, UNAVAILABLE: 503, RATE_LIMITED: 429, AI_ACCESS_LOCKED: 403, INSUFFICIENT_CREDITS: 402 } as Record<string, number>)[code] ?? 503;
    const message = error instanceof BillingError ? error.message : ({ UNAUTHENTICATED: "Masuk kembali untuk membuka analisis.", FORBIDDEN: "Analisis memerlukan profil lengkap, hipotesis milik Anda, dan persetujuan pemrosesan.", NOT_FOUND: "Hipotesis tidak ditemukan.", INVALID_REQUEST: "Periksa persetujuan dan estimasi yang diisi.", UNAVAILABLE: "Analisis belum dapat disimpan atau diproses. Hipotesis dan hasil sebelumnya tetap tersedia.", RATE_LIMITED: "Analisis masih berjalan atau baru selesai. Tunggu sebentar sebelum memperbarui." } as Record<string, string>)[code] ?? "Analisis belum dapat diproses.";
    return Response.json({ error: { code, message } }, { status, headers: { ...headers, ...(status === 429 ? { "Retry-After": "60" } : {}) } });
  }
}
