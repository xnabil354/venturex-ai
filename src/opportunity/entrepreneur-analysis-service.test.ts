import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { EntrepreneurAnalysisService, entrepreneurAnalysisFingerprint, isEntrepreneurAnalysisFresh, type loadEntrepreneurAnalysisContext } from "./entrepreneur-analysis-service";
import { parseUserId, type SafeUser } from "../auth/user-types";
import type { generateNineRouterJson } from "../ai-analysis/ninerouter";
import type { PrivateOpportunityIdeaDto } from "./private-hypothesis";
import type { EntrepreneurRequirements } from "./entrepreneur-analysis-contract";

const category = "11111111-1111-4111-8111-111111111111", segment = "22222222-2222-4222-8222-222222222222", channel = "33333333-3333-4333-8333-333333333333";
let sequence = 0;
function fixture() {
  const user: SafeUser = { id: parseUserId(`90000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`), email: "test@example.invalid", userType: "ENTREPRENEUR", onboardingStatus: "COMPLETED" };
  const context: Awaited<ReturnType<typeof loadEntrepreneurAnalysisContext>> = {
    profile: { persona: "ENTREPRENEUR", preferredProductType: "Bakso ayam", categories: ["Makanan"], customerSegments: ["Keluarga"], salesChannels: ["Gerai"], budget: { min: 500000, max: 1000000, currency: "IDR" }, location: { text: "Jakarta", city: "Jakarta", province: "DKI Jakarta" }, experienceLevel: "BEGINNER", timeCommitment: "PART_TIME", businessObjective: "Menguji konsep", notes: "catatan privat tidak boleh disimpan di snapshot" },
    selections: { categoryIds: [category], segmentIds: [segment], channelIds: [channel] },
    options: { categories: [{ id: category, name: "Makanan" }], segments: [{ id: segment, name: "Keluarga" }], channels: [{ id: channel, name: "Gerai" }] },
  };
  const item: PrivateOpportunityIdeaDto = { id: "80000000-0000-4000-8000-000000000001", provider: "ninerouter", model: "cx/gpt-6-luna-xhigh", generatedAt: "2026-10-21T00:00:00.000Z", saved: false,
    hypothesis: { title: "Uji bakso untuk keluarga", concept: "Uji konsep bakso ayam untuk keluarga sebelum menjalankan usaha secara penuh.", targetCustomer: "Keluarga sekitar lokasi yang dituju.", validationSteps: ["Siapkan sampel dan catat tanggapan.", "Evaluasi proses sebelum mulai menjual."], assumptions: ["Penerimaan calon pembeli masih perlu diuji."] },
    source: { snapshotId: "70000000-0000-4000-8000-000000000001", signalId: "70000000-0000-4000-8000-000000000002", title: "Bakso", publisher: "Google Trends", transport: "Bright Data SERP API", url: "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1", retrievedAt: "2026-10-21T00:00:00.000Z", classification: "LIKELY_FNB" },
  };
  const requirements: EntrepreneurRequirements = { categoryId: category, customerSegmentIds: [segment], salesChannelIds: [channel], requiredExperience: "BEGINNER", requiredTime: "PART_TIME", complexity: "SIMPLE", summary: "Uji konsep bakso ayam untuk keluarga.", rationale: "Target dan kanal dapat diuji pada skala kecil.", initialNeeds: ["Siapkan bahan serta perlengkapan uji."], assumptions: ["Calon pembeli perlu mencoba konsep terlebih dahulu."] };
  const repository = { findForEntrepreneur: vi.fn().mockResolvedValue(item), saveEntrepreneurAnalysis: vi.fn().mockResolvedValue(true) };
  const contextLoader = vi.fn().mockResolvedValue(context);
  const market = { interestOverTime: vi.fn().mockResolvedValue({ query: "Bakso ayam", points: Array.from({ length: 53 }, (_, index) => ({ timestamp: 1700000000 + index * 7 * 86400, label: String(index), interestIndex: 60 })), averageInterest: 60, omittedInvalidPoints: 0, retrievedAt: "2026-10-21T01:00:00.000Z", time: "today 12-m", cacheStatus: "NETWORK" }), localCompetitors: vi.fn().mockResolvedValue({ query: "Bakso ayam Jakarta", city: "Jakarta", retrievedAt: "2026-10-21T01:00:00.000Z", sampleCount: 1, places: [{ name: "Bakso A", address: "Jakarta", url: "https://www.google.com/maps/search/?api=1&query=Bakso" }] }) };
  const generate = vi.fn().mockResolvedValue(requirements);
  const env = { AI_PROVIDER: "ninerouter", AUTH_SECRET: "a".repeat(40), NODE_ENV: "test", NINEROUTER_BASE_URL: "https://router.example/v1", NINEROUTER_API_KEY: "unit-test-key", NINEROUTER_MODEL: "cx/gpt-6-luna-xhigh", AI_ANALYSIS_TRENDS_USER_INFERENCE_ENABLED: "true", NINEROUTER_SEARCHAPI_PROCESSING_CONFIRMED: "true" };
  const now = () => new Date("2026-10-21T01:00:00.000Z");
  const service = new EntrepreneurAnalysisService({ repository, contextLoader, market, generate: generate as unknown as typeof generateNineRouterJson, env, now });
  return { user, context, item, requirements, repository, contextLoader, market, generate, env, now, service };
}

