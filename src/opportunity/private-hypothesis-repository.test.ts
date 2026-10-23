import { beforeEach, describe, expect, it, vi } from "vitest";

const model = vi.hoisted(() => ({ destroy: vi.fn(), findAll: vi.fn(), findOne: vi.fn(), update: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("../db/sequelize", () => ({ getSequelize: () => ({ transaction: (callback: (transaction: unknown) => unknown) => callback({ LOCK: { UPDATE: "UPDATE" } }) }) }));
vi.mock("../db/models/user-generated-opportunity.model", () => ({
  getUserGeneratedOpportunityModel: () => model,
}));

import { PrivateOpportunityHypothesisRepository } from "./private-hypothesis-repository";
import { entrepreneurAnalysisSchema } from "./entrepreneur-analysis-contract";
import { privateEntrepreneurFixture } from "./test-fixtures/private-entrepreneur";
import { privateBusinessFixture } from "./test-fixtures/private-business";

describe("Existing owner-scoped analysis, pagination and Growth persistence", () => {
  beforeEach(() => vi.resetAllMocks());
  function businessRow() {
    const item = privateBusinessFixture();
    const row = { id: item.id, userType: "UMKM_EXISTING", userId: "owner", hypothesis: item.hypothesis, sourceReference: item.source, model: item.model, generatedAt: new Date(item.generatedAt), isSaved: true, update: vi.fn() };
    row.update.mockImplementation(async patch => Object.assign(row, patch));
    return row;
  }
  it("scopes business detail and archive lookahead by owner and persona beyond fifty rows", async () => {
    model.findOne.mockResolvedValue(null); model.findAll.mockResolvedValue(Array.from({ length: 13 }, businessRow));
    const repo = new PrivateOpportunityHypothesisRepository();
    expect(await repo.findForBusiness("owner", "id")).toBeNull();
    expect(model.findOne).toHaveBeenCalledWith({ where: { id: "id", userId: "owner", userType: "UMKM_EXISTING" } });
    const result = await repo.listBusinessPage("owner", 6, true);
    expect(result.items).toHaveLength(12); expect(result.hasMore).toBe(true);
    expect(model.findAll).toHaveBeenCalledWith({ where: { userId: "owner", userType: "UMKM_EXISTING", isSaved: true }, order: [["createdAt", "DESC"], ["id", "ASC"]], offset: 60, limit: 13 });
  });
  it("locks and creates one Growth snapshot, preserving analysis", async () => {
    const row = businessRow(); model.findOne.mockResolvedValue(row);
    const repo = new PrivateOpportunityHypothesisRepository(), before = JSON.stringify(row.hypothesis.businessAnalysis);
    const first = await repo.createGrowthRoadmap("owner", row.id, "b".repeat(64));
    const second = await repo.createGrowthRoadmap("owner", row.id, "b".repeat(64));
    expect(first?.hypothesis.growthRoadmap).toEqual(second?.hypothesis.growthRoadmap); expect(row.update).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(row.hypothesis.businessAnalysis)).toBe(before);
    expect(model.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: row.id, userId: "owner", userType: "UMKM_EXISTING" }, lock: "UPDATE" }));
  });
  it("rejects stale analysis fingerprints and does not overwrite concurrent results", async () => {
    const row = businessRow(); model.findOne.mockResolvedValue(row); const repo = new PrivateOpportunityHypothesisRepository();
    await expect(repo.createGrowthRoadmap("owner", row.id, "a".repeat(64))).rejects.toMatchObject({ code: "ANALYSIS_CHANGED" });
    expect(await repo.saveBusinessAnalysis("owner", row.id, row.hypothesis.businessAnalysis, "a".repeat(64))).toBe(false);
    expect(row.update).not.toHaveBeenCalled();
  });
  it("keeps the base readable if optional business snapshots are malformed", async () => {
    const row = businessRow(); model.findAll.mockResolvedValue([{ ...row, hypothesis: { ...row.hypothesis, businessAnalysis: { version: "unknown" }, growthRoadmap: { version: "unknown" } } }]);
    const result = await new PrivateOpportunityHypothesisRepository().listBusinessPage("owner");
    expect(result.items).toHaveLength(1); expect(result.items[0]?.hypothesis.businessAnalysis).toBeUndefined();
  });
});

