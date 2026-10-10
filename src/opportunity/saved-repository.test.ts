import { Op, UniqueConstraintError } from "sequelize";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { USER_TYPES, userIdSchema, type UserType } from "../auth/user-types";
import { Opportunity } from "../db/models/opportunity.model";
import { SavedOpportunity } from "../db/models/saved-opportunity.model";
import { Trend } from "../db/models/trend.model";
import { FnbCategory } from "../reference/fnb-category.model";
import { opportunityIdSchema } from "./domain";
import { SavedOpportunityRepository } from "./saved-repository";

const userId = userIdSchema.parse("80000000-0000-4000-8000-000000000001");
const otherUserId = userIdSchema.parse("80000000-0000-4000-8000-000000000002");
const opportunityId = opportunityIdSchema.parse("60000000-0000-4000-8000-000000000001");
const savedRow = { id: "61000000-0000-4000-8000-000000000001" };

function eligibleOpportunity(userType: UserType = USER_TYPES.ENTREPRENEUR) {
  return {
    id: opportunityId,
    name: "Menu minuman",
    description: "Peluang minuman tersimpan.",
    category: { id: "62000000-0000-4000-8000-000000000001", name: "Minuman" },
    relatedTrend: {
      id: "70000000-0000-4000-8000-000000000001",
      title: "Tren minuman",
      lifecycleState: "PUBLISHED",
      affectedUserTypes: [userType],
    },
    savedOpportunities: [savedRow],
  };
}

function createRepository({
  opportunity = eligibleOpportunity(),
  savedRows = [savedRow],
}: {
  readonly opportunity?: ReturnType<typeof eligibleOpportunity> | null;
  readonly savedRows?: readonly typeof savedRow[];
} = {}) {
  const findOne = vi.fn().mockResolvedValue(opportunity);
  const destroy = vi.fn().mockResolvedValue(1);
  const findOrCreate = vi.fn().mockResolvedValue([savedRow, false]);
  const findAll = vi.fn().mockResolvedValue(savedRows.map(() => ({ opportunity })));
  const opportunityModel = {
    associations: {},
    belongsTo: vi.fn(),
    hasMany: vi.fn(),
    findOne,
  } as unknown as typeof Opportunity;
  const savedModel = {
    associations: {},
    belongsTo: vi.fn(),
    findOne: vi.fn().mockResolvedValue(savedRow),
    findOrCreate,
    findAll,
    destroy,
  } as unknown as typeof SavedOpportunity;
  const repository = new SavedOpportunityRepository(
    savedModel,
    opportunityModel,
    {} as typeof Trend,
    {} as typeof FnbCategory,
  );
  return { repository, findOne, findOrCreate, findAll, destroy, savedModel, opportunityModel };
}