describe("entrepreneur second-stage analysis", () => {
  it("returns an archived snapshot without calling profile or providers", async () => {
    const f = fixture();
    const result = await f.service.analyze(f.user, f.item.id, { consent: true, capitalMin: 500000 });
    f.item.hypothesis.analysis = result; f.item.saved = true;
    f.contextLoader.mockClear(); f.generate.mockClear(); f.market.interestOverTime.mockClear();
    const archived = await f.service.analyze(f.user, f.item.id, { consent: true, refresh: true, capitalMin: 900000 });
    expect(archived).toEqual(result);
    expect(f.contextLoader).not.toHaveBeenCalled(); expect(f.generate).not.toHaveBeenCalled(); expect(f.market.interestOverTime).not.toHaveBeenCalled();
  });
  it("rejects missing session and wrong persona before reading a hypothesis", async () => {
    const f = fixture();
    await expect(f.service.analyze(null, f.item.id, { consent: true })).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(f.service.analyze({ ...f.user, userType: "UMKM_EXISTING" }, f.item.id, { consent: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(f.repository.findForEntrepreneur).not.toHaveBeenCalled();
  });
  it("checks owner-scoped existence before loading profiles or providers", async () => {
    const f = fixture(); f.repository.findForEntrepreneur.mockResolvedValue(null);
    await expect(f.service.analyze(f.user, f.item.id, { consent: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(f.repository.findForEntrepreneur).toHaveBeenCalledWith(f.user.id, f.item.id);
    expect(f.contextLoader).not.toHaveBeenCalled(); expect(f.generate).not.toHaveBeenCalled();
  });
  it("rejects unconsented and malformed financial input", async () => {
    const f = fixture();
    await expect(f.service.analyze(f.user, f.item.id, { consent: false })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(f.service.analyze(f.user, f.item.id, { consent: true, capitalMin: -1 })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(f.generate).not.toHaveBeenCalled();
  });
  it("persists deterministic scores, provenance, and a fingerprint without raw profile notes", async () => {
    const f = fixture(); const result = await f.service.analyze(f.user, f.item.id, { consent: true, capitalMin: 500000 });
    expect(result.opportunity.score).not.toBeNull(); expect(result.fit.score).toBe(100);
    expect(result.inputFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(result)).not.toContain(f.context.profile.notes!);
    expect(f.repository.saveEntrepreneurAnalysis).toHaveBeenCalledWith(f.user.id, f.item.id, result);
    expect(f.generate).toHaveBeenCalledOnce();
    expect(f.market.localCompetitors).toHaveBeenCalledWith(f.context.profile.preferredProductType, f.context.profile.location?.city, f.context.profile.location?.province);
    f.item.hypothesis.analysis = result;
    expect(isEntrepreneurAnalysisFresh(f.context, f.item, f.env.AUTH_SECRET, f.now())).toBe(true);
    const cached = await f.service.analyze(f.user, f.item.id, { consent: true });
    expect(cached).toEqual(result); expect(f.generate).toHaveBeenCalledOnce();
  });
  it("keeps a useful profile analysis when both market datasets fail", async () => {
    const f = fixture(); f.market.interestOverTime.mockRejectedValue(new Error("timeout")); f.market.localCompetitors.mockRejectedValue(new Error("quota"));
    const result = await f.service.analyze(f.user, f.item.id, { consent: true });
    expect(result.fit.score).toBe(100); expect(result.fit.coverage).toBe(70); expect(result.opportunity.score).toBeNull();
    expect(result.warnings.length).toBeGreaterThanOrEqual(2); expect(f.repository.saveEntrepreneurAnalysis).toHaveBeenCalledOnce();
  });
  it("keeps observed evidence and does not invent requirements after an AI failure", async () => {
    const f = fixture(); f.generate.mockRejectedValue(new Error("invalid response"));
    const result = await f.service.analyze(f.user, f.item.id, { consent: true });
    expect(result.requirements).toBeNull(); expect(result.fit.score).toBeNull(); expect(result.trend?.count).toBe(53);
    expect(result.warnings.some(text => text.includes("Interpretasi AI"))).toBe(true);
  });
  it("does not ground a score in foreign catalog IDs or unsupported numerical narrative", async () => {
    const f = fixture(); f.generate.mockResolvedValue({ ...f.requirements, categoryId: "44444444-4444-4444-8444-444444444444", customerSegmentIds: [], salesChannelIds: [] });
    const result = await f.service.analyze(f.user, f.item.id, { consent: true });
    expect(result.requirements?.categoryId).toBeNull(); expect(result.fit.score).toBeNull();
    const g = fixture(); g.generate.mockResolvedValue({ ...g.requirements, summary: "Diperkirakan terjual 100 produk." });
    expect((await g.service.analyze(g.user, g.item.id, { consent: true })).requirements).toBeNull();
  });
  it("invalidates the context fingerprint when experience, time, or requirements change", () => {
    const f = fixture(); const original = entrepreneurAnalysisFingerprint(f.context, f.item, null, f.env.AUTH_SECRET);
    expect(entrepreneurAnalysisFingerprint({ ...f.context, profile: { ...f.context.profile, timeCommitment: "FULL_TIME" } }, f.item, null, f.env.AUTH_SECRET)).not.toBe(original);
    expect(entrepreneurAnalysisFingerprint(f.context, f.item, 500000, f.env.AUTH_SECRET)).not.toBe(original);
  });
  it("coalesces duplicate active requests without duplicating providers or persistence", async () => {
    const f = fixture();
    let release: (value: EntrepreneurRequirements) => void = () => {};
    f.generate.mockImplementation(() => new Promise<EntrepreneurRequirements>(resolve => { release = resolve; }));
    const first = f.service.analyze(f.user, f.item.id, { consent: true });
    await vi.waitFor(() => expect(f.generate).toHaveBeenCalledOnce());
    const second = f.service.analyze(f.user, f.item.id, { consent: true });
    await vi.waitFor(() => expect(f.contextLoader).toHaveBeenCalledTimes(2));
    release(f.requirements);
    const [a, b] = await Promise.all([first, second]);
    expect(a).toEqual(b); expect(f.generate).toHaveBeenCalledOnce(); expect(f.market.interestOverTime).toHaveBeenCalledOnce(); expect(f.repository.saveEntrepreneurAnalysis).toHaveBeenCalledOnce();
  });
});
