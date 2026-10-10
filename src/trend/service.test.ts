import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../auth/current-user", () => ({ getCurrentUser: vi.fn() }));

import { ONBOARDING_STATUSES, USER_TYPES, userIdSchema, type SafeUser } from "../auth/user-types";
import { toTrendDto } from "./dto";
import {
  assertTrendTransition,
  createDraftTrendSchema,
  InvalidTrendTransitionError,
  TrendRequirementNotMetError,
  trendIdSchema,
  type CreateDraftTrendInput,
  type TrendId,
  type TrendLifecycleState,
  type TrendRecord,
} from "./domain";
import { TrendService } from "./service";
import type { TrendRepositoryPort } from "./repository";

const TREND_ID = "60000000-0000-4000-8000-000000000001";
const CREATED_AT = new Date("2026-09-30T00:00:00.000Z");
const CURRENT_USER: SafeUser = {
  id: userIdSchema.parse("70000000-0000-4000-8000-000000000001"),
  email: "founder@example.com",
  userType: USER_TYPES.ENTREPRENEUR,
  onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
};
const validInput: CreateDraftTrendInput = {
  title: "Increasing demand for plant-based drinks",
  categoryCode: "CONSUMER_BEHAVIOR",
  subjectAreaId: null,
  signal: {
    summary: "More customers are choosing plant-based drinks.",
    description: "Aggregate purchase data shows increased plant-based drink selection.",
    direction: "RISING",
    periodStart: "2026-01-01",
    periodEnd: "2026-06-30",
  },
  evidence: [{
    sourceName: "Industry report",
    sourceReference: "https://example.com/report",
    supportingDetail: "The report documents a higher share of plant-based drink purchases.",
    sourceDate: null,
    limitations: "The report covers selected urban markets.",
  }],
  businessRelevanceExplanation: "This may inform beverage assortment planning.",
  affectedUserTypes: ["ENTREPRENEUR", "UMKM_EXISTING"],
};

