import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  notFound: vi.fn(),
  getDetail: vi.fn(),
  getSaveState: vi.fn(),
  resolver: null as null | (() => Promise<unknown>),
  saveResolver: null as null | (() => Promise<unknown>),
  listEvidence: vi.fn(),
  evidenceResolver: null as null | (() => Promise<unknown>),
  ids: [] as string[],
  resolvedUsers: [] as unknown[],
  evidenceIds: [] as string[],
  evidenceUsers: [] as unknown[],
  saveIds: [] as string[],
  saveUsers: [] as unknown[],
}));

vi.mock("@/auth/current-user", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/opportunity/service", () => ({
  OpportunityService: class MockOpportunityService {
    constructor(dependencies: { currentUserResolver: () => Promise<unknown> }) {
      mocks.resolver = dependencies.currentUserResolver;
    }

    async getDetail(id: string) {
      mocks.ids.push(id);
      const resolver = mocks.resolver;
      if (!resolver) throw new Error("The current-user resolver was not supplied.");
      mocks.resolvedUsers.push(await resolver());
      return mocks.getDetail(id);
    }
  },
}));
vi.mock("@/opportunity/evidence-service", () => ({
  OpportunityEvidenceService: class MockOpportunityEvidenceService {
    constructor(dependencies: { currentUserResolver: () => Promise<unknown> }) {
      mocks.evidenceResolver = dependencies.currentUserResolver;
    }

    async listForOpportunity(id: string) {
      mocks.evidenceIds.push(id);
      const resolver = mocks.evidenceResolver;
      if (!resolver) throw new Error("The evidence current-user resolver was not supplied.");
      mocks.evidenceUsers.push(await resolver());
      return mocks.listEvidence(id);
    }
  },
}));
vi.mock("@/opportunity/saved-service", () => ({
  SavedOpportunityService: class MockSavedOpportunityService {
    constructor(dependencies: { currentUserResolver: () => Promise<unknown> }) {
      mocks.saveResolver = dependencies.currentUserResolver;
    }

    async getSaveState(id: string) {
      mocks.saveIds.push(id);
      const resolver = mocks.saveResolver;
      if (!resolver) throw new Error("The saved-opportunity current-user resolver was not supplied.");
      mocks.saveUsers.push(await resolver());
      return mocks.getSaveState(id);
    }
  },
}));

import {
  ONBOARDING_STATUSES,
  USER_TYPES,
  userIdSchema,
  type SafeUser,
} from "@/auth/user-types";
import OpportunityDetailPage from "./page";

const user: SafeUser = {
  id: userIdSchema.parse("80000000-0000-4000-8000-000000000001"),
  email: "founder@example.com",
  userType: USER_TYPES.ENTREPRENEUR,
  onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
};
const detail = {
  id: "60000000-0000-4000-8000-000000000001",
  name: "Menu minuman",
  description: "Deskripsi peluang tersimpan.",
  categoryName: "Minuman",
  opportunityType: "NEW_PRODUCT",
  targetConsumerSummary: null,
  competitionLevel: null,
  competitionSummary: null,
  relatedTrend: {
    id: "70000000-0000-4000-8000-000000000001",
    title: "Tren minuman",
  },
};

