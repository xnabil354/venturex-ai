import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { BusinessAnalysisService, businessAnalysisFingerprint, isBusinessAnalysisFresh, type loadBusinessAnalysisContext } from "./business-analysis-service";
import { privateBusinessFixture, businessRequirements, businessSelections, businessCategoryId, businessSegmentId, businessChannelId } from "./test-fixtures/private-business";
import { parseUserId, type SafeUser } from "../auth/user-types";
import type { generateNineRouterJson } from "../ai-analysis/ninerouter";
let sequence = 0;
function fixture() {
  const user: SafeUser = { id: parseUserId(`90000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`), email: "test@example.invalid", userType: "UMKM_EXISTING", onboardingStatus: "COMPLETED" };
  const item = privateBusinessFixture();
  const context: Awaited<ReturnType<typeof loadBusinessAnalysisContext>> = { profile: { persona: "UMKM_EXISTING", businessName: "Kedai sintetis", businessCategory: "Makanan", businessDescription: null, location: { text: "Jakarta", city: "Jakarta", province: "DKI Jakarta" }, averagePrice: { ...businessSelections.averagePrice, currency: "IDR" }, products: [{ name: "Bakso", category: "Makanan", price: null }], customerSegments: ["Keluarga"], salesChannels: ["Gerai"], notes: "Catatan privat" }, selections: businessSelections, options: { categories: [{ id: businessCategoryId, name: "Makanan" }], segments: [{ id: businessSegmentId, name: "Keluarga" }], channels: [{ id: businessChannelId, name: "Gerai" }] } };
  const repository = { findForBusiness: vi.fn().mockResolvedValue(item), saveBusinessAnalysis: vi.fn().mockResolvedValue(true) };
  const contextLoader = vi.fn().mockResolvedValue(context);
  const market = { interestOverTime: vi.fn().mockRejectedValue(new Error("offline")), localCompetitors: vi.fn().mockRejectedValue(new Error("offline")) };
  const generate = vi.fn().mockImplementation(async (input: Parameters<typeof generateNineRouterJson>[0]) => {
    if (input.system.includes("CONCEPT_ALIGNMENT_REVIEW")) {
      const data = JSON.parse(input.prompt);
      return { selectedTitle: data.selectedHypothesis.title, analysisSummary: data.proposedAnalysis.summary, verdict: "ALIGNED", reason: "Konsep terpilih tetap dipertahankan." };
    }
    return businessRequirements;
  });
  const env = { AI_PROVIDER: "ninerouter", AUTH_SECRET: "a".repeat(40), NODE_ENV: "test", NINEROUTER_BASE_URL: "https://router.example/v1", NINEROUTER_API_KEY: "test-key", NINEROUTER_MODEL: "cx/gpt-6-luna-xhigh", AI_ANALYSIS_TRENDS_USER_INFERENCE_ENABLED: "true", NINEROUTER_SEARCHAPI_PROCESSING_CONFIRMED: "true" };
  const now = () => new Date("2026-10-22T01:00:00.000Z");
  const service = new BusinessAnalysisService({ repository, contextLoader, market, generate: generate as unknown as typeof generateNineRouterJson, env, now });
  return { user, item, context, repository, market, generate, env, now, service, contextLoader };
}
describe("Existing private analysis", () => {
  it.each(["CONCEPT_DRIFT", "UNCERTAIN", "WRONG_BINDING", "OFFLINE"])("does not persist unverified requirements: %s", async verdict => {
    const f = fixture();
    f.generate.mockImplementation(async input => {
      if (!input.system.includes("CONCEPT_ALIGNMENT_REVIEW")) return { ...businessRequirements, summary: "Uji lauk tempe dan tahu, bukan ayam." };
      if (verdict === "OFFLINE") throw new Error("offline");
      const data = JSON.parse(input.prompt);
      return { selectedTitle: verdict === "WRONG_BINDING" ? "Konsep lain" : data.selectedHypothesis.title, analysisSummary: data.proposedAnalysis.summary, verdict: verdict === "WRONG_BINDING" ? "ALIGNED" : verdict, reason: "Bahan inti berubah." };
    });
    await expect(f.service.analyze(f.user, f.item.id, { consent: true, refresh: true })).rejects.toMatchObject({ code: "UNAVAILABLE" });
    expect(f.generate).toHaveBeenCalledTimes(verdict === "CONCEPT_DRIFT" ? 4 : 2);
    expect(f.repository.saveBusinessAnalysis).not.toHaveBeenCalled();
  });
  it("retries only classified concept drift once, then scores only the reviewed correction", async () => {
    const f = fixture(); let drafts = 0;
    f.generate.mockImplementation(async input => {
      if (!input.system.includes("CONCEPT_ALIGNMENT_REVIEW")) {
        drafts++;
        return drafts === 1 ? { ...businessRequirements, summary: "Uji tempe sebagai pengganti produk terpilih." } : businessRequirements;
      }
      const data = JSON.parse(input.prompt);
      return { selectedTitle: data.selectedHypothesis.title, analysisSummary: data.proposedAnalysis.summary, verdict: drafts === 1 ? "CONCEPT_DRIFT" : "ALIGNED", reason: "Periksa bahan inti." };
    });
    const result = await f.service.analyze(f.user, f.item.id, { consent: true });
    expect(f.generate).toHaveBeenCalledTimes(4);
    expect(result.requirements).toEqual(businessRequirements);
    expect(result.conceptAlignmentVersion).toBe("business-concept-alignment-v1");
    expect(f.repository.saveBusinessAnalysis).toHaveBeenCalledTimes(1);
    expect(JSON.parse(f.generate.mock.calls[2]![0].prompt).correction).toBeTruthy();
  });
  it("does not treat a legacy snapshot as verified or reusable", () => {
    const f = fixture(); delete f.item.hypothesis.businessAnalysis.conceptAlignmentVersion;
    f.item.hypothesis.businessAnalysis.inputFingerprint = businessAnalysisFingerprint(f.context, f.item, f.item.hypothesis.businessAnalysis.proposedPrice, f.env.AUTH_SECRET);
    expect(isBusinessAnalysisFresh(f.context, f.item, f.env.AUTH_SECRET, f.now())).toBe(false);
  });
  it("allows reviewed target segments outside the profile without forcing a fit", async () => {
    const f = fixture(), other = "44444444-4444-4444-8444-444444444444";
    f.context.options.segments.push({ id: other, name: "Pekerja kantor" });
    f.generate.mockImplementation(async input => {
      if (!input.system.includes("CONCEPT_ALIGNMENT_REVIEW")) return { ...businessRequirements, customerSegmentIds: [other] };
      const data = JSON.parse(input.prompt);
      return { selectedTitle: data.selectedHypothesis.title, analysisSummary: data.proposedAnalysis.summary, verdict: "ALIGNED", reason: "Konsep tetap sama, segmen baru adalah asumsi untuk diuji." };
    });
    const result = await f.service.analyze(f.user, f.item.id, { consent: true });
    expect(result.requirements?.customerSegmentIds).toEqual([other]);
    expect(result.fit.factors.find(v => v.key === "customerFit")?.value).toBe(0);
  });
  it("rejects missing session, wrong persona and absent owner before provider work", async () => {
    const f = fixture();
    await expect(f.service.analyze(null, f.item.id, { consent: true })).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(f.service.analyze({ ...f.user, userType: "ENTREPRENEUR" }, f.item.id, { consent: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    f.repository.findForBusiness.mockResolvedValue(null);
    await expect(f.service.analyze(f.user, f.item.id, { consent: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(f.generate).not.toHaveBeenCalled();
  });
  it("persists a partial business-specific result even if market evidence fails", async () => {
    const f = fixture();
    const result = await f.service.analyze(f.user, f.item.id, { consent: true, proposedPrice: null });
    expect(result.version).toBe("business-decision-v1"); expect(result.fit.score).toBe(100); expect(result.fit.coverage).toBe(70);
    expect(result.opportunity.score).toBeNull(); expect(result.trend).toBeNull(); expect(result.competitors).toBeNull();
    expect(JSON.stringify(result)).not.toContain("Catatan privat");
    expect(f.repository.saveBusinessAnalysis).toHaveBeenCalledWith(f.user.id, f.item.id, result, "b".repeat(64));
  });
  it("rejects invented reference IDs and financial narrative while retaining unknown data", async () => {
    const f = fixture(); f.generate.mockResolvedValue({ ...businessRequirements, summary: "Penjualan Rp 100000 pasti" });
    const result = await f.service.analyze(f.user, f.item.id, { consent: true });
    expect(result.requirements).toBeNull(); expect(result.fit.score).toBeNull(); expect(result.risk.level).toBe("UNKNOWN");
  });
  it("invalidates snapshot when business context or price changes", () => {
    const f = fixture(), price = f.item.hypothesis.businessAnalysis.proposedPrice;
    const fingerprint = businessAnalysisFingerprint(f.context, f.item, price, f.env.AUTH_SECRET);
    f.item.hypothesis.businessAnalysis.inputFingerprint = fingerprint;
    expect(isBusinessAnalysisFresh(f.context, f.item, f.env.AUTH_SECRET, f.now())).toBe(true);
    expect(businessAnalysisFingerprint({ ...f.context, profile: { ...f.context.profile, notes: "Berubah" } }, f.item, price, f.env.AUTH_SECRET)).not.toBe(fingerprint);
    expect(businessAnalysisFingerprint(f.context, f.item, { min: 1, max: 2 }, f.env.AUTH_SECRET)).not.toBe(fingerprint);
    expect(isBusinessAnalysisFresh(f.context, f.item, f.env.AUTH_SECRET, new Date("2026-10-24"))).toBe(false);
  });
  it("returns a fresh persisted result without a new provider call", async () => {
    const f = fixture(); f.item.hypothesis.businessAnalysis.inputFingerprint = businessAnalysisFingerprint(f.context, f.item, f.item.hypothesis.businessAnalysis.proposedPrice, f.env.AUTH_SECRET, f.env.NINEROUTER_MODEL);
    expect(await f.service.analyze(f.user, f.item.id, { consent: true })).toBe(f.item.hypothesis.businessAnalysis);
    expect(f.generate).not.toHaveBeenCalled(); expect(f.market.interestOverTime).not.toHaveBeenCalled();
  });
  it("does not report success when a concurrent snapshot wins persistence", async () => {
    const f = fixture(); f.repository.saveBusinessAnalysis.mockResolvedValue(false);
    await expect(f.service.analyze(f.user, f.item.id, { consent: true })).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });
  it("does not persist results if the business profile changed during provider work", async () => {
    const f = fixture();
    f.contextLoader.mockResolvedValueOnce(f.context).mockResolvedValueOnce({ ...f.context, profile: { ...f.context.profile, businessName: "Changed business" } });
    await expect(f.service.analyze(f.user, f.item.id, { consent: true })).rejects.toMatchObject({ code: "UNAVAILABLE" });
    expect(f.repository.saveBusinessAnalysis).not.toHaveBeenCalled();
  });
});
