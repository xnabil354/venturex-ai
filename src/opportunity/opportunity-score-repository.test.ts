import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { Op } from "sequelize";

import { USER_TYPES } from "../auth/user-types";
import type { Opportunity } from "../db/models/opportunity.model";
import type { ScoringModel } from "../db/models/scoring-model.model";
import type { Trend } from "../db/models/trend.model";
import { OpportunityScoreRepository } from "./opportunity-score-repository";

describe("OpportunityScoreRepository", () => {
  it("loads numeric Opportunity sources only through published, user-eligible Trends", async () => {
    const opportunityId = "60000000-0000-4000-8000-000000000001";
    const findAll = vi.fn(async (_options: unknown) => [{
      id: opportunityId,
      executionFeasibility: "72.50",
      marketSustainability: "61.00",
      relatedTrend: {
        lifecycleState: "PUBLISHED",
        affectedUserTypes: [USER_TYPES.ENTREPRENEUR],
      },
    }]);
    const opportunityModel = {
      associations: { relatedTrend: {} },
      findAll,
    } as unknown as typeof Opportunity;
    const repository = new OpportunityScoreRepository(
      opportunityModel,
      {} as typeof Trend,
      {} as typeof ScoringModel,
    );

    const result = await repository.findVisibleSources(USER_TYPES.ENTREPRENEUR, [opportunityId]);
    const options = findAll.mock.calls[0]?.[0] as {
      readonly where: Record<string, unknown>;
      readonly include: readonly { readonly where: Record<string, unknown> }[];
    };

    expect(result).toEqual([{
      id: opportunityId,
      executionFeasibility: "72.50",
      marketSustainability: "61.00",
      relatedTrend: {
        lifecycleState: "PUBLISHED",
        affectedUserTypes: [USER_TYPES.ENTREPRENEUR],
      },
    }]);
    expect(options.where).toEqual({ id: { [Op.in]: [opportunityId] } });
    expect(options.include[0]?.where).toEqual({
      lifecycleState: "PUBLISHED",
      affectedUserTypes: { [Op.contains]: [USER_TYPES.ENTREPRENEUR] },
    });
  });

  it("loads only active Opportunity Score models, leaving approval validation to the service", async () => {
    const findAll = vi.fn(async (_options: unknown) => []);
    const scoringModel = { findAll } as unknown as typeof ScoringModel;
    const repository = new OpportunityScoreRepository(
      { associations: { relatedTrend: {} } } as unknown as typeof Opportunity,
      {} as typeof Trend,
      scoringModel,
    );

    await repository.findActiveModels();
    const options = findAll.mock.calls[0]?.[0] as { readonly where: Record<string, unknown> };
    expect(options.where).toEqual({ modelType: "OPPORTUNITY_SCORE", isActive: true });
  });
});