function createRecord(overrides: Partial<TrendRecord> = {}): TrendRecord {
  return {
    id: trendIdSchema.parse(TREND_ID),
    title: validInput.title,
    categoryCode: validInput.categoryCode,
    subjectArea: null,
    signal: validInput.signal,
    evidence: validInput.evidence.map((item, index) => ({ id: "evidence-" + index, ...item, sourceDate: null })),
    businessRelevanceExplanation: validInput.businessRelevanceExplanation,
    affectedUserTypes: validInput.affectedUserTypes,
    lifecycleState: "DRAFT",
    archivedReason: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

class MemoryTrendRepository implements TrendRepositoryPort {
  readonly records: TrendRecord[] = [];

  async createDraft(input: CreateDraftTrendInput): Promise<TrendRecord> {
    const trend = createRecord({
      title: input.title,
      categoryCode: input.categoryCode,
      subjectArea: null,
      signal: input.signal,
      evidence: input.evidence.map((item, index) => ({
        id: "evidence-" + index,
        ...item,
        sourceDate: item.sourceDate === null ? null : new Date(item.sourceDate),
      })),
      businessRelevanceExplanation: input.businessRelevanceExplanation,
      affectedUserTypes: input.affectedUserTypes,
    });
    this.records.push(trend);
    return trend;
  }

  async findById(id: TrendId): Promise<TrendRecord | null> {
    return this.records.find((trend) => trend.id === id) ?? null;
  }

  async transition(id: TrendId, currentState: TrendLifecycleState, nextState: TrendLifecycleState, archivedReason: string | null): Promise<TrendRecord | null> {
    const index = this.records.findIndex((trend) => trend.id === id && trend.lifecycleState === currentState);
    if (index < 0) return null;
    const trend = this.records[index];
    if (!trend) return null;
    const updatedTrend = { ...trend, lifecycleState: nextState, archivedReason, updatedAt: new Date("2026-09-30T00:01:00.000Z") };
    this.records[index] = updatedTrend;
    return updatedTrend;
  }

  async listPublished(): Promise<readonly TrendRecord[]> {
    return this.records.filter((trend) => trend.lifecycleState === "PUBLISHED");
  }
}

describe("TrendService", () => {
  it("creates drafts and advances through valid lifecycle states", async () => {
    const service = new TrendService(new MemoryTrendRepository());
    const draft = await service.createDraftTrend(validInput);
    const validated = await service.validateTrend(draft.id);
    const published = await service.publishTrend(validated.id);
    expect(draft.lifecycleState).toBe("DRAFT");
    expect(validated.lifecycleState).toBe("VALIDATED");
    expect(published.lifecycleState).toBe("PUBLISHED");
  });

  it("rejects skipping from draft directly to published", async () => {
    const service = new TrendService(new MemoryTrendRepository());
    const draft = await service.createDraftTrend(validInput);
    await expect(service.publishTrend(draft.id)).rejects.toBeInstanceOf(InvalidTrendTransitionError);
  });

  it("rejects invalid lifecycle transitions, including archived reactivation", async () => {
    expect(() => assertTrendTransition("VALIDATED", "ARCHIVED")).toThrow(InvalidTrendTransitionError);

    const repository = new MemoryTrendRepository();
    repository.records.push(createRecord({ lifecycleState: "ARCHIVED", archivedReason: "No longer current." }));
    await expect(new TrendService(repository).publishTrend(TREND_ID)).rejects.toBeInstanceOf(InvalidTrendTransitionError);
  });

  it.each([
    "CONSUMER_BEHAVIOR",
    "PRODUCT_MENU",
    "CHANNEL_DISTRIBUTION",
    "TECHNOLOGY_ADOPTION",
    "OPERATIONAL_PATTERN",
    "MARKET_MOVEMENT",
  ] as const)("accepts approved Trend taxonomy code %s", (categoryCode) => {
    expect(createDraftTrendSchema.safeParse({ ...validInput, categoryCode }).success).toBe(true);
  });

  it("rejects unsupported Trend taxonomy codes", () => {
    expect(createDraftTrendSchema.safeParse({ ...validInput, categoryCode: "UNSUPPORTED" }).success).toBe(false);
  });

  it("requires evidence before publication", async () => {
    const repository = new MemoryTrendRepository();
    repository.records.push(createRecord({ lifecycleState: "VALIDATED", evidence: [] }));
    await expect(new TrendService(repository).publishTrend(TREND_ID)).rejects.toMatchObject({ requirement: "evidence" });
  });

  it("requires a relevance explanation before publication", async () => {
    const repository = new MemoryTrendRepository();
    repository.records.push(createRecord({ lifecycleState: "VALIDATED", businessRelevanceExplanation: "  " }));
    await expect(new TrendService(repository).publishTrend(TREND_ID)).rejects.toMatchObject({ requirement: "business relevance explanation" });
  });

  it("returns only published trends for the persisted audience and archives with a reason", async () => {
    const repository = new MemoryTrendRepository();
    repository.records.push(
      createRecord({ id: trendIdSchema.parse("60000000-0000-4000-8000-000000000005"), lifecycleState: "DRAFT", affectedUserTypes: [USER_TYPES.ENTREPRENEUR] }),
      createRecord({ id: trendIdSchema.parse("60000000-0000-4000-8000-000000000002"), lifecycleState: "VALIDATED", affectedUserTypes: [USER_TYPES.ENTREPRENEUR] }),
      createRecord({ lifecycleState: "PUBLISHED", affectedUserTypes: [USER_TYPES.ENTREPRENEUR] }),
      createRecord({ id: trendIdSchema.parse("60000000-0000-4000-8000-000000000003"), lifecycleState: "PUBLISHED", affectedUserTypes: [USER_TYPES.UMKM_EXISTING] }),
      createRecord({ id: trendIdSchema.parse("60000000-0000-4000-8000-000000000004"), lifecycleState: "ARCHIVED", archivedReason: "No longer current.", affectedUserTypes: [USER_TYPES.ENTREPRENEUR] }),
    );
    const service = new TrendService(repository, async () => CURRENT_USER);
    expect((await service.getPublishedTrends()).map(({ id }) => id)).toEqual([TREND_ID]);
    const archived = await service.archiveTrend(TREND_ID, "No longer supported by current evidence.");
    expect(archived.lifecycleState).toBe("ARCHIVED");
    expect(archived).not.toHaveProperty("archivedReason");
  });

  it("returns a published Trend detail only for a completed eligible user", async () => {
    const repository = new MemoryTrendRepository();
    repository.records.push(createRecord({
      lifecycleState: "PUBLISHED",
      affectedUserTypes: [USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING],
    }));

    const entrepreneur = await new TrendService(repository, async () => CURRENT_USER)
      .getPublishedTrend(TREND_ID);
    const umkmUser: SafeUser = { ...CURRENT_USER, userType: USER_TYPES.UMKM_EXISTING };
    const umkm = await new TrendService(repository, async () => umkmUser)
      .getPublishedTrend(TREND_ID);

    expect(entrepreneur).toMatchObject({ id: TREND_ID, lifecycleState: "PUBLISHED" });
    expect(umkm).toMatchObject({ id: TREND_ID, lifecycleState: "PUBLISHED" });
    expect(entrepreneur?.evidence[0]).toMatchObject({
      sourceName: "Industry report",
      sourceReference: "https://example.com/report",
      limitations: "The report covers selected urban markets.",
    });
  });

  it.each([
    ["missing record", null],
    ["unpublished record", createRecord({ lifecycleState: "DRAFT" })],
    ["ineligible audience", createRecord({
      lifecycleState: "PUBLISHED",
      affectedUserTypes: [USER_TYPES.UMKM_EXISTING],
    })],
  ] as const)("returns no detail for a %s", async (_case, record) => {
    const repository = new MemoryTrendRepository();
    if (record) repository.records.push(record);

    await expect(new TrendService(repository, async () => CURRENT_USER)
      .getPublishedTrend(TREND_ID)).resolves.toBeNull();
  });

  it("does not query details for unauthenticated, incomplete, or invalid-id requests", async () => {
    const repository = new MemoryTrendRepository();
    const findById = vi.spyOn(repository, "findById");
    const incompleteUser: SafeUser = {
      ...CURRENT_USER,
      onboardingStatus: ONBOARDING_STATUSES.PROFILE_IN_PROGRESS,
    };

    await expect(new TrendService(repository, async () => null)
      .getPublishedTrend(TREND_ID)).resolves.toBeNull();
    await expect(new TrendService(repository, async () => incompleteUser)
      .getPublishedTrend(TREND_ID)).resolves.toBeNull();
    await expect(new TrendService(repository, async () => CURRENT_USER)
      .getPublishedTrend("not-a-uuid")).resolves.toBeNull();

    expect(findById).not.toHaveBeenCalled();
  });

  it("returns no published trends when there is no authenticated current user", async () => {
    const repository = new MemoryTrendRepository();
    repository.records.push(createRecord({ lifecycleState: "PUBLISHED" }));
    expect(await new TrendService(repository, async () => null).getPublishedTrends()).toEqual([]);
  });

  it("returns no published trends when the persisted user type is null", async () => {
    const repository = new MemoryTrendRepository();
    repository.records.push(createRecord({ lifecycleState: "PUBLISHED" }));
    const userWithoutType: SafeUser = { ...CURRENT_USER, userType: null };
    expect(await new TrendService(repository, async () => userWithoutType).getPublishedTrends()).toEqual([]);
  });

  it("requires an affected audience before publication", async () => {
    const repository = new MemoryTrendRepository();
    repository.records.push(createRecord({ lifecycleState: "VALIDATED", affectedUserTypes: [] }));
    await expect(new TrendService(repository).publishTrend(TREND_ID)).rejects.toMatchObject({ requirement: "affected user type" });
  });

  it("keeps an optional F&B subject area separate from the Trend category", () => {
    const withoutSubjectArea = toTrendDto(createRecord());
    const withSubjectArea = toTrendDto(createRecord({ subjectArea: { code: "BEVERAGE", name: "Beverage" } }));

    expect(withoutSubjectArea.subjectArea).toBeNull();
    expect(withSubjectArea.category.code).toBe("CONSUMER_BEHAVIOR");
    expect(withSubjectArea.subjectArea).toEqual({ code: "BEVERAGE", name: "Beverage" });
  });

  it("maps safe catalog fields without ORM, evidence IDs, or calculated freshness metadata", () => {
    const internalRecord = {
      ...createRecord({ lifecycleState: "ARCHIVED", archivedReason: "No longer current." }),
      passwordHash: "private",
      metadata: { internal: true },
      sequelize: {},
      deletedAt: CREATED_AT,
    };
    const dto = toTrendDto(internalRecord);
    expect(dto).toMatchObject({
      id: TREND_ID,
      title: validInput.title,
      category: { code: "CONSUMER_BEHAVIOR", name: "Consumer Behavior" },
      subjectArea: null,
      signal: {
        summary: validInput.signal.summary,
        description: validInput.signal.description,
        direction: "RISING",
        observationPeriod: { start: "2026-01-01", end: "2026-06-30" },
      },
      evidence: [{
        sourceName: "Industry report",
        sourceReference: "https://example.com/report",
        supportingDetail: "The report documents a higher share of plant-based drink purchases.",
        sourceDate: null,
        limitations: "The report covers selected urban markets.",
      }],
      businessRelevanceExplanation: validInput.businessRelevanceExplanation,
      affectedUserTypes: [USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING],
      lifecycleState: "ARCHIVED",
      createdAt: CREATED_AT.toISOString(),
      updatedAt: CREATED_AT.toISOString(),
    });
    expect(dto).not.toHaveProperty("passwordHash");
    expect(dto).not.toHaveProperty("metadata");
    expect(dto).not.toHaveProperty("sequelize");
    expect(dto).not.toHaveProperty("deletedAt");
    expect(dto).not.toHaveProperty("archivedReason");
    expect(dto.evidence[0]).not.toHaveProperty("id");
    expect(dto).not.toHaveProperty("relevanceScore");
    expect(dto).not.toHaveProperty("fitScore");
    expect(dto).not.toHaveProperty("sourceMode");
    expect(dto).not.toHaveProperty("freshness");
    expect(dto).not.toHaveProperty("retrievedAt");
  });
});
