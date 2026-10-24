import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../auth/current-user", () => ({ getCurrentUser: vi.fn() }));

import type { OpportunityAnalysisContext } from "./context";
import {
  AIAnalysisAccessContextError,
  AIAnalysisConsentRequiredError,
  AIAnalysisContextChangedError,
  AIAnalysisInsufficientDataError,
  AIAnalysisProfileIncompleteError,
  AIAnalysisProviderFailureError,
  AIAnalysisProviderUnavailableError,
  AIAnalysisRateLimitedError,
  AIAnalysisResourceNotFoundError,
  AIAnalysisResponseInvalidError,
  AIAnalysisUnauthenticatedError,
} from "./domain";
import { AIAnalysisService, InMemoryOpportunityAnalysisRateLimiter, type OpportunityAnalysisRateLimiter } from "./service";
import {
  OTHER_TEST_USER_ID,
  TEST_OPPORTUNITY_ID,
  testAnalysis,
  testAnalysisContext,
  testUser,
} from "./test-fixtures";
import type { OpportunityAnalysisRecord, OpportunityAnalysisRepositoryPort } from "./repository";
import type { OpportunityAnalysisProvider } from "./provider";

function repository() {
  const rows: OpportunityAnalysisRecord[] = [];
  const repo: OpportunityAnalysisRepositoryPort = {
    findLatest: vi.fn(async (userId, userType, opportunityId, contextFingerprint) => rows
      .filter((row) => row.userId === userId && row.userType === userType && row.opportunityId === opportunityId
        && (row.aiAnalysis as { contextFingerprint?: string } | null)?.contextFingerprint === contextFingerprint)
      .sort((left, right) => right.generatedAt.getTime() - left.generatedAt.getTime())[0] ?? null),
    create: vi.fn(async (values) => {
      const row = { ...values, id: `b0000000-0000-4000-8000-${String(rows.length + 1).padStart(12, "0")}` } as OpportunityAnalysisRecord;
      rows.push(row);
      return row;
    }),
  };
  return { repo, rows };
}

function provider(generate = vi.fn().mockResolvedValue(testAnalysis)): OpportunityAnalysisProvider {
  return { provider: "test-provider", model: "test-model", generate };
}

function createService(options: {
  readonly user?: ReturnType<typeof testUser> | null;
  readonly context?: OpportunityAnalysisContext | null;
  readonly repo?: OpportunityAnalysisRepositoryPort;
  readonly provider?: OpportunityAnalysisProvider;
  readonly providerFactory?: () => OpportunityAnalysisProvider;
  readonly rateLimiter?: OpportunityAnalysisRateLimiter;
  readonly now?: () => number;
} = {}) {
  const user = options.user === undefined ? testUser() : options.user;
  const build = vi.fn().mockResolvedValue(options.context === undefined
    ? testAnalysisContext(user?.userType ?? "ENTREPRENEUR")
    : options.context);
  const contextBuilder = { build };
  const stored = options.repo ?? repository().repo;
  const service = new AIAnalysisService({
    repository: stored,
    contextBuilder,
    currentUserResolver: vi.fn().mockResolvedValue(user),
    providerFactory: options.providerFactory ?? (() => options.provider ?? provider()),
    rateLimiter: options.rateLimiter ?? new InMemoryOpportunityAnalysisRateLimiter(),
    now: options.now ?? (() => 1_800_000_000_000),
  });
  return { service, contextBuilder, repository: stored };
}

function staleRecord(userId = testUser().id, contextFingerprint = "b".repeat(64)): OpportunityAnalysisRecord {
  const context = testAnalysisContext();
  return {
    id: "b0000000-0000-4000-8000-000000000001",
    userId,
    userType: context.userType,
    opportunityId: TEST_OPPORTUNITY_ID,
    profileVersion: context.profileVersion,
    opportunityScore: null,
    fitScore: null,
    scoreStatus: "INSUFFICIENT_DATA",
    riskLevel: null,
    riskReasons: [],
    aiAnalysis: {
      schemaVersion: 1,
      contextFingerprint,
      profileVersion: context.profileVersion,
      userType: context.userType,
      limitedEvidence: false,
      generationContext: {},
      analysis: testAnalysis,
    },
    aiProvider: "test-provider",
    aiModel: "test-model",
    generatedAt: new Date("2026-10-01T00:00:00.000Z"),
  };
}

