import { describe, expect, it, vi } from "vitest";
import { Op } from "sequelize";

vi.mock("server-only", () => ({}));

import { USER_TYPES } from "../auth/user-types";
import { Opportunity } from "../db/models/opportunity.model";
import { Trend } from "../db/models/trend.model";
import { FnbCategory } from "../reference/fnb-category.model";
import { OpportunityComparisonRepository } from "./compare-repository";

const ids = [
  "60000000-0000-4000-8000-000000000001",
  "60000000-0000-4000-8000-000000000002",
] as const;

function createRepository() {
  const opportunity = {
    id: ids[0],
    name: "Menu minuman",
    competitionLevel: "MEDIUM",
    competitionSummary: "Konteks tersimpan.",
    executionFeasibility: "75.00",
    relatedTrend: {
      id: "70000000-0000-4000-8000-000000000001",
      title: "Tren minuman",
      direction: "RISING",
      lifecycleState: "PUBLISHED",
      affectedUserTypes: [USER_TYPES.ENTREPRENEUR],
    },
    category: { name: "Minuman" },
  };
  const findAll = vi.fn().mockResolvedValue([opportunity]);
  const opportunityModel = {
    associations: {},
    belongsTo: vi.fn(),
    findAll,
  } as unknown as typeof Opportunity;
  const repository = new OpportunityComparisonRepository(
    opportunityModel,
    {} as typeof Trend,
    {} as typeof FnbCategory,
  );
  return { repository, findAll };
}

describe("OpportunityComparisonRepository", () => {
  it("reads only requested published Trend Opportunities for the user's audience", async () => {
    const { repository, findAll } = createRepository();

    await expect(repository.findEligibleForUser(USER_TYPES.ENTREPRENEUR, ids)).resolves.toEqual([{
      id: ids[0],
      name: "Menu minuman",
      categoryName: "Minuman",
      competitionLevel: "MEDIUM",
      competitionSummary: "Konteks tersimpan.",
      executionFeasibility: "75.00",
      relatedTrend: {
        id: "70000000-0000-4000-8000-000000000001",
        title: "Tren minuman",
        direction: "RISING",
        lifecycleState: "PUBLISHED",
        affectedUserTypes: [USER_TYPES.ENTREPRENEUR],
      },
    }]);

    const options = findAll.mock.calls[0]?.[0] as {
      readonly where: Record<PropertyKey, unknown>;
      readonly attributes: readonly string[];
      readonly include: readonly Record<string, unknown>[];
    };
    expect(options.where.id).toEqual({ [Op.in]: [...ids] });
    expect(options.attributes).toEqual([
      "id", "name", "competitionLevel", "competitionSummary", "executionFeasibility",
    ]);
    const trendInclude = options.include.find(({ as }) => as === "relatedTrend") as {
      readonly required: boolean;
      readonly where: Record<PropertyKey, unknown>;
    };
    expect(trendInclude.required).toBe(true);
    expect(trendInclude.where).toEqual({
      lifecycleState: "PUBLISHED",
      affectedUserTypes: { [Op.contains]: [USER_TYPES.ENTREPRENEUR] },
    });
    expect(options.include).toContainEqual(expect.objectContaining({ as: "category", required: true }));
    expect(options.include.some(({ as }) => as === "analyses" || as === "savedOpportunities")).toBe(false);
  });

  it("returns no rows for missing or ineligible IDs without writing data", async () => {
    const { repository, findAll } = createRepository();
    findAll.mockResolvedValueOnce([]);

    await expect(repository.findEligibleForUser(USER_TYPES.UMKM_EXISTING, ids)).resolves.toEqual([]);
    expect(findAll.mock.calls[0]?.[0]).toMatchObject({ where: { id: { [Op.in]: [...ids] } } });
    expect(findAll).toHaveBeenCalledTimes(1);
  });
});
