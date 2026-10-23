import "server-only";

import { Op } from "sequelize";

import type { UserType } from "../auth/user-types";
import { getOpportunityModel, type Opportunity } from "../db/models/opportunity.model";
import { getScoringModel, type ScoringModel } from "../db/models/scoring-model.model";
import { getTrendModel, type Trend } from "../db/models/trend.model";

export type ActiveOpportunityScoreModelRecord = {
  readonly id: string;
  readonly version: string;
  readonly weights: unknown;
  readonly configuration: unknown;
  readonly isActive: boolean;
};

export type OpportunityScoreSourceRecord = {
  readonly id: string;
  readonly executionFeasibility: string | null;
  readonly marketSustainability: string | null;
  readonly relatedTrend: {
    readonly lifecycleState: string;
    readonly affectedUserTypes: readonly string[];
  };
};

export interface OpportunityScoreRepositoryPort {
  findActiveModels(): Promise<readonly ActiveOpportunityScoreModelRecord[]>;
  findVisibleSources(
    userType: UserType,
    opportunityIds: readonly string[],
  ): Promise<readonly OpportunityScoreSourceRecord[]>;
}

export class OpportunityScoreRepository implements OpportunityScoreRepositoryPort {
  private readonly opportunityModel: typeof Opportunity;
  private readonly trendModel: typeof Trend;
  private readonly scoringModel: typeof ScoringModel;

  constructor(
    opportunityModel: typeof Opportunity = getOpportunityModel(),
    trendModel: typeof Trend = getTrendModel(),
    scoringModel: typeof ScoringModel = getScoringModel(),
  ) {
    this.opportunityModel = opportunityModel;
    this.trendModel = trendModel;
    this.scoringModel = scoringModel;

    if (!this.opportunityModel.associations.relatedTrend) {
      this.opportunityModel.belongsTo(this.trendModel, {
        as: "relatedTrend",
        foreignKey: "relatedTrendId",
      });
    }
  }

  async findActiveModels(): Promise<readonly ActiveOpportunityScoreModelRecord[]> {
    const models = await this.scoringModel.findAll({
      where: { modelType: "OPPORTUNITY_SCORE", isActive: true },
      attributes: ["id", "version", "weights", "configuration", "isActive"],
      order: [["createdAt", "DESC"], ["id", "ASC"]],
    });

    return models.map((model) => ({
      id: model.id,
      version: model.version,
      weights: model.weights,
      configuration: model.configuration,
      isActive: model.isActive,
    }));
  }

  async findVisibleSources(
    userType: UserType,
    opportunityIds: readonly string[],
  ): Promise<readonly OpportunityScoreSourceRecord[]> {
    if (opportunityIds.length === 0) return [];

    const opportunities = await this.opportunityModel.findAll({
      where: { id: { [Op.in]: [...opportunityIds] } },
      attributes: ["id", "executionFeasibility", "marketSustainability"],
      include: [{
        model: this.trendModel,
        as: "relatedTrend",
        attributes: ["id", "lifecycleState", "affectedUserTypes"],
        required: true,
        where: {
          lifecycleState: "PUBLISHED",
          affectedUserTypes: { [Op.contains]: [userType] },
        },
      }],
    });

    return opportunities.map((opportunity) => {
      const trend = opportunity.relatedTrend;
      if (!trend) throw new Error("Opportunity Score eligibility could not be verified.");
      return {
        id: opportunity.id,
        executionFeasibility: opportunity.executionFeasibility,
        marketSustainability: opportunity.marketSustainability,
        relatedTrend: {
          lifecycleState: trend.lifecycleState,
          affectedUserTypes: [...trend.affectedUserTypes],
        },
      };
    });
  }
}
