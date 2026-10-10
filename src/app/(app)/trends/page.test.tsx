import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  publishedTrends: vi.fn(),
  resolveCurrentUser: null as null | (() => Promise<unknown>),
  resolvedUsers: [] as unknown[],
}));

vi.mock("@/auth/current-user", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("@/trend/service", () => ({
  TrendService: class MockTrendService {
    constructor(_repository: unknown, resolver: () => Promise<unknown>) {
      mocks.resolveCurrentUser = resolver;
    }

    async getPublishedTrends() {
      const resolver = mocks.resolveCurrentUser;
      if (!resolver) throw new Error("The current-user resolver was not supplied.");

      mocks.resolvedUsers.push(await resolver());
      return mocks.publishedTrends();
    }
  },
}));

import { ONBOARDING_STATUSES, USER_TYPES, userIdSchema, type SafeUser } from "@/auth/user-types";
import { TrendListAccessContextError, default as TrendsPage } from "./page";

const persistedUser: SafeUser = {
  id: userIdSchema.parse("70000000-0000-4000-8000-000000000002"),
  email: "founder@example.com",
  userType: USER_TYPES.ENTREPRENEUR,
  onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
};

const publishedTrend = {
  id: "60000000-0000-4000-8000-000000000003",
  title: "Tren minuman terkurasi",
  category: { code: "PRODUCT_MENU", name: "Produk dan Menu", description: "Kategori." },
  subjectArea: null,
  signal: {
    summary: "Perubahan terlihat pada pilihan minuman.",
    description: "Deskripsi internal.",
    direction: "RISING" as const,
    observationPeriod: { start: null, end: null },
  },
  evidence: [{
    sourceName: "Sumber laporan",
    sourceReference: "reference-1",
    supportingDetail: "Dukungan dari catatan laporan.",
    sourceDate: null,
    limitations: null,
  }],
  businessRelevanceExplanation: null,
  affectedUserTypes: [USER_TYPES.ENTREPRENEUR],
  lifecycleState: "PUBLISHED" as const,
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-02T00:00:00.000Z",
};

describe("/trends page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveCurrentUser = null;
    mocks.resolvedUsers.length = 0;
  });

  it("renders server-resolved published content using the persisted current user", async () => {
    mocks.currentUser.mockResolvedValue(persistedUser);
    mocks.publishedTrends.mockResolvedValue([publishedTrend]);

    const markup = renderToStaticMarkup(await TrendsPage()).replace(/\s+/gu, " ");

    expect(markup).toContain("Tren minuman terkurasi");
    expect(markup).toContain("reference-1");
    expect(mocks.currentUser).toHaveBeenCalledOnce();
    expect(mocks.resolvedUsers).toEqual([persistedUser]);
    expect(mocks.resolvedUsers[0]).toEqual(expect.objectContaining({
      id: persistedUser.id,
      userType: USER_TYPES.ENTREPRENEUR,
    }));
    expect(mocks.publishedTrends).toHaveBeenCalledOnce();
  });

  it("renders EMPTY only after a successful query returns no eligible records", async () => {
    mocks.currentUser.mockResolvedValue(persistedUser);
    mocks.publishedTrends.mockResolvedValue([]);

    const markup = renderToStaticMarkup(await TrendsPage());

    expect(markup).toContain("Belum ada tren F&amp;B terkurasi");
    expect(markup).not.toContain("Something went wrong");
    expect(mocks.resolvedUsers).toEqual([persistedUser]);
    expect(mocks.publishedTrends).toHaveBeenCalledOnce();
  });

  it.each([
    ["missing user", null],
    ["missing userType", { ...persistedUser, userType: null }],
    ["unsupported userType", { ...persistedUser, userType: "UNKNOWN" }],
  ])("rejects %s instead of presenting EMPTY", async (_case, user) => {
    mocks.currentUser.mockResolvedValue(user);

    await expect(TrendsPage()).rejects.toBeInstanceOf(TrendListAccessContextError);
    expect(mocks.resolvedUsers).toEqual([]);
    expect(mocks.publishedTrends).not.toHaveBeenCalled();
  });

  it("propagates repository errors to the existing app error boundary", async () => {
    const repositoryError = new Error("database internals must not be displayed");
    mocks.currentUser.mockResolvedValue(persistedUser);
    mocks.publishedTrends.mockRejectedValue(repositoryError);

    await expect(TrendsPage()).rejects.toBe(repositoryError);
  });
});