describe("/opportunities/[id] page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolver = null;
    mocks.saveResolver = null;
    mocks.evidenceResolver = null;
    mocks.ids.length = 0;
    mocks.resolvedUsers.length = 0;
    mocks.evidenceIds.length = 0;
    mocks.evidenceUsers.length = 0;
    mocks.saveIds.length = 0;
    mocks.saveUsers.length = 0;
    mocks.notFound.mockImplementation(() => { throw new Error("NOT_FOUND"); });
  });

  it.each([USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING])(
    "loads eligible detail through the server-side service for %s",
    async (userType) => {
      const persistedUser: SafeUser = { ...user, userType };
      mocks.currentUser.mockResolvedValue(persistedUser);
      mocks.getDetail.mockResolvedValue(detail);
      mocks.listEvidence.mockResolvedValue({ status: "EMPTY", items: [], limited: true });
      mocks.getSaveState.mockResolvedValue({ status: "AVAILABLE", saved: false });

      const markup = renderToStaticMarkup(await OpportunityDetailPage({
        params: Promise.resolve({ id: detail.id }),
      })).replace(/\s+/gu, " ");

      expect(markup).toContain(detail.name);
      expect(mocks.currentUser).toHaveBeenCalledOnce();
      expect(mocks.resolvedUsers).toEqual([persistedUser]);
      expect(mocks.ids).toEqual([detail.id]);
      expect(mocks.evidenceUsers).toEqual([persistedUser]);
      expect(mocks.evidenceIds).toEqual([detail.id]);
      expect(mocks.saveUsers).toEqual([persistedUser]);
      expect(mocks.saveIds).toEqual([detail.id]);
    },
  );

  it.each([
    ["missing user", null],
    ["incomplete onboarding", { ...user, onboardingStatus: ONBOARDING_STATUSES.PROFILE_IN_PROGRESS }],
    ["missing user type", { ...user, userType: null }],
    ["unsupported user type", { ...user, userType: "UNKNOWN" }],
  ])("denies %s before detail lookup", async (_case, currentUser) => {
    mocks.currentUser.mockResolvedValue(currentUser);

    await expect(OpportunityDetailPage({ params: Promise.resolve({ id: detail.id }) }))
      .rejects.toThrow("NOT_FOUND");
    expect(mocks.getDetail).not.toHaveBeenCalled();
    expect(mocks.listEvidence).not.toHaveBeenCalled();
  });

  it.each(["invalid", detail.id])("uses not-found for inaccessible id %s", async (id) => {
    mocks.currentUser.mockResolvedValue(user);
    mocks.getDetail.mockResolvedValue(null);

    await expect(OpportunityDetailPage({ params: Promise.resolve({ id }) }))
      .rejects.toThrow("NOT_FOUND");
    expect(mocks.ids).toEqual([id]);
    expect(mocks.listEvidence).not.toHaveBeenCalled();
  });

  it("returns not-found if the Opportunity is no longer visible during evidence retrieval", async () => {
    mocks.currentUser.mockResolvedValue(user);
    mocks.getDetail.mockResolvedValue(detail);
    mocks.listEvidence.mockResolvedValue(null);

    await expect(OpportunityDetailPage({ params: Promise.resolve({ id: detail.id }) }))
      .rejects.toThrow("NOT_FOUND");
  });

  it("keeps Opportunity detail visible when only the evidence query fails", async () => {
    mocks.currentUser.mockResolvedValue(user);
    mocks.getDetail.mockResolvedValue(detail);
    mocks.listEvidence.mockRejectedValue(new Error("database internals"));

    const markup = renderToStaticMarkup(await OpportunityDetailPage({
      params: Promise.resolve({ id: detail.id }),
    })).replace(/\s+/gu, " ");

    expect(markup).toContain(detail.name);
    expect(markup).toContain("Evidence belum dapat dimuat.");
    expect(markup).not.toContain("database internals");
  });

  it("keeps Opportunity detail visible when only the saved-state query fails", async () => {
    mocks.currentUser.mockResolvedValue(user);
    mocks.getDetail.mockResolvedValue(detail);
    mocks.listEvidence.mockResolvedValue({ status: "EMPTY", items: [], limited: true });
    mocks.getSaveState.mockRejectedValue(new Error("database internals"));

    const markup = renderToStaticMarkup(await OpportunityDetailPage({
      params: Promise.resolve({ id: detail.id }),
    })).replace(/\s+/gu, " ");

    expect(markup).toContain(detail.name);
    expect(markup).toContain("Status simpanan belum dapat dimuat.");
    expect(markup).not.toContain("database internals");
  });

  it("lets persistence errors reach the safe route error boundary", async () => {
    mocks.currentUser.mockResolvedValue(user);
    mocks.getDetail.mockRejectedValue(new Error("database internals"));

    await expect(OpportunityDetailPage({ params: Promise.resolve({ id: detail.id }) }))
      .rejects.toThrow("database internals");
  });
});
