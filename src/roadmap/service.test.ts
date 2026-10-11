import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../auth/current-user", () => ({ getCurrentUser: vi.fn() }));

import { ONBOARDING_STATUSES, USER_TYPES, parseUserId, type SafeUser } from "../auth/user-types";
import type { RoadmapAnalysisContext, RoadmapDetail, RoadmapOpportunityContext, RoadmapProfileContext } from "./domain";
import {
  RoadmapAnalysisNotFoundError,
  RoadmapForbiddenError,
  RoadmapOpportunityNotFoundError,
  RoadmapProfileIncompleteError,
  RoadmapUnauthenticatedError,
  RoadmapUserIncompleteError,
  StartupRoadmapService,
  type RoadmapTransactionRunner,
} from "./service";
import type { RoadmapRepositoryPort } from "./repository";
import type { Transaction } from "sequelize";

const userId = parseUserId("10000000-0000-4000-8000-000000000001");
const opportunityId = "60000000-0000-4000-8000-000000000001";
const transaction = {} as Transaction;
const profile: RoadmapProfileContext = {
  profileVersion: 1,
  locationText: "Bandung",
  countryCode: "ID",
  budgetMin: 1_000_000,
  budgetMax: 5_000_000,
  experienceLevel: "BEGINNER",
  timeCommitment: "PART_TIME",
  preferredProductType: null,
  businessObjective: null,
  interests: ["Minuman"],
  customerSegments: ["Pekerja kantor"],
  salesChannels: ["Penjualan langsung online"],
};
const opportunity: RoadmapOpportunityContext = {
  id: opportunityId,
  name: "Menu minuman",
  description: "Deskripsi tervalidasi dari katalog.",
  categoryName: "Minuman",
  opportunityType: "NEW_PRODUCT",
  targetConsumerSummary: null,
  competitionLevel: null,
  competitionSummary: null,
  trend: { id: "70000000-0000-4000-8000-000000000001", title: "Trend", signalSummary: "Ringkasan", signalDescription: "Deskripsi", lifecycleState: "PUBLISHED", affectedUserTypes: ["ENTREPRENEUR"] },
  evidence: [],
};
const detail: RoadmapDetail = {
  id: "50000000-0000-4000-8000-000000000001",
  roadmapType: "STARTUP",
  createdAt: "2026-10-11T00:00:00.000Z",
  opportunity: { id: opportunityId, name: opportunity.name },
  generationContext: {
    version: "startup-validation-v1",
    method: "MVP_STRUCTURED_VALIDATION",
    contextMode: "LIMITED_CONTEXT",
    profileVersion: 1,
    profileInputs: { location: "Bandung", budgetRange: { min: 1_000_000, max: 5_000_000, currency: "IDR" }, experienceLevel: "BEGINNER", timeCommitment: "PART_TIME", interests: ["Minuman"], customerSegments: ["Pekerja kantor"], salesChannels: ["Penjualan langsung online"], preferredProductType: null, businessObjective: null },
    opportunity: { id: opportunityId, name: "Menu minuman", category: "Minuman", trendId: opportunity.trend.id, trendTitle: "Trend", trendSummary: "Ringkasan" },
    evidence: [],
    availableSignals: { opportunityScore: null, fitScore: null, riskLevel: null },
    unavailableInputs: ["Opportunity Score", "Fit Score", "Risk"],
    assumptions: ["roadmap uses stored context"],
    limitations: ["not a prediction"],
  },
  steps: [],
};

const entrepreneur: SafeUser = { id: userId, email: "owner@example.test", userType: USER_TYPES.ENTREPRENEUR, onboardingStatus: ONBOARDING_STATUSES.COMPLETED };

function makeRepository(overrides: Partial<RoadmapRepositoryPort> = {}) {
  return {
    loadProfileContext: vi.fn(async () => profile),
    loadOpportunityContext: vi.fn(async () => opportunity),
    findAnalysis: vi.fn(async (_userId: typeof userId, _opportunityId: string, _analysisId: string | undefined): Promise<RoadmapAnalysisContext | null> => null),
    createWithSteps: vi.fn(async () => detail),
    listForUser: vi.fn(async (ownerId, filter) => ({ items: [], page: filter.page, pageSize: filter.pageSize, totalCount: 0, totalPages: 1 })),
    findForUser: vi.fn(async () => null),
    ...overrides,
  } satisfies RoadmapRepositoryPort;
}

