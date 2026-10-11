import { Op } from "sequelize";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { USER_TYPES } from "../auth/user-types";
import { Opportunity } from "../db/models/opportunity.model";
import { Trend } from "../db/models/trend.model";
import { FnbCategory } from "../reference/fnb-category.model";
import { OpportunityRepository } from "./repository";

function createRepository() {
  const count = vi.fn().mockResolvedValue(1);
  const findAll = vi.fn().mockResolvedValue([{
    id: "60000000-0000-4000-8000-000000000001",
    name: "Menu minuman",
    description: "Ringkasan tersimpan.",
    category: { name: "Minuman" },
    relatedTrend: {
      id: "70000000-0000-4000-8000-000000000001",
      title: "Tren minuman",
      lifecycleState: "PUBLISHED",
      affectedUserTypes: [USER_TYPES.ENTREPRENEUR],
    },
  }]);
  const findOne = vi.fn().mockResolvedValue({
    id: "60000000-0000-4000-8000-000000000001",
    fnbCategoryId: "80000000-0000-4000-8000-000000000001",
    name: "Menu minuman",
    description: "Ringkasan tersimpan.",
    opportunityType: "NEW_PRODUCT",
    targetConsumerSummary: "Konsumen minuman.",
    competitionLevel: "MEDIUM",
    competitionSummary: "Konteks kompetisi tersimpan.",
    category: { name: "Minuman" },
    relatedTrend: {
      id: "70000000-0000-4000-8000-000000000001",
      title: "Tren minuman",
      lifecycleState: "PUBLISHED",
      affectedUserTypes: [USER_TYPES.ENTREPRENEUR],
    },
  });
  const opportunityModel = {
    associations: { relatedTrend: {}, category: {} },
    belongsTo: vi.fn(),
    count,
    findAll,
    findOne,
  } as unknown as typeof Opportunity;
  const categoryFindAll = vi.fn().mockResolvedValue([
    { code: "BEVERAGES", name: "Minuman" },
    { code: "SNACKS", name: "Camilan" },
  ]);
  const categoryModel = {
    associations: {},
    findAll: categoryFindAll,
  } as unknown as typeof FnbCategory;
  const repository = new OpportunityRepository(
    opportunityModel,
    {} as typeof Trend,
    categoryModel,
  );
  return { repository, count, findAll, findOne, categoryFindAll };
}

