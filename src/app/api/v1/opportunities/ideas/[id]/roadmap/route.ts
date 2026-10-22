import { z } from "zod";
import { getCurrentUser } from "@/auth/current-user";
import { PrivateHypothesisStateError, PrivateOpportunityHypothesisRepository } from "@/opportunity/private-hypothesis-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  const fail = (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status, headers });
  try {
    const origin = request.headers.get("origin");
    const target = new URL(request.url);
    if (!origin) return fail(403, "FORBIDDEN", "Permintaan harus berasal dari aplikasi ini.");
    let validOrigin = false;
    try { const parsed = new URL(origin); validOrigin = parsed.host === (request.headers.get("host") ?? target.host) && parsed.protocol === target.protocol && parsed.pathname === "/" && !parsed.username && !parsed.password && !parsed.search && !parsed.hash; } catch { /* Reject malformed origins. */ }
    if (!validOrigin) return fail(403, "FORBIDDEN", "Permintaan harus berasal dari aplikasi ini.");
    const user = await getCurrentUser();
    if (!user) return fail(401, "UNAUTHORIZED", "Masuk kembali untuk membuat roadmap.");
    if ((user.userType !== "ENTREPRENEUR" && user.userType !== "UMKM_EXISTING") || user.onboardingStatus !== "COMPLETED") return fail(403, "FORBIDDEN", "Lengkapi profil terlebih dahulu.");
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return fail(400, "INVALID_REQUEST", "Peluang tidak valid.");
    const reader = request.body?.getReader();
    if (!reader) return fail(400, "INVALID_REQUEST", "Isi permintaan tidak valid.");
    let bytes = 0, body = "";
    const decoder = new TextDecoder();
    try { while (true) { const chunk = await reader.read(); if (chunk.done) break; bytes += chunk.value.byteLength; if (bytes > 256) { await reader.cancel(); return fail(400, "INVALID_REQUEST", "Permintaan terlalu besar."); } body += decoder.decode(chunk.value, { stream: true }); } body += decoder.decode(); } finally { reader.releaseLock(); }
    if (!z.object({}).strict().safeParse(JSON.parse(body)).success) return fail(400, "INVALID_REQUEST", "Isi permintaan tidak valid.");
    const repository = new PrivateOpportunityHypothesisRepository();
    if (user.userType === "UMKM_EXISTING") {
      const { isBusinessAnalysisFresh, loadBusinessAnalysisContext } = await import("@/opportunity/business-analysis-service");
      const source = await repository.findForBusiness(user.id, id);
      if (!source) return fail(404, "NOT_FOUND", "Peluang tidak ditemukan.");
      if (source.hypothesis.growthRoadmap) return Response.json({ data: source.hypothesis.growthRoadmap }, { headers });
      const context = await loadBusinessAnalysisContext({ ...user, userType: "UMKM_EXISTING" });
      if (!isBusinessAnalysisFresh(context, source) || !source.hypothesis.businessAnalysis) return fail(409, "ANALYSIS_CHANGED", "Perbarui analisis bisnis sebelum membuat roadmap.");
      const item = await repository.createGrowthRoadmap(user.id, id, source.hypothesis.businessAnalysis.inputFingerprint);
      if (!item) return fail(404, "NOT_FOUND", "Peluang tidak ditemukan.");
      return Response.json({ data: item.hypothesis.growthRoadmap }, { headers });
    }
    const item = await repository.createStartupRoadmap(user.id, id);
    if (!item) return fail(404, "NOT_FOUND", "Peluang tidak ditemukan.");
    return Response.json({ data: item.hypothesis.startupRoadmap }, { headers });
  } catch (error) {
    if (error instanceof SyntaxError) return fail(400, "INVALID_REQUEST", "Isi permintaan tidak valid.");
    if (error instanceof PrivateHypothesisStateError) return fail(409, "ANALYSIS_REQUIRED", "Tinjau analisis dan simpan peluang sebelum membuat roadmap.");
    return fail(503, "UNAVAILABLE", "Roadmap belum dapat disimpan. Coba kembali.");
  }
}
