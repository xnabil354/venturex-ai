import { Op, UniqueConstraintError } from "sequelize";

import type { UserId, UserType } from "../auth/user-types";
import { getOpportunityModel, type Opportunity } from "../db/models/opportunity.model";
import { getSavedOpportunityModel, type SavedOpportunity } from "../db/models/saved-opportunity.model";
import { getTrendModel, type Trend } from "../db/models/trend.model";
import { getFnbCategoryModel, type FnbCategory } from "../reference/fnb-category.model";
import type { OpportunityId, OpportunityRecord } from "./domain";

export interface SavedOpportunityRepositoryPort {
  listVisibleForUser(
    userId: UserId,
    userType: UserType,
    limit?: number,
  ): Promise<readonly OpportunityRecord[]>;
  getVisibleSavedState(
    userId: UserId,
    userType: UserType,
    opportunityId: OpportunityId,
  ): Promise<boolean | null>;
  saveVisibleForUser(
    userId: UserId,
    userType: UserType,
    opportunityId: OpportunityId,
  ): Promise<boolean | null>;
  removeVisibleForUser(
    userId: UserId,
    userType: UserType,
    opportunityId: OpportunityId,
  ): Promise<boolean | null>;
}

function toOpportunityRecord(opportunity: Opportunity): OpportunityRecord {
  const category = opportunity.category;
  const trend = opportunity.relatedTrend;
  if (!category || !trend) {
    throw new Error("Saved Opportunity associations could not be loaded.");
  }

  return {
    id: opportunity.id,
    name: opportunity.name,
    description: opportunity.description,
    categoryName: category.name,
    relatedTrend: {
      id: trend.id,
      title: trend.title,
      lifecycleState: trend.lifecycleState,
      affectedUserTypes: [...trend.affectedUserTypes],
    },
  };
}

export class SavedOpportunityRepository implements SavedOpportunityRepositoryPort {
  private readonly savedModel: typeof SavedOpportunity;
  private readonly opportunityModel: typeof Opportunity;
  private readonly trendModel: typeof Trend;
  private readonly categoryModel: typeof FnbCategory;

  constructor(
    savedModel: typeof SavedOpportunity = getSavedOpportunityModel(),
    opportunityModel: typeof Opportunity = getOpportunityModel(),
    trendModel: typeof Trend = getTrendModel(),
    categoryModel: typeof FnbCategory = getFnbCategoryModel(),
  ) {
    this.savedModel = savedModel;
    this.opportunityModel = opportunityModel;
    this.trendModel = trendModel;
    this.categoryModel = categoryModel;

    if (!this.savedModel.associations.opportunity) {
      this.savedModel.belongsTo(this.opportunityModel, {
        as: "opportunity",
        foreignKey: "opportunityId",
      });
    }
    if (!this.opportunityModel.associations.savedOpportunities) {
      this.opportunityModel.hasMany(this.savedModel, {
        as: "savedOpportunities",
        foreignKey: "opportunityId",
      });
    }
    if (!this.opportunityModel.associations.relatedTrend) {
      this.opportunityModel.belongsTo(this.trendModel, {
        as: "relatedTrend",
        foreignKey: "relatedTrendId",
      });
    }
    if (!this.opportunityModel.associations.category) {
      this.opportunityModel.belongsTo(this.categoryModel, {
        as: "category",
        foreignKey: "fnbCategoryId",
      });
    }
  }

  async listVisibleForUser(
    userId: UserId,
    userType: UserType,
    limit?: number,
  ): Promise<readonly OpportunityRecord[]> {
    const saved = await this.savedModel.findAll({
      where: { userId },
      attributes: ["id"],
      include: [
        {
          model: this.opportunityModel,
          as: "opportunity",
          attributes: ["id", "name", "description"],
          required: true,
          include: this.eligibleOpportunityIncludes(userType),
        },
      ],
      order: [["createdAt", "DESC"], ["id", "ASC"]],
      ...(limit === undefined ? {} : { limit }),
    });

    return saved.map((relation) => {
      if (!relation.opportunity) {
        throw new Error("A saved Opportunity could not be loaded.");
      }
      return toOpportunityRecord(relation.opportunity);
    });
  }

  async getVisibleSavedState(
    userId: UserId,
    userType: UserType,
    opportunityId: OpportunityId,
  ): Promise<boolean | null> {
    const opportunity = await this.opportunityModel.findOne({
      where: { id: opportunityId },
      attributes: ["id"],
      include: [
        ...this.eligibleOpportunityIncludes(userType),
        {
          model: this.savedModel,
          as: "savedOpportunities",
          attributes: ["id"],
          where: { userId },
          required: false,
        },
      ],
    });
    if (!opportunity) return null;
    return (opportunity.savedOpportunities ?? []).length > 0;
  }

  async saveVisibleForUser(
    userId: UserId,
    userType: UserType,
    opportunityId: OpportunityId,
  ): Promise<boolean | null> {
    if (!(await this.isVisible(userType, opportunityId))) return null;

    const where = { userId, opportunityId };
    try {
      await this.savedModel.findOrCreate({
        where,
        defaults: where,
      });
    } catch (error) {
      if (!(error instanceof UniqueConstraintError)) throw error;
      const existing = await this.savedModel.findOne({ where });
      if (!existing) throw error;
    }

    return true;
  }

  async removeVisibleForUser(
    userId: UserId,
    userType: UserType,
    opportunityId: OpportunityId,
  ): Promise<boolean | null> {
    if (!(await this.isVisible(userType, opportunityId))) return null;

    await this.savedModel.destroy({ where: { userId, opportunityId } });
    return false;
  }

  private async isVisible(userType: UserType, opportunityId: OpportunityId): Promise<boolean> {
    const opportunity = await this.opportunityModel.findOne({
      where: { id: opportunityId },
      attributes: ["id"],
      include: this.eligibleOpportunityIncludes(userType),
    });
    return opportunity !== null;
  }

  private eligibleOpportunityIncludes(userType: UserType) {
    return [
      {
        model: this.trendModel,
        as: "relatedTrend",
        attributes: ["id", "title", "lifecycleState", "affectedUserTypes"],
        required: true,
        where: {
          lifecycleState: "PUBLISHED",
          affectedUserTypes: { [Op.contains]: [userType] },
        },
      },
      {
        model: this.categoryModel,
        as: "category",
        attributes: ["id", "name"],
        required: true,
      },
    ];
  }
}
