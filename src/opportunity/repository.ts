import { Op, type Transaction } from "sequelize";

import { getOpportunityModel, type Opportunity } from "../db/models/opportunity.model";
import { getTrendModel, type Trend } from "../db/models/trend.model";
import { getFnbCategoryModel, type FnbCategory } from "../reference/fnb-category.model";
import type { UserType } from "../auth/user-types";
import type {
  OpportunityDetailRecord,
  OpportunityFitInputOpportunityRecord,
  OpportunityCategoryOption,
  OpportunityPageRequest,
  OpportunityRecord,
} from "./domain";

export interface OpportunityRepositoryPort {
  listActiveCategories(): Promise<readonly OpportunityCategoryOption[]>;
  countVisible(userType: UserType, categoryCode?: string): Promise<number>;
  listVisible(
    userType: UserType,
    page: OpportunityPageRequest,
    categoryCode?: string,
  ): Promise<readonly OpportunityRecord[]>;
  listVisibleForTrend(
    userType: UserType,
    relatedTrendId: string,
  ): Promise<readonly OpportunityRecord[]>;
  findVisibleById(userType: UserType, id: string): Promise<OpportunityDetailRecord | null>;
}

function toOpportunityRecord(opportunity: Opportunity): OpportunityRecord {
  const category = opportunity.category;
  const trend = opportunity.relatedTrend;
  if (!category || !trend) {
    throw new Error("Opportunity catalog associations could not be loaded.");
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

function toOpportunityDetailRecord(opportunity: Opportunity): OpportunityDetailRecord {
  return {
    ...toOpportunityRecord(opportunity),
    opportunityType: opportunity.opportunityType,
    targetConsumerSummary: opportunity.targetConsumerSummary,
    competitionLevel: opportunity.competitionLevel,
    competitionSummary: opportunity.competitionSummary,
  };
}

export class OpportunityRepository implements OpportunityRepositoryPort {
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

  async listActiveCategories(): Promise<readonly OpportunityCategoryOption[]> {
    const categories = await this.categoryModel.findAll({
      where: { isActive: true },
      attributes: ["code", "name"],
      order: [["code", "ASC"]],
    });
    return categories.map(({ code, name }) => ({ code, name }));
  }

  async countVisible(userType: UserType, categoryCode?: string): Promise<number> {
    return this.opportunityModel.count({
      include: this.visibleIncludes(userType, categoryCode),
      distinct: true,
      col: "id",
    });
  }

  async listVisible(
    userType: UserType,
    page: OpportunityPageRequest,
    categoryCode?: string,
  ): Promise<readonly OpportunityRecord[]> {
    const opportunities = await this.opportunityModel.findAll({
      attributes: ["id", "name", "description"],
      include: this.visibleIncludes(userType, categoryCode),
      order: [["createdAt", "DESC"], ["id", "ASC"]],
      limit: page.limit,
      offset: page.offset,
    });
    return opportunities.map(toOpportunityRecord);
  }

  async listVisibleForTrend(
    userType: UserType,
    relatedTrendId: string,
  ): Promise<readonly OpportunityRecord[]> {
    const opportunities = await this.opportunityModel.findAll({
      where: { relatedTrendId },
      attributes: ["id", "name", "description"],
      include: this.visibleIncludes(userType),
      order: [["createdAt", "DESC"], ["id", "ASC"]],
    });
    return opportunities.map(toOpportunityRecord);
  }

  async findVisibleById(userType: UserType, id: string): Promise<OpportunityDetailRecord | null> {
    const opportunity = await this.opportunityModel.findOne({
      where: { id },
      attributes: [
        "id",
        "name",
        "description",
        "opportunityType",
        "targetConsumerSummary",
        "competitionLevel",
        "competitionSummary",
      ],
      include: this.visibleIncludes(userType),
    });
    return opportunity ? toOpportunityDetailRecord(opportunity) : null;
  }

  async findVisibleForFitInput(
    userType: UserType,
    id: string,
    transaction?: Transaction,
  ): Promise<OpportunityFitInputOpportunityRecord | null> {
    const opportunity = await this.opportunityModel.findOne({
      where: { id },
      attributes: ["id", "fnbCategoryId"],
      include: this.visibleIncludes(userType),
      ...(transaction ? { transaction } : {}),
    });
    if (!opportunity) return null;

    const trend = opportunity.relatedTrend;
    if (!trend) throw new Error("Opportunity eligibility could not be verified.");

    return {
      id: opportunity.id,
      fnbCategoryId: opportunity.fnbCategoryId,
      relatedTrend: {
        id: trend.id,
        lifecycleState: trend.lifecycleState,
        affectedUserTypes: [...trend.affectedUserTypes],
      },
    };
  }

  private visibleIncludes(userType: UserType, categoryCode?: string) {
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
        ...(categoryCode ? { where: { code: categoryCode, isActive: true } } : {}),
      },
    ];
  }
}