describe("private roadmap persistence and paged archives", () => {
  beforeEach(() => vi.resetAllMocks());
  function rowFixture() {
    const item = privateEntrepreneurFixture();
    const update = vi.fn();
    const row = { id: item.id, userId: "owner", userType: "ENTREPRENEUR", hypothesis: item.hypothesis, sourceReference: item.source, model: item.model, generatedAt: new Date(item.generatedAt), isSaved: true, update };
    update.mockImplementation(async (patch: Partial<typeof row>) => Object.assign(row, patch));
    return row;
  }
  it("creates once under an owner/persona row lock and preserves the archived analysis", async () => {
    const row = rowFixture();
    const originalAnalysis = JSON.stringify(row.hypothesis.analysis);
    model.findOne.mockResolvedValue(row);
    const repository = new PrivateOpportunityHypothesisRepository();
    const first = await repository.createStartupRoadmap("owner", row.id);
    const second = await repository.createStartupRoadmap("owner", row.id);
    expect(first?.hypothesis.startupRoadmap).toEqual(second?.hypothesis.startupRoadmap);
    expect(row.update).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(row.hypothesis.analysis)).toBe(originalAnalysis);
    expect(model.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: row.id, userId: "owner", userType: "ENTREPRENEUR" }, lock: "UPDATE" }));
  });
  it("rejects unsaved hypotheses and does not create for an absent owner-scoped row", async () => {
    const row = rowFixture(); row.isSaved = false;
    model.findOne.mockResolvedValueOnce(row).mockResolvedValueOnce(null);
    const repository = new PrivateOpportunityHypothesisRepository();
    await expect(repository.createStartupRoadmap("owner", row.id)).rejects.toMatchObject({ code: "ANALYSIS_REQUIRED" });
    expect(await repository.createStartupRoadmap("other-owner", row.id)).toBeNull();
    expect(row.update).not.toHaveBeenCalled();
  });
  it("keeps valid archived analysis readable if optional roadmap metadata is invalid", async () => {
    const row = rowFixture();
    model.findAll.mockResolvedValue([{ ...row, hypothesis: { ...row.hypothesis, startupRoadmap: { version: "unknown" } } }]);
    const items = await new PrivateOpportunityHypothesisRepository().listForUser("owner", true);
    expect(items[0]?.hypothesis.analysis).toEqual(row.hypothesis.analysis);
    expect(items[0]?.hypothesis.startupRoadmap).toBeUndefined();
  });
  it("can reach records beyond fifty with bounded lookahead and stable ordering", async () => {
    model.findAll.mockResolvedValue(Array.from({ length: 13 }, () => rowFixture()));
    const result = await new PrivateOpportunityHypothesisRepository().listPageForUser("owner", 6, true, true);
    expect(result.items).toHaveLength(12);
    expect(result.hasMore).toBe(true);
    expect(model.findAll).toHaveBeenCalledWith({ where: { userId: "owner", isSaved: true, userType: "ENTREPRENEUR", "hypothesis.startupRoadmap.version": "private-startup-v1" }, order: [["createdAt", "DESC"], ["id", "ASC"]], offset: 60, limit: 13 });
  });
});

function analysisFixture() {
  const score = { score: 65, coverage: 100, status: "PRELIMINARY", factors: [{ key: "sample", label: "Test", value: 65, weight: 1, basis: "MARKET", reason: "Test evidence" }] };
  return entrepreneurAnalysisSchema.parse({ version: "entrepreneur-decision-v2", generatedAt: "2026-10-21T01:00:00.000Z", inputFingerprint: "a".repeat(64), model: null, capitalMin: 500000,
    requirements: { categoryId: null, customerSegmentIds: [], salesChannelIds: [], requiredExperience: "BEGINNER", requiredTime: "PART_TIME", complexity: "SIMPLE", summary: "Trial", rationale: "Trial", initialNeeds: ["Materials"], assumptions: ["Unknown response"] },
    opportunity: score, fit: score, targetConsumer: "Families", competition: "Unknown", risks: ["Trial needed"], trend: null, competitors: null, warnings: [] });
}

