import "server-only";
import { z } from "zod";
import { getCurrentUser } from "@/auth/current-user";
import { DashboardQueryService } from "@/dashboard/service";
import { JourneyRepository, JourneyStateError } from "./repository";
import { buildJourneyReport } from "./model";
import { hasTrustedApplicationOrigin } from "@/lib/http-request";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie", "X-Content-Type-Options": "nosniff" };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers });
const fail = (status: number, message: string) => json({ error: { message } }, status);
export async function journeyHttp(request: Request, id?: string, progressOnly = false): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) return fail(401, "Silakan masuk kembali.");
    const role = user.userType;
    if (user.onboardingStatus !== "COMPLETED" || (role !== "ENTREPRENEUR" && role !== "UMKM_EXISTING")) return fail(403, "Lengkapi profil terlebih dahulu.");
    const repository = new JourneyRepository();
    if (!id) {
      const page = z.coerce.number().int().min(1).max(100000).safeParse(new URL(request.url).searchParams.get("page") ?? "1");
      if (!page.success) return fail(400, "Halaman tidak valid.");
      const result = await repository.list(user.id, role, page.data);
      const items = await Promise.all(result.items.map(async item => {
        const progress = await repository.progress(user.id, role, item);
        return { id: item.id, title: item.hypothesis.title, completed: progress?.steps.filter(s => s.completedAt).length ?? 0, total: progress?.steps.length ?? 0, available: progress?.complete ?? false };
      }));
      return json({ items, page: result.page, hasMore: result.hasMore });
    }
    if (!z.string().uuid().safeParse(id).success) return fail(400, "Peluang tidak valid.");
    if (request.method === "PATCH") {
      if (!hasTrustedApplicationOrigin(request)) return fail(403, "Permintaan tidak diizinkan.");
      const reader = request.body?.getReader();
      if (!reader) return fail(400, "Data belum lengkap.");
      const chunks: Uint8Array[] = []; let size = 0;
      try { while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length; if (size > 512) { await reader.cancel(); return fail(413, "Data terlalu besar."); } chunks.push(chunk.value); } } finally { reader.releaseLock(); }
      const input = z.object({ stage: z.number().int().min(1).max(6), completed: z.boolean(), fingerprint: z.string().regex(/^[a-f0-9]{64}$/u) }).strict().parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      if (!(await repository.update(user.id, role, id, input))) return fail(404, "Roadmap tidak ditemukan.");
    }
    const item = await repository.find(user.id, role, id);
    if (!item) return fail(404, "Roadmap tidak ditemukan.");
    const progress = await repository.progress(user.id, role, item);
    if (!progress) return fail(404, "Roadmap belum tersedia.");
    if (progressOnly) return json(progress);
    const format = new URL(request.url).searchParams.get("format");
    if (format !== "pdf" && format !== "xlsx") return fail(400, "Pilih format PDF atau Excel.");
    if (!progress.complete) return fail(409, "Selesaikan seluruh tahap roadmap dan pastikan analisis sesuai sebelum mengunduh laporan.");
    const dashboard = await new DashboardQueryService({ currentUserResolver: async () => user }).get();
    const report = buildJourneyReport(item, dashboard, progress);
    const { exportPdf, exportExcel } = await import("./export");
    const file = format === "pdf" ? await exportPdf(report) : await exportExcel(report);
    return new Response(new Uint8Array(file), { headers: { ...headers, "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="venturex-${role === "ENTREPRENEUR" ? "startup" : "growth"}-${new Date().toISOString().slice(0, 10)}.${format}"` } });
  } catch (error) {
    if (error instanceof JourneyStateError) return fail(409, error.message);
    if (error instanceof z.ZodError || error instanceof SyntaxError || error instanceof TypeError) return fail(400, "Periksa kembali permintaan Anda.");
    return fail(503, "Laporan belum dapat diproses. Coba lagi.");
  }
}
