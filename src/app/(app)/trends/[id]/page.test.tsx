import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  getPublishedTrend: vi.fn(),
  relatedOpportunityQuery: vi.fn(),
  notFound: vi.fn(),
  resolvedIds: [] as string[],
  resolvedUsers: [] as unknown[],
  relatedTrendIds: [] as string[],
  relatedUsers: [] as unknown[],
  resolveCurrentUser: null as null | (() => Promise<unknown>),
  resolveOpportunityCurrentUser: null as null | (() => Promise<unknown>),
}));

vi.mock("@/auth/current-user", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/trend/service", () => ({
  TrendService: class MockTrendService {
    constructor(_repository: unknown, resolver: () => Promise<unknown>) {
      mocks.resolveCurrentUser = resolver;
    }

    async getPublishedTrend(id: string) {
      mocks.resolvedIds.push(id);
      const resolver = mocks.resolveCurrentUser;
      if (!resolver) throw new Error("The current-user resolver was not supplied.");

      mocks.resolvedUsers.push(await resolver());
      return mocks.getPublishedTrend(id);
    }
  },
}));
vi.mock("@/opportunity/service", () => ({
  OpportunityService: class MockOpportunityService {
    constructor(dependencies: { currentUserResolver: () => Promise<unknown> }) {
      mocks.resolveOpportunityCurrentUser = dependencies.currentUserResolver;
    }

    async listForTrend(trendId: string) {
      mocks.relatedTrendIds.push(trendId);
      const resolver = mocks.resolveOpportunityCurrentUser;
      if (!resolver) throw new Error("The Opportunity current-user resolver was not supplied.");

      mocks.relatedUsers.push(await resolver());
      return mocks.relatedOpportunityQuery(trendId);
    }
  },
}));

import { ONBOARDING_STATUSES, USER_TYPES, userIdSchema, type SafeUser } from "@/auth/user-types";
import ApplicationError from "../../error";
import TrendDetailNotFound from "./not-found";
import { default as TrendDetailPage } from "./page";

const TREND_ID = "60000000-0000-4000-8000-000000000003";
const persistedUser: SafeUser = {
  id: userIdSchema.parse("70000000-0000-4000-8000-000000000002"),
  email: "founder@example.com",
  userType: USER_TYPES.ENTREPRENEUR,
  onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
};
const publishedTrend = {
  id: TREND_ID,
  title: "Tren minuman terkurasi",
  category: { code: "PRODUCT_MENU", name: "Produk dan Menu", description: "Internal category description." },
  subjectArea: { code: "BEVERAGES", name: "Minuman" },
  signal: {
    summary: "Perubahan terlihat pada pilihan minuman.",
    description: "Internal signal description.",
    direction: "RISING" as const,
    observationPeriod: { start: "2026-01-01", end: "2026-03-31" },
  },
  evidence: [{
    sourceName: "Laporan konsumen",
    sourceReference: "laporan-2026/tabel-3",
    supportingDetail: "Tabel mencatat pilihan responden pada periode tersebut.",
    sourceDate: "2026-02-14T23:30:00.000Z",
    limitations: "Survei mencakup dua kota.",
  }],
  businessRelevanceExplanation: "Konteks untuk meninjau variasi menu.",
  affectedUserTypes: [USER_TYPES.ENTREPRENEUR],
  lifecycleState: "PUBLISHED" as const,
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-02T00:00:00.000Z",
};

function renderPage() {
  return TrendDetailPage({ params: Promise.resolve({ id: TREND_ID }) });
}