describe("PrivateOpportunityHypothesisRepository.removeForUser", () => {
  beforeEach(() => vi.resetAllMocks());

  it("reads an analysis subject only by owner, ID, and entrepreneur persona", async () => {
    model.findOne.mockResolvedValue(null);
    const repository = new PrivateOpportunityHypothesisRepository();
    expect(await repository.findForEntrepreneur("owner", "hypothesis")).toBeNull();
    expect(model.findOne).toHaveBeenCalledWith({ where: { id: "hypothesis", userId: "owner", userType: "ENTREPRENEUR" } });
  });

  it("deletes only the requested hypothesis belonging to the current user", async () => {
    const repository = new PrivateOpportunityHypothesisRepository();
    const userId = "80000000-0000-4000-8000-000000000011";
    const hypothesisId = "90000000-0000-4000-8000-000000000021";
    const destroy = vi.fn();
    model.findOne.mockResolvedValue({ userType: "ENTREPRENEUR", isSaved: false, destroy });

    await repository.removeForUser(userId, hypothesisId);

    expect(model.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: hypothesisId, userId }, lock: "UPDATE" }));
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("rejects deleting or unsaving an archived entrepreneur opportunity", async () => {
    const destroy = vi.fn(), update = vi.fn();
    model.findOne.mockResolvedValue({ userType: "ENTREPRENEUR", isSaved: true, destroy, update });
    const repository = new PrivateOpportunityHypothesisRepository();
    await expect(repository.removeForUser("owner", "idea")).rejects.toMatchObject({ code: "SAVED_PERMANENT" });
    await expect(repository.setSaved("owner", "idea", false)).rejects.toMatchObject({ code: "SAVED_PERMANENT" });
    expect(destroy).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled();
  });

  it("requires a valid analysis before archiving and keeps owner scope", async () => {
    const update = vi.fn();
    model.findOne.mockResolvedValue({ userType: "ENTREPRENEUR", isSaved: false, hypothesis: {}, update });
    const repository = new PrivateOpportunityHypothesisRepository();
    await expect(repository.setSaved("owner", "idea", true)).rejects.toMatchObject({ code: "ANALYSIS_REQUIRED" });
    expect(model.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "idea", userId: "owner" }, lock: "UPDATE" }));
    expect(update).not.toHaveBeenCalled();
  });

  it("keeps an archived analysis immutable", async () => {
    model.findOne.mockResolvedValue({ userType: "ENTREPRENEUR", isSaved: true });
    const repository = new PrivateOpportunityHypothesisRepository();
    await expect(repository.saveEntrepreneurAnalysis("owner", "idea", analysisFixture())).rejects.toMatchObject({ code: "SAVED_PERMANENT" });
    expect(model.update).not.toHaveBeenCalled();
  });

  it("rejects a different reviewed snapshot and a missing score", async () => {
    const update = vi.fn(), analysis = analysisFixture();
    model.findOne.mockResolvedValue({ userType: "ENTREPRENEUR", isSaved: false, hypothesis: { analysis }, update });
    const repository = new PrivateOpportunityHypothesisRepository();
    await expect(repository.setSaved("owner", "idea", true, new Date(), "b".repeat(64))).rejects.toMatchObject({ code: "ANALYSIS_CHANGED" });
    analysis.fit.score = null;
    await expect(repository.setSaved("owner", "idea", true, new Date(), analysis.inputFingerprint)).rejects.toMatchObject({ code: "ANALYSIS_REQUIRED" });
    expect(update).not.toHaveBeenCalled();
  });

  it("saves the reviewed analysis under a row lock", async () => {
    const update = vi.fn(), analysis = analysisFixture();
    model.findOne.mockResolvedValue({ userType: "ENTREPRENEUR", isSaved: false, hypothesis: { analysis }, update });
    const now = new Date();
    await new PrivateOpportunityHypothesisRepository().setSaved("owner", "idea", true, now, analysis.inputFingerprint);
    expect(update).toHaveBeenCalledWith({ isSaved: true, savedAt: now, updatedAt: now }, expect.objectContaining({ transaction: expect.anything() }));
  });

  it("keeps provider model provenance on historical hypotheses", async () => {
    const repository = new PrivateOpportunityHypothesisRepository();
    const previousModel = "ninerouter/previous-model";
    model.findAll.mockResolvedValue([{
      id: "90000000-0000-4000-8000-000000000021",
      hypothesis: {
        title: "Uji menu kopi",
        concept: "Uji satu konsep minuman kopi dengan pelanggan sekitar sebelum menentukan langkah usaha.",
        targetCustomer: "Pelanggan sekitar yang tertarik pada kopi.",
        validationSteps: ["Tanyakan minat kepada pelanggan.", "Catat tanggapan setelah uji coba."],
        assumptions: ["Sebagian pelanggan mungkin tertarik."],
      },
      sourceReference: {
        snapshotId: "80000000-0000-4000-8000-000000000031",
        signalId: "80000000-0000-4000-8000-000000000032",
        title: "Kopi kenangan",
        publisher: "Google Trends",
        transport: "Bright Data SERP API",
        url: "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1",
        retrievedAt: "2026-10-18T04:00:00.000Z",
        classification: "LIKELY_FNB",
      },
      provider: "ninerouter",
      model: previousModel,
      generatedAt: new Date("2026-10-18T04:00:00.000Z"),
      isSaved: true,
    }]);

    const results = await repository.listForUser("80000000-0000-4000-8000-000000000011");

    expect(results).toHaveLength(1);
    expect(results[0]?.model).toBe(previousModel);
  });
});
