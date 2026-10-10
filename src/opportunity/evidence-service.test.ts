import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../auth/current-user", () => ({ getCurrentUser: vi.fn() }));

import {
  ONBOARDING_STATUSES,
  USER_TYPES,
  userIdSchema,
  type SafeUser,
  type UserType,
} from "../auth/user-types";
import type { OpportunityEvidenceRecord } from "./evidence-domain";
import {
  OpportunityEvidenceService,
  type OpportunityEvidenceServiceDependencies,
} from "./evidence-service";
import type { OpportunityEvidenceRepositoryPort } from "./evidence-repository";

const opportunityId = "60000000-0000-4000-8000-000000000001";
const founder: SafeUser = {
  id: userIdSchema.parse("80000000-0000-4000-8000-000000000001"),
  email: "founder@example.com",
  userType: USER_TYPES.ENTREPRENEUR,
  onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
};
const baseEvidence: OpportunityEvidenceRecord = {
  id: "61000000-0000-4000-8000-000000000001",
  sourceName: "Laporan industri",
  sourceType: "Government/Open Data",
  sourceReference: "Dataset seri 4, tabel 2",
  sourceUrl: "https://example.org/dataset",
  sourceDate: new Date("2026-01-15T00:00:00.000Z"),
  retrievedAt: new Date("2026-02-01T10:30:00.000Z"),
  metadata: {},
};

class MemoryEvidenceRepository implements OpportunityEvidenceRepositoryPort {
  readonly findForVisibleOpportunity = vi.fn(async (_userType: UserType, _id: string) => this.records);

  constructor(readonly records: readonly OpportunityEvidenceRecord[] | null) {}
}

function createService(
  records: readonly OpportunityEvidenceRecord[] | null,
  user: SafeUser | null = founder,
  overrides: Partial<OpportunityEvidenceServiceDependencies> = {},
) {
  const repository = new MemoryEvidenceRepository(records);
  const service = new OpportunityEvidenceService({
    repository,
    currentUserResolver: async () => user,
    ...overrides,
  });
  return { service, repository };
}

describe("OpportunityEvidenceService", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING])(
    "uses the persisted %s audience to load evidence",
    async (userType) => {
      const repository = new MemoryEvidenceRepository([baseEvidence]);
      const service = new OpportunityEvidenceService({
        repository,
        currentUserResolver: async () => ({ ...founder, userType }),
      });

      await service.listForOpportunity(opportunityId);

      expect(repository.findForVisibleOpportunity).toHaveBeenCalledWith(userType, opportunityId);
    },
  );

  it("returns EMPTY and limited for zero evidence", async () => {
    const { service, repository } = createService([]);

    await expect(service.listForOpportunity(opportunityId)).resolves.toEqual({
      status: "EMPTY",
      items: [],
      limited: true,
    });
    expect(repository.findForVisibleOpportunity).toHaveBeenCalledOnce();
  });

  it("marks one otherwise complete evidence item as limited", async () => {
    const { service } = createService([baseEvidence]);

    await expect(service.listForOpportunity(opportunityId)).resolves.toMatchObject({
      status: "AVAILABLE",
      limited: true,
      items: [{
        sourceName: baseEvidence.sourceName,
        sourceType: baseEvidence.sourceType,
        sourceDateLabel: "Tanggal sumber (UTC): 2026-01-15",
        retrievedAtLabel: "Data diambil: 2026-02-01 10:30 UTC",
      }],
    });
  });

  it("does not equate two complete evidence items with verified or strong evidence", async () => {
    const { service } = createService([
      baseEvidence,
      { ...baseEvidence, id: "61000000-0000-4000-8000-000000000002" },
    ]);

    await expect(service.listForOpportunity(opportunityId)).resolves.toMatchObject({
      status: "AVAILABLE",
      limited: false,
      items: expect.any(Array),
    });
  });

  it("marks recorded limitations and incomplete source metadata as limited", async () => {
    const { service } = createService([
      { ...baseEvidence, metadata: { limitations: "Cakupan hanya beberapa kota." } },
      {
        ...baseEvidence,
        id: "61000000-0000-4000-8000-000000000002",
        sourceDate: null,
        sourceReference: null,
        sourceUrl: null,
      },
    ]);

    await expect(service.listForOpportunity(opportunityId)).resolves.toMatchObject({
      status: "AVAILABLE",
      limited: true,
      items: [
        { limitations: ["Cakupan hanya beberapa kota."] },
        { sourceDateLabel: "Tanggal sumber tidak dicantumkan.", sourceReference: null, sourceUrl: null },
      ],
    });
  });

  it("does not expose malformed metadata and treats it as a limitation", async () => {
    const secretLikeValue = "private raw metadata value";
    const { service } = createService([
      { ...baseEvidence, metadata: { limitations: 42, raw: secretLikeValue } },
      { ...baseEvidence, id: "61000000-0000-4000-8000-000000000002" },
    ]);

    const result = await service.listForOpportunity(opportunityId);

    expect(result).toMatchObject({ status: "AVAILABLE", limited: true });
    expect(JSON.stringify(result)).toContain("Metadata keterbatasan sumber tidak dapat dibaca.");
    expect(JSON.stringify(result)).not.toContain(secretLikeValue);
  });

  it("does not expose unsafe source URLs as links", async () => {
    const { service } = createService([
      { ...baseEvidence, sourceUrl: "javascript:alert(1)" },
      { ...baseEvidence, id: "61000000-0000-4000-8000-000000000002" },
    ]);

    const result = await service.listForOpportunity(opportunityId);

    expect(result).toMatchObject({ status: "AVAILABLE", limited: true });
    if (result?.status !== "AVAILABLE") throw new Error("Expected evidence to be available.");
    expect(result.items[0]).toMatchObject({
      sourceUrl: null,
      limitations: ["URL sumber tidak ditampilkan karena tidak aman."],
    });
  });

  it("returns null for an invalid id or Opportunity that is not visible", async () => {
    const { service, repository } = createService(null);

    await expect(service.listForOpportunity("invalid-id")).resolves.toBeNull();
    expect(repository.findForVisibleOpportunity).not.toHaveBeenCalled();
    await expect(service.listForOpportunity(opportunityId)).resolves.toBeNull();
  });

  it.each([
    ["no authenticated user", null],
    ["incomplete onboarding", {
      ...founder,
      onboardingStatus: ONBOARDING_STATUSES.PROFILE_IN_PROGRESS,
    }],
  ])("does not query evidence for %s", async (_case, user) => {
    const { service, repository } = createService([baseEvidence], user as SafeUser | null);

    await expect(service.listForOpportunity(opportunityId)).rejects.toThrow();
    expect(repository.findForVisibleOpportunity).not.toHaveBeenCalled();
  });

  it("propagates evidence query errors so the page can isolate the failure", async () => {
    const repository = new MemoryEvidenceRepository([baseEvidence]);
    repository.findForVisibleOpportunity.mockRejectedValue(new Error("database details"));
    const service = new OpportunityEvidenceService({ repository, currentUserResolver: async () => founder });

    await expect(service.listForOpportunity(opportunityId)).rejects.toThrow("database details");
  });
});