describe("AIAnalysisService", () => {
  it("requires authentication, a completed role, and an eligible Opportunity", async () => {
    const unauthenticated = createService({ user: null });
    await expect(unauthenticated.service.generate(TEST_OPPORTUNITY_ID, { consentConfirmed: true })).rejects.toBeInstanceOf(AIAnalysisUnauthenticatedError);

    const incompleteUser = { ...testUser(), onboardingStatus: "PROFILE_IN_PROGRESS" as const };
    const incomplete = createService({ user: incompleteUser });
    await expect(incomplete.service.generate(TEST_OPPORTUNITY_ID, { consentConfirmed: true })).rejects.toBeInstanceOf(AIAnalysisAccessContextError);

    const hidden = createService({ context: null });
    await expect(hidden.service.generate(TEST_OPPORTUNITY_ID, { consentConfirmed: true })).rejects.toBeInstanceOf(AIAnalysisResourceNotFoundError);
  });

  it("returns no cached analysis when the current role-specific profile is incomplete", async () => {
    const { service, contextBuilder } = createService();
    vi.mocked(contextBuilder.build).mockRejectedValueOnce(new AIAnalysisProfileIncompleteError());
    await expect(service.getLatest(TEST_OPPORTUNITY_ID)).resolves.toBeNull();
    vi.mocked(contextBuilder.build).mockRejectedValueOnce(new AIAnalysisInsufficientDataError());
    await expect(service.getLatest(TEST_OPPORTUNITY_ID)).resolves.toBeNull();
  });

  it.each(["ENTREPRENEUR", "UMKM_EXISTING"] as const)("persists an analysis for %s without accepting client authority", async (userType) => {
    const repo = repository();
    const generate = vi.fn().mockResolvedValue(testAnalysis);
    const { service } = createService({ user: testUser(userType), repo: repo.repo, provider: provider(generate) });
    const result = await service.generate(TEST_OPPORTUNITY_ID, { consentConfirmed: true, forceRefresh: true });

    expect(result).toMatchObject({ analysisId: expect.any(String), ...testAnalysis, provider: "test-provider", model: "test-model" });
    expect(repo.repo.create).toHaveBeenCalledTimes(1);
    const created = vi.mocked(repo.repo.create).mock.calls[0]?.[0];
    expect(created?.userId).toBe(testUser(userType).id);
    expect(created?.opportunityId).toBe(TEST_OPPORTUNITY_ID);
    expect(created?.aiAnalysis).toMatchObject({ profileVersion: userType === "ENTREPRENEUR" ? 2 : 3, userType, analysis: testAnalysis });
    expect(created?.opportunityScore).toBeNull();
    expect(created?.fitScore).toBe("75.00");
    expect(created?.riskLevel).toBeNull();
    expect(created?.riskReasons).toEqual([]);
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ profile: expect.objectContaining({ type: userType }) }));
  });

  it("loads analysis only for the authenticated user's row", async () => {
    const repo = repository();
    const generatedForOther = provider();
    const otherUser = testUser("UMKM_EXISTING", OTHER_TEST_USER_ID);
    const first = createService({ user: otherUser, repo: repo.repo, provider: generatedForOther });
    await first.service.generate(TEST_OPPORTUNITY_ID, { consentConfirmed: true, forceRefresh: true });
    const own = createService({ user: testUser(), repo: repo.repo, provider: generatedForOther });
    await expect(own.service.getLatest(TEST_OPPORTUNITY_ID)).resolves.toBeNull();
    expect(repo.repo.findLatest).toHaveBeenLastCalledWith(testUser().id, "ENTREPRENEUR", TEST_OPPORTUNITY_ID, testAnalysisContext().contextFingerprint);
  });

  it("uses a fresh cached result without calling the provider unless forceRefresh is true", async () => {
    const repo = repository();
    const generate = vi.fn().mockResolvedValue(testAnalysis);
    let now = 1_800_000_000_000;
    const service = createService({ repo: repo.repo, provider: provider(generate), now: () => now });
    const first = await service.service.generate(TEST_OPPORTUNITY_ID, { consentConfirmed: true });
    const cached = await service.service.generate(TEST_OPPORTUNITY_ID, { consentConfirmed: true });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(cached.analysisId).toBe(first.analysisId);

    now += 60_001;
    const refreshed = await service.service.generate(TEST_OPPORTUNITY_ID, { consentConfirmed: true, forceRefresh: true });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(refreshed.analysisId).not.toBe(first.analysisId);
  });

  it("requires explicit consent before generation or returning a POST cache result", async () => {
    const repo = repository();
    const generate = vi.fn().mockResolvedValue(testAnalysis);
    const { service } = createService({ repo: repo.repo, provider: provider(generate) });
    await expect(service.generate(TEST_OPPORTUNITY_ID)).rejects.toBeInstanceOf(AIAnalysisConsentRequiredError);
    expect(generate).not.toHaveBeenCalled();
    expect(repo.repo.create).not.toHaveBeenCalled();
  });

  it("does not return or reuse an analysis whose context fingerprint is stale", async () => {
    const memory = repository();
    memory.rows.push(staleRecord());
    const generate = vi.fn().mockResolvedValue(testAnalysis);
    const { service } = createService({ repo: memory.repo, provider: provider(generate) });
    await expect(service.getLatest(TEST_OPPORTUNITY_ID)).resolves.toBeNull();
    await service.generate(TEST_OPPORTUNITY_ID, { consentConfirmed: true });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(memory.repo.create).toHaveBeenCalledTimes(1);
  });

  it("returns 503 conditions before using the rate limit when provider configuration is missing", async () => {
    const limiter = { acquire: vi.fn().mockReturnValue(null) };
    const { service } = createService({ providerFactory: () => { throw new AIAnalysisProviderUnavailableError(); }, rateLimiter: limiter });
    await expect(service.generate(TEST_OPPORTUNITY_ID, { consentConfirmed: true })).rejects.toBeInstanceOf(AIAnalysisProviderUnavailableError);
    expect(limiter.acquire).not.toHaveBeenCalled();
  });

  it("preserves an upstream provider rate limit and does not persist an analysis", async () => {
    const repo = repository();
    const generate = vi.fn().mockRejectedValue(new AIAnalysisRateLimitedError(19));
    const { service } = createService({ repo: repo.repo, provider: provider(generate) });

    await expect(service.generate(TEST_OPPORTUNITY_ID, { consentConfirmed: true, forceRefresh: true })).rejects.toMatchObject({
      name: "AIAnalysisRateLimitedError",
      retryAfterSeconds: 19,
    });
    expect(repo.repo.create).not.toHaveBeenCalled();
  });

  it("sanitizes provider failures and never persists an invalid response", async () => {
    const repo = repository();
    const { service } = createService({ repo: repo.repo, provider: provider(vi.fn().mockRejectedValue(new Error("secret provider response"))) });
    await expect(service.generate(TEST_OPPORTUNITY_ID, { consentConfirmed: true, forceRefresh: true })).rejects.toBeInstanceOf(AIAnalysisProviderFailureError);
    expect(repo.repo.create).not.toHaveBeenCalled();

    const invalid = createService({ repo: repo.repo, provider: provider(vi.fn().mockResolvedValue({ ...testAnalysis, rawResponse: "invalid" })) });
    await expect(invalid.service.generate(TEST_OPPORTUNITY_ID, { consentConfirmed: true, forceRefresh: true })).rejects.toBeInstanceOf(AIAnalysisResponseInvalidError);
    expect(repo.repo.create).not.toHaveBeenCalled();
  });

  it("rejects unsupported numerical claims and guaranteed outcomes", async () => {
    const numerical = createService({ provider: provider(vi.fn().mockResolvedValue({ ...testAnalysis, summary: "Pasar akan tumbuh 82% tahun ini." })) });
    await expect(numerical.service.generate(TEST_OPPORTUNITY_ID, { consentConfirmed: true, forceRefresh: true })).rejects.toBeInstanceOf(AIAnalysisResponseInvalidError);
    const promise = createService({ provider: provider(vi.fn().mockResolvedValue({ ...testAnalysis, potential: "Keuntungan pasti berhasil." })) });
    await expect(promise.service.generate(TEST_OPPORTUNITY_ID, { consentConfirmed: true, forceRefresh: true })).rejects.toBeInstanceOf(AIAnalysisResponseInvalidError);
  });

  it("requires the trusted context to remain unchanged during generation", async () => {
    const contextBuilder = { build: vi.fn().mockResolvedValueOnce(testAnalysisContext()).mockResolvedValueOnce({ ...testAnalysisContext(), contextFingerprint: "c".repeat(64) }) };
    const repo = repository();
    const service = new AIAnalysisService({
      repository: repo.repo,
      contextBuilder,
      currentUserResolver: vi.fn().mockResolvedValue(testUser()),
      providerFactory: () => provider(),
      rateLimiter: new InMemoryOpportunityAnalysisRateLimiter(),
      now: () => 1_800_000_000_000,
    });
    await expect(service.generate(TEST_OPPORTUNITY_ID, { consentConfirmed: true, forceRefresh: true })).rejects.toBeInstanceOf(AIAnalysisContextChangedError);
    expect(repo.repo.create).not.toHaveBeenCalled();
  });

  it("enforces a cooldown per user while allowing a different user", () => {
    const limiter = new InMemoryOpportunityAnalysisRateLimiter();
    expect(limiter.acquire(testUser().id, 1000)).toBeNull();
    expect(limiter.acquire(testUser().id, 10_000)).toBe(51);
    expect(limiter.acquire(testUser("UMKM_EXISTING", OTHER_TEST_USER_ID).id, 10_000)).toBeNull();
    expect(limiter.acquire(testUser().id, 61_000)).toBeNull();
  });

  it("throttles consecutive paid generations and permits an explicit retry after the window", async () => {
    const repo = repository();
    const generate = vi.fn().mockResolvedValue(testAnalysis);
    let now = 1_800_000_000_000;
    const service = createService({ repo: repo.repo, provider: provider(generate), now: () => now });
    await service.service.generate(TEST_OPPORTUNITY_ID, { consentConfirmed: true, forceRefresh: true });
    await expect(service.service.generate(TEST_OPPORTUNITY_ID, { consentConfirmed: true, forceRefresh: true })).rejects.toBeInstanceOf(AIAnalysisRateLimitedError);
    expect(generate).toHaveBeenCalledTimes(1);

    now += 60_001;
    await service.service.generate(TEST_OPPORTUNITY_ID, { consentConfirmed: true, forceRefresh: true });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(repo.repo.create).toHaveBeenCalledTimes(2);
  });
});