describe("/trends/[id] page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.relatedOpportunityQuery.mockReset().mockResolvedValue({ status: "EMPTY", items: [] });
    mocks.resolvedIds.length = 0;
    mocks.resolvedUsers.length = 0;
    mocks.relatedTrendIds.length = 0;
    mocks.relatedUsers.length = 0;
    mocks.resolveCurrentUser = null;
    mocks.resolveOpportunityCurrentUser = null;
    mocks.notFound.mockImplementation(() => {
      throw new Error("NOT_FOUND");
    });
  });

  it("renders detail through the persisted current-user context", async () => {
    mocks.currentUser.mockResolvedValue(persistedUser);
    mocks.getPublishedTrend.mockResolvedValue(publishedTrend);

    const markup = renderToStaticMarkup(await renderPage()).replace(/\s+/gu, " ");

    expect(markup).toContain("Tren minuman terkurasi");
    expect(markup).toContain("laporan-2026/tabel-3");
    expect(markup).toContain("Konteks untuk meninjau variasi menu.");
    expect(markup).toContain('href="/trends"');
    expect(mocks.currentUser).toHaveBeenCalledOnce();
    expect(mocks.getPublishedTrend).toHaveBeenCalledWith(TREND_ID);
    expect(mocks.resolvedIds).toEqual([TREND_ID]);
    expect(mocks.resolvedUsers).toEqual([persistedUser]);
    expect(mocks.relatedOpportunityQuery).toHaveBeenCalledWith(TREND_ID);
    expect(mocks.relatedTrendIds).toEqual([TREND_ID]);
    expect(mocks.relatedUsers).toEqual([persistedUser]);
    expect(markup).toContain("Belum ada peluang yang terhubung dengan tren ini.");
    expect(markup).not.toContain("Internal signal description");
    expect(markup).not.toContain("Internal category description");
  });

  it.each([USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING])(
    "loads related opportunities using persisted %s user context",
    async (userType) => {
      const user: SafeUser = { ...persistedUser, userType };
      const trend = { ...publishedTrend, affectedUserTypes: [userType] };
      const opportunity = {
        id: "50000000-0000-4000-8000-000000000001",
        name: "Menu minuman",
        categoryName: "Minuman",
        summary: "Peluang yang tersimpan dalam katalog.",
        relatedTrend: { id: TREND_ID, title: trend.title },
      };
      mocks.currentUser.mockResolvedValue(user);
      mocks.getPublishedTrend.mockResolvedValue(trend);
      mocks.relatedOpportunityQuery.mockResolvedValue({ status: "AVAILABLE", items: [opportunity] });

      const markup = renderToStaticMarkup(await renderPage()).replace(/\s+/gu, " ");

      expect(markup).toContain("Menu minuman");
      expect(markup).toContain("Peluang yang tersimpan dalam katalog.");
      expect(markup).toContain('href="/opportunities/50000000-0000-4000-8000-000000000001"');
      expect(mocks.relatedUsers).toEqual([user]);
      expect(mocks.relatedTrendIds).toEqual([TREND_ID]);
    },
  );

  it("keeps the Trend detail available when related Opportunity lookup fails", async () => {
    mocks.currentUser.mockResolvedValue(persistedUser);
    mocks.getPublishedTrend.mockResolvedValue(publishedTrend);
    mocks.relatedOpportunityQuery.mockRejectedValue(new Error("database internals"));

    const markup = renderToStaticMarkup(await renderPage()).replace(/\s+/gu, " ");

    expect(markup).toContain("Tren minuman terkurasi");
    expect(markup).toContain("Peluang terkait belum dapat dimuat. Konten Trend tetap tersedia.");
    expect(markup).not.toContain("database internals");
  });

  it.each([
    ["missing user", null],
    ["incomplete user", { ...persistedUser, onboardingStatus: ONBOARDING_STATUSES.PROFILE_IN_PROGRESS }],
    ["missing user type", { ...persistedUser, userType: null }],
    ["unsupported user type", { ...persistedUser, userType: "UNKNOWN" }],
  ])("rejects a %s before looking up Trend detail", async (_case, user) => {
    mocks.currentUser.mockResolvedValue(user);

    await expect(renderPage()).rejects.toThrow("NOT_FOUND");
    expect(mocks.getPublishedTrend).not.toHaveBeenCalled();
    expect(mocks.relatedOpportunityQuery).not.toHaveBeenCalled();
  });

  it("uses the same safe not-found result when the service denies detail access", async () => {
    mocks.currentUser.mockResolvedValue(persistedUser);
    mocks.getPublishedTrend.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow("NOT_FOUND");
    expect(mocks.resolvedUsers).toEqual([persistedUser]);
    expect(mocks.relatedOpportunityQuery).not.toHaveBeenCalled();
  });

  it("renders a generic not-found state with a return link and no Trend data", () => {
    const markup = renderToStaticMarkup(<TrendDetailNotFound />).replace(/\s+/gu, " ");

    expect(markup).toContain("Trend tidak ditemukan");
    expect(markup).toContain("Trend ini tidak tersedia atau tidak dapat diakses.");
    expect(markup).toContain('href="/trends"');
    expect(markup).not.toContain(TREND_ID);
  });

  it("propagates repository errors to the generic application error boundary", async () => {
    const repositoryError = new Error("database internals must not be displayed");
    mocks.currentUser.mockResolvedValue(persistedUser);
    mocks.getPublishedTrend.mockRejectedValue(repositoryError);

    await expect(renderPage()).rejects.toBe(repositoryError);
    expect(mocks.relatedOpportunityQuery).not.toHaveBeenCalled();
  });

  it("renders generic safe error copy without repository details", () => {
    const markup = renderToStaticMarkup(<ApplicationError reset={() => undefined} />)
      .replace(/\s+/gu, " ");

    expect(markup).toContain("Something went wrong");
    expect(markup).toContain("The page could not load.");
    expect(markup).not.toContain("database internals must not be displayed");
  });
});