describe("StartupRoadmapService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates and persists one limited-context plan transactionally", async () => {
    const repository = makeRepository();
    let transactionRunCount = 0;
    const runner: RoadmapTransactionRunner = async <T>(callback: (tx: Transaction) => Promise<T>) => {
      transactionRunCount += 1;
      return callback(transaction);
    };
    const service = new StartupRoadmapService({ currentUserResolver: async () => entrepreneur, repository, transactionRunner: runner });

    await expect(service.generate({ opportunityId })).resolves.toEqual(detail);
    expect(transactionRunCount).toBe(1);
    expect(repository.loadProfileContext).toHaveBeenCalledWith(userId, transaction);
    expect(repository.loadOpportunityContext).toHaveBeenCalledWith(opportunityId, USER_TYPES.ENTREPRENEUR, transaction);
    expect(repository.createWithSteps).toHaveBeenCalledWith(expect.objectContaining({ userId, opportunityId, analysisId: null }), transaction);
    const createCall = vi.mocked(repository.createWithSteps).mock.calls[0];
    expect(createCall?.[0].steps).toHaveLength(6);
  });

  it("blocks UMKM and unauthenticated callers before repository or transaction work", async () => {
    const repository = makeRepository();
    let transactionRunCount = 0;
    const runner: RoadmapTransactionRunner = async <T>(callback: (tx: Transaction) => Promise<T>) => {
      transactionRunCount += 1;
      return callback(transaction);
    };
    const umkm = { ...entrepreneur, userType: USER_TYPES.UMKM_EXISTING };
    await expect(new StartupRoadmapService({ currentUserResolver: async () => umkm, repository, transactionRunner: runner }).generate({ opportunityId })).rejects.toBeInstanceOf(RoadmapForbiddenError);
    await expect(new StartupRoadmapService({ currentUserResolver: async () => null, repository, transactionRunner: runner }).generate({ opportunityId })).rejects.toBeInstanceOf(RoadmapUnauthenticatedError);
    expect(transactionRunCount).toBe(0);
    expect(repository.loadProfileContext).not.toHaveBeenCalled();
  });

  it("rejects an authenticated account before onboarding completion", async () => {
    const repository = makeRepository();
    const incomplete = { ...entrepreneur, onboardingStatus: "PROFILE_IN_PROGRESS" as const };
    await expect(new StartupRoadmapService({ currentUserResolver: async () => incomplete, repository }).generate({ opportunityId })).rejects.toBeInstanceOf(RoadmapUserIncompleteError);
    expect(repository.loadProfileContext).not.toHaveBeenCalled();
  });

  it("rejects incomplete profile and ineligible Opportunity without persisting", async () => {
    const incomplete = makeRepository({ loadProfileContext: vi.fn(async () => ({ ...profile, customerSegments: [] })) });
    await expect(new StartupRoadmapService({ currentUserResolver: async () => entrepreneur, repository: incomplete, transactionRunner: async <T>(callback: (tx: Transaction) => Promise<T>) => callback(transaction) }).generate({ opportunityId })).rejects.toBeInstanceOf(RoadmapProfileIncompleteError);
    expect(incomplete.createWithSteps).not.toHaveBeenCalled();

    const ineligible = makeRepository({ loadOpportunityContext: vi.fn(async () => null) });
    await expect(new StartupRoadmapService({ currentUserResolver: async () => entrepreneur, repository: ineligible, transactionRunner: async <T>(callback: (tx: Transaction) => Promise<T>) => callback(transaction) }).generate({ opportunityId })).rejects.toBeInstanceOf(RoadmapOpportunityNotFoundError);
    expect(ineligible.createWithSteps).not.toHaveBeenCalled();
  });

  it("requires a supplied analysis to belong to the current user and Opportunity", async () => {
    const repository = makeRepository();
    await expect(new StartupRoadmapService({ currentUserResolver: async () => entrepreneur, repository, transactionRunner: async <T>(callback: (tx: Transaction) => Promise<T>) => callback(transaction) }).generate({ opportunityId, analysisId: "90000000-0000-4000-8000-000000000009" })).rejects.toBeInstanceOf(RoadmapAnalysisNotFoundError);
    expect(repository.findAnalysis).toHaveBeenCalledWith(userId, opportunityId, "90000000-0000-4000-8000-000000000009", transaction);
    expect(repository.createWithSteps).not.toHaveBeenCalled();
  });

  it("scopes list and detail retrieval to the authenticated owner", async () => {
    const repository = makeRepository();
    const service = new StartupRoadmapService({ currentUserResolver: async () => entrepreneur, repository });
    await service.listForCurrentUser({ page: 1, pageSize: 10, type: "STARTUP" });
    await service.getForCurrentUser(detail.id);
    expect(repository.listForUser).toHaveBeenCalledWith(userId, { page: 1, pageSize: 10, type: "STARTUP" });
    expect(repository.findForUser).toHaveBeenCalledWith(userId, detail.id);
  });

  it("propagates persistence failure so the transaction runner can roll back the header and steps", async () => {
    let rolledBack = false;
    const repository = makeRepository({ createWithSteps: vi.fn(async () => { throw new Error("synthetic persistence failure"); }) });
    const runner: RoadmapTransactionRunner = async <T>(callback: (tx: Transaction) => Promise<T>) => {
      try { return await callback(transaction); } catch (error) { rolledBack = true; throw error; }
    };
    await expect(new StartupRoadmapService({ currentUserResolver: async () => entrepreneur, repository, transactionRunner: runner }).generate({ opportunityId })).rejects.toThrow("synthetic persistence failure");
    expect(rolledBack).toBe(true);
  });
});
