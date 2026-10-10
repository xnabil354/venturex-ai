import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
} from "sequelize";

import type { Trend } from "./trend.model";
import type { OpportunityEvidence } from "./evidence.model";
import type { SavedOpportunity } from "./saved-opportunity.model";
import type { UserOpportunityAnalysis } from "./user-opportunity-analysis.model";
import type { OpportunityFitRequirement } from "./opportunity-fit-requirement.model";
import { getSequelize } from "../sequelize";
import type { FnbCategory } from "../../reference/fnb-category.model";
import type { CustomerSegment } from "../../reference/customer-segment.model";
import type { SalesChannel } from "../../reference/sales-channel.model";

declare global {
  var __venturexOpportunityModel: typeof Opportunity | undefined;
}

export class Opportunity extends Model<
  InferAttributes<Opportunity>,
  InferCreationAttributes<Opportunity>
> {
  declare id: CreationOptional<string>;
  declare relatedTrendId: string;
  declare fnbCategoryId: string;
  declare name: string;
  declare description: string;
  declare opportunityType: string;
  declare targetConsumerSummary: string | null;
  declare competitionLevel: string | null;
  declare competitionSummary: string | null;
  declare executionFeasibility: string | null;
  declare marketSustainability: string | null;
  declare additionalAttributes: Record<string, unknown>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare category: NonAttribute<FnbCategory> | undefined;
  declare relatedTrend: NonAttribute<Trend> | undefined;
  declare evidences: NonAttribute<OpportunityEvidence[]> | undefined;
  declare savedOpportunities: NonAttribute<SavedOpportunity[]> | undefined;
  declare analyses: NonAttribute<UserOpportunityAnalysis[]> | undefined;
  declare fitRequirements: NonAttribute<OpportunityFitRequirement | null> | undefined;
  declare fitCustomerSegments: NonAttribute<CustomerSegment[]> | undefined;
  declare fitSalesChannels: NonAttribute<SalesChannel[]> | undefined;
}

export function getOpportunityModel(): typeof Opportunity {
  if (globalThis.__venturexOpportunityModel) return globalThis.__venturexOpportunityModel;

  Opportunity.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      relatedTrendId: { type: DataTypes.UUID, allowNull: false, field: "related_trend_id" },
      fnbCategoryId: { type: DataTypes.UUID, allowNull: false, field: "fnb_category_id" },
      name: { type: DataTypes.STRING(180), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: false },
      opportunityType: { type: DataTypes.STRING(40), allowNull: false, field: "opportunity_type" },
      targetConsumerSummary: { type: DataTypes.TEXT, allowNull: true, field: "target_consumer_summary" },
      competitionLevel: { type: DataTypes.STRING(32), allowNull: true, field: "competition_level" },
      competitionSummary: { type: DataTypes.TEXT, allowNull: true, field: "competition_summary" },
      executionFeasibility: { type: DataTypes.DECIMAL(5, 2), allowNull: true, field: "execution_feasibility" },
      marketSustainability: { type: DataTypes.DECIMAL(5, 2), allowNull: true, field: "market_sustainability" },
      additionalAttributes: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
        field: "additional_attributes",
      },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: "updated_at" },
    },
    {
      sequelize: getSequelize(),
      tableName: "opportunities",
      timestamps: true,
      underscored: true,
    },
  );

  globalThis.__venturexOpportunityModel = Opportunity;
  return Opportunity;
}
