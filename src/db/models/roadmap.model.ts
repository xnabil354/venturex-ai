import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
} from "sequelize";

import type { Opportunity } from "./opportunity.model";
import type { UserOpportunityAnalysis } from "./user-opportunity-analysis.model";
import type { RoadmapStep } from "./roadmap-step.model";
import type { User } from "./user.model";
import { getSequelize } from "../sequelize";
import type { RoadmapGenerationContext } from "../../roadmap/domain";

declare global {
  var __venturexRoadmapModel: typeof Roadmap | undefined;
}

export class Roadmap extends Model<InferAttributes<Roadmap>, InferCreationAttributes<Roadmap>> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare opportunityId: string;
  declare userOpportunityAnalysisId: string | null;
  declare roadmapType: "STARTUP" | "GROWTH";
  declare generationContext: RoadmapGenerationContext;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare user: NonAttribute<User> | undefined;
  declare opportunity: NonAttribute<Opportunity> | undefined;
  declare analysis: NonAttribute<UserOpportunityAnalysis> | undefined;
  declare steps: NonAttribute<RoadmapStep[]> | undefined;
}

export function getRoadmapModel(): typeof Roadmap {
  if (globalThis.__venturexRoadmapModel) return globalThis.__venturexRoadmapModel;
  Roadmap.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, field: "user_id" },
    opportunityId: { type: DataTypes.UUID, allowNull: false, field: "opportunity_id" },
    userOpportunityAnalysisId: { type: DataTypes.UUID, allowNull: true, field: "user_opportunity_analysis_id" },
    roadmapType: { type: DataTypes.STRING(16), allowNull: false, field: "roadmap_type", validate: { isIn: [["STARTUP", "GROWTH"]] } },
    generationContext: { type: DataTypes.JSONB, allowNull: false, field: "generation_context" },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: "updated_at" },
  }, {
    sequelize: getSequelize(),
    tableName: "roadmaps",
    timestamps: true,
    underscored: true,
    indexes: [
      { name: "roadmaps_user_created_at_idx", fields: ["userId", { name: "createdAt", order: "DESC" }] },
      { name: "roadmaps_opportunity_id_idx", fields: ["opportunityId"] },
      { name: "roadmaps_user_opportunity_analysis_id_idx", fields: ["userOpportunityAnalysisId"] },
    ],
  });
  globalThis.__venturexRoadmapModel = Roadmap;
  return Roadmap;
}