describe("OpportunityRepository", () => {
  it("lists active persisted F&B categories in deterministic code order", async () => {
    const { repository, categoryFindAll } = createRepository();

    await expect(repository.listActiveCategories()).resolves.toEqual([
      { code: "BEVERAGES", name: "Minuman" },
      { code: "SNACKS", name: "Camilan" },
    ]);
    expect(categoryFindAll).toHaveBeenCalledWith({
      where: { isActive: true },
      attributes: ["code", "name"],
      order: [["code", "ASC"]],
    });
  });

  it.each([USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING])(
    "counts only PUBLISHED related Trends eligible for %s",
    async (userType) => {
      const { repository, count } = createRepository();

      await repository.countVisible(userType);

      expect(count).toHaveBeenCalledWith(expect.objectContaining({
        distinct: true,
        col: "id",
        include: expect.arrayContaining([
          expect.objectContaining({
            as: "relatedTrend",
            required: true,
            where: {
              lifecycleState: "PUBLISHED",
              affectedUserTypes: { [Op.contains]: [userType] },
            },
          }),
        ]),
      }));
    },
  );

  it("applies the validated F&B category to the count query", async () => {
    const { repository, count } = createRepository();

    await repository.countVisible(USER_TYPES.ENTREPRENEUR, "BEVERAGES");

    const options = count.mock.calls[0]?.[0];
    expect(options?.include).toEqual(expect.arrayContaining([
      expect.objectContaining({
        as: "category",
        required: true,
        where: { code: "BEVERAGES", isActive: true },
      }),
    ]));
  });

  it("projects persisted category and Trend labels with stable paginated ordering", async () => {
    const { repository, findAll } = createRepository();

    await expect(repository.listVisible(USER_TYPES.UMKM_EXISTING, { limit: 10, offset: 20 }))
      .resolves.toEqual([{
        id: "60000000-0000-4000-8000-000000000001",
        name: "Menu minuman",
        description: "Ringkasan tersimpan.",
        categoryName: "Minuman",
        relatedTrend: {
          id: "70000000-0000-4000-8000-000000000001",
          title: "Tren minuman",
          lifecycleState: "PUBLISHED",
          affectedUserTypes: [USER_TYPES.ENTREPRENEUR],
        },
      }]);

    expect(findAll).toHaveBeenCalledWith(expect.objectContaining({
      attributes: ["id", "name", "description"],
      limit: 10,
      offset: 20,
      order: [["createdAt", "DESC"], ["id", "ASC"]],
      include: expect.arrayContaining([
        expect.objectContaining({ as: "relatedTrend", required: true }),
        expect.objectContaining({ as: "category", required: true }),
      ]),
    }));
  });

  it("filters in the database before applying the requested page", async () => {
    const { repository, findAll } = createRepository();

    await repository.listVisible(
      USER_TYPES.ENTREPRENEUR,
      { limit: 10, offset: 10 },
      "BEVERAGES",
    );

    expect(findAll).toHaveBeenCalledWith(expect.objectContaining({
      limit: 10,
      offset: 10,
      include: expect.arrayContaining([
        expect.objectContaining({
          as: "category",
          required: true,
          where: { code: "BEVERAGES", isActive: true },
        }),
      ]),
    }));
  });

  it.each([USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING])(
    "lists only opportunities related to the selected Trend and visible to %s in Finder order",
    async (userType) => {
      const { repository, findAll } = createRepository();
      const relatedTrendId = "70000000-0000-4000-8000-000000000001";

      await expect(repository.listVisibleForTrend(userType, relatedTrendId)).resolves.toMatchObject([{
        id: "60000000-0000-4000-8000-000000000001",
        categoryName: "Minuman",
        relatedTrend: { id: relatedTrendId },
      }]);

      expect(findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: { relatedTrendId },
        attributes: ["id", "name", "description"],
        order: [["createdAt", "DESC"], ["id", "ASC"]],
        include: expect.arrayContaining([
          expect.objectContaining({
            as: "relatedTrend",
            required: true,
            where: {
              lifecycleState: "PUBLISHED",
              affectedUserTypes: { [Op.contains]: [userType] },
            },
          }),
          expect.objectContaining({ as: "category", required: true }),
        ]),
      }));
    },
  );

  it.each([USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING])(
    "loads detail only when its related Trend is published and eligible for %s",
    async (userType) => {
      const { repository, findOne } = createRepository();

      await expect(repository.findVisibleById(
        userType,
        "60000000-0000-4000-8000-000000000001",
      )).resolves.toEqual({
        id: "60000000-0000-4000-8000-000000000001",
        name: "Menu minuman",
        description: "Ringkasan tersimpan.",
        categoryName: "Minuman",
        opportunityType: "NEW_PRODUCT",
        targetConsumerSummary: "Konsumen minuman.",
        competitionLevel: "MEDIUM",
        competitionSummary: "Konteks kompetisi tersimpan.",
        relatedTrend: {
          id: "70000000-0000-4000-8000-000000000001",
          title: "Tren minuman",
          lifecycleState: "PUBLISHED",
          affectedUserTypes: [USER_TYPES.ENTREPRENEUR],
        },
      });
      expect(findOne).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: "60000000-0000-4000-8000-000000000001" },
        attributes: [
          "id",
          "name",
          "description",
          "opportunityType",
          "targetConsumerSummary",
          "competitionLevel",
          "competitionSummary",
        ],
        include: expect.arrayContaining([
          expect.objectContaining({
            as: "relatedTrend",
            required: true,
            where: {
              lifecycleState: "PUBLISHED",
              affectedUserTypes: { [Op.contains]: [userType] },
            },
          }),
        ]),
      }));
    },
  );

  it("returns null when no eligible opportunity and Trend relation is found", async () => {
    const { repository, findOne } = createRepository();
    findOne.mockResolvedValue(null);

    await expect(repository.findVisibleById(
      USER_TYPES.ENTREPRENEUR,
      "60000000-0000-4000-8000-000000000099",
    )).resolves.toBeNull();
  });

  it.each([USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING])(
    "loads Fit Input Opportunity only through the published eligible Trend relation for %s",
    async (userType) => {
      const { repository, findOne } = createRepository();
      const transaction = {} as import("sequelize").Transaction;
      findOne.mockResolvedValueOnce({
        id: "60000000-0000-4000-8000-000000000001",
        fnbCategoryId: "80000000-0000-4000-8000-000000000001",
        relatedTrend: {
          id: "70000000-0000-4000-8000-000000000001",
          title: "Tren minuman",
          lifecycleState: "PUBLISHED",
          affectedUserTypes: [userType],
        },
      });

      await expect(repository.findVisibleForFitInput(
        userType,
        "60000000-0000-4000-8000-000000000001",
        transaction,
      )).resolves.toEqual({
        id: "60000000-0000-4000-8000-000000000001",
        fnbCategoryId: "80000000-0000-4000-8000-000000000001",
        relatedTrend: {
          id: "70000000-0000-4000-8000-000000000001",
          lifecycleState: "PUBLISHED",
          affectedUserTypes: [userType],
        },
      });
      expect(findOne).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: "60000000-0000-4000-8000-000000000001" },
        attributes: ["id", "fnbCategoryId"],
        transaction,
        include: expect.arrayContaining([expect.objectContaining({
          as: "relatedTrend",
          required: true,
          where: {
            lifecycleState: "PUBLISHED",
            affectedUserTypes: { [Op.contains]: [userType] },
          },
        })]),
      }));
    },
  );
});