describe("SavedOpportunityRepository", () => {
  it.each([USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING])(
    "lists only the current user's published eligible opportunities for %s",
    async (userType) => {
      const { repository, findAll } = createRepository({ opportunity: eligibleOpportunity(userType) });

      await expect(repository.listVisibleForUser(userId, userType)).resolves.toEqual([{
        id: opportunityId,
        name: "Menu minuman",
        description: "Peluang minuman tersimpan.",
        categoryName: "Minuman",
        relatedTrend: {
          id: "70000000-0000-4000-8000-000000000001",
          title: "Tren minuman",
          lifecycleState: "PUBLISHED",
          affectedUserTypes: [userType],
        },
      }]);

      const options = findAll.mock.calls[0]?.[0] as {
        readonly where: { readonly userId: string };
        readonly include: readonly Record<string, unknown>[];
        readonly order: readonly unknown[];
      };
      expect(options.where).toEqual({ userId });
      const opportunityInclude = options.include[0] as {
        readonly as: string;
        readonly required: boolean;
        readonly include: readonly Record<string, unknown>[];
      };
      expect(opportunityInclude).toMatchObject({ as: "opportunity", required: true });
      expect(opportunityInclude.include).toEqual(expect.arrayContaining([
        expect.objectContaining({
          as: "relatedTrend",
          required: true,
          where: {
            lifecycleState: "PUBLISHED",
            affectedUserTypes: { [Op.contains]: [userType] },
          },
        }),
        expect.objectContaining({ as: "category", required: true }),
      ]));
      expect(options.order).toEqual([["createdAt", "DESC"], ["id", "ASC"]]);
    },
  );

  it("uses the authenticated owner in saved-state lookup", async () => {
    const { repository, findOne } = createRepository();

    await expect(repository.getVisibleSavedState(userId, USER_TYPES.ENTREPRENEUR, opportunityId))
      .resolves.toBe(true);

    const options = findOne.mock.calls[0]?.[0] as {
      readonly include: readonly Record<string, unknown>[];
    };
    expect(options.include).toEqual(expect.arrayContaining([
      expect.objectContaining({
        as: "savedOpportunities",
        required: false,
        where: { userId },
      }),
    ]));
  });

  it("does not reveal saved state for an ineligible or missing Opportunity", async () => {
    const { repository, findOrCreate, destroy } = createRepository({ opportunity: null });

    await expect(repository.getVisibleSavedState(userId, USER_TYPES.ENTREPRENEUR, opportunityId))
      .resolves.toBeNull();
    await expect(repository.saveVisibleForUser(userId, USER_TYPES.ENTREPRENEUR, opportunityId))
      .resolves.toBeNull();
    await expect(repository.removeVisibleForUser(userId, USER_TYPES.ENTREPRENEUR, opportunityId))
      .resolves.toBeNull();
    expect(findOrCreate).not.toHaveBeenCalled();
    expect(destroy).not.toHaveBeenCalled();
  });

  it("keeps duplicate saves idempotent with the database unique key", async () => {
    const { repository, findOrCreate } = createRepository();

    await expect(repository.saveVisibleForUser(userId, USER_TYPES.ENTREPRENEUR, opportunityId))
      .resolves.toBe(true);
    await expect(repository.saveVisibleForUser(userId, USER_TYPES.ENTREPRENEUR, opportunityId))
      .resolves.toBe(true);

    expect(findOrCreate).toHaveBeenCalledTimes(2);
    expect(findOrCreate).toHaveBeenNthCalledWith(1, {
      where: { userId, opportunityId },
      defaults: { userId, opportunityId },
    });
  });

  it("recovers concurrent duplicate inserts by reading only the same user's relation", async () => {
    const { repository, findOrCreate, savedModel } = createRepository();
    findOrCreate.mockRejectedValueOnce(new UniqueConstraintError({ errors: [] }));
    vi.mocked(savedModel.findOne).mockResolvedValueOnce(savedRow as never);

    await expect(repository.saveVisibleForUser(userId, USER_TYPES.ENTREPRENEUR, opportunityId))
      .resolves.toBe(true);

    expect(savedModel.findOne).toHaveBeenCalledWith({ where: { userId, opportunityId } });
    expect(savedModel.findOne).not.toHaveBeenCalledWith({ where: { userId: otherUserId, opportunityId } });
  });

  it("removes only the current user's relation without deleting the master Opportunity", async () => {
    const { repository, destroy, opportunityModel } = createRepository();

    await expect(repository.removeVisibleForUser(userId, USER_TYPES.ENTREPRENEUR, opportunityId))
      .resolves.toBe(false);

    expect(destroy).toHaveBeenCalledWith({ where: { userId, opportunityId } });
    expect(opportunityModel).not.toHaveProperty("destroy");
  });

  it("does not mutate saved records while listing eligibility-filtered rows", async () => {
    const { repository, destroy } = createRepository();

    await repository.listVisibleForUser(userId, USER_TYPES.ENTREPRENEUR);

    expect(destroy).not.toHaveBeenCalled();
  });

  it("applies a requested preview limit to the database query", async () => {
    const { repository, findAll } = createRepository();

    await repository.listVisibleForUser(userId, USER_TYPES.ENTREPRENEUR, 3);

    expect(findAll.mock.calls[0]?.[0]).toMatchObject({ limit: 3 });
  });
});
