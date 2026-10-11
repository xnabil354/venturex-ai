import { Op } from "sequelize";

import type { UserType } from "../auth/user-types";
import { getOpportunityModel, type Opportunity } from "../db/models/opportunity.model";
import { getTrendModel, type Trend } from "../db/models/trend.model";
import { getFnbCategoryModel, type FnbCategory } from "../reference/fnb-category.model";
import type { OpportunityComparisonRepositoryPort, OpportunityComparisonSource } from "./compare-domain";

export class OpportunityComparisonRepository implements OpportunityComparisonRepositoryPort {
  private readonly opportunityModel: typeof Opportunity;
  private readonly trendModel: typeof Trend;
  private readonly categoryModel: typeof FnbCategory;

  constructor(
    opportunityModel: typeof Opportunity = getOpportunityModel(),
    trendModel: typeof Trend = getTrendModel(),
    categoryModel: typeof FnbCategory = getFnbCategoryModel(),
  ) {
    this.opportunityModel = opportunityModel;
    this.trendModel = trendModel;
    this.categoryModel = categoryModel;
    if (!this.opportunityModel.associations.relatedTrend) {
      this.opportunityModel.belongsTo(this.trendModel, { as: "relatedTrend", foreignKey: "relatedTrendId" });
    }
    if (!this.opportunityModel.associations.category) {
      this.opportunityModel.belongsTo(this.categoryModel, { as: "category", foreignKey: "fnbCategoryId" });
    }
  }

  async findEligibleForUser(userType: UserType, opportunityIds: readonly string[]): Promise<readonly OpportunityComparisonSource[]> {
    const opportunities = await this.opportunityModel.findAll({
      where: { id: { [Op.in]: [...opportunityIds] } },
      attributes: ["id", "name", "competitionLevel", "competitionSummary", "executionFeasibility"],
      include: [
        {
          model: this.trendModel,
          as: "relatedTrend",
          attributes: ["id", "title", "direction", "lifecycleState", "affectedUserTypes"],
          required: true,
          where: { lifecycleState: "PUBLISHED", affectedUserTypes: { [Op.contains]: [userType] } },
        },
        {
          model: this.categoryModel,
          as: "category",
          attributes: ["name"],
          required: true,
        },
      ],
    });

    return opportunities.map((opportunity) => {
      const trend = opportunity.relatedTrend;
      const category = opportunity.category;
      if (!trend || !category) throw new Error("Comparison eligibility could not be verified.");
      return {
        id: opportunity.id,
        name: opportunity.name,
        categoryName: category.name,
        competitionLevel: opportunity.competitionLevel,
        competitionSummary: opportunity.competitionSummary,
        executionFeasibility: opportunity.executionFeasibility,
        relatedTrend: {
          id: trend.id,
          title: trend.title,
          direction: trend.direction,
          lifecycleState: trend.lifecycleState,
          affectedUserTypes: [...trend.affectedUserTypes],
        },
      };
    });
  }
}
