import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
} from "sequelize";

import type { UserId } from "../../auth/user-types";
import type {
  AnalysisConfidenceLevel,
  AnalysisRiskLevel,
  AnalysisScoreStatus,
} from "../../scoring/persistence-types";
import {
  ANALYSIS_CONFIDENCE_LEVELS,
  ANALYSIS_RISK_LEVELS,
  ANALYSIS_SCORE_STATUSES,
} from "../../scoring/persistence-types";
import type { DatasetVersion } from "./dataset-version.model";
import type { Opportunity } from "./opportunity.model";
import type { ScoringModel } from "./scoring-model.model";
import type { User } from "./user.model";
import { getSequelize } from "../sequelize";

declare global {
  var __venturexUserOpportunityAnalysisModel: typeof UserOpportunityAnalysis | undefined;
}

function isPercentage(value: unknown): boolean {
  if (value === null) return true;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 && numericValue <= 100;
}

export class UserOpportunityAnalysis extends Model<
  InferAttributes<UserOpportunityAnalysis>,
  InferCreationAttributes<UserOpportunityAnalysis>
> {
  declare id: CreationOptional<string>;
  declare userId: UserId;
  declare opportunityId: string;
  declare datasetVersionId: string | null;
  declare scoringModelId: string | null;
  declare profileVersion: number;
  declare opportunityScore: string | null;
  declare fitScore: string | null;
  declare scoreStatus: AnalysisScoreStatus;
  declare riskLevel: AnalysisRiskLevel | null;
  declare confidenceLevel: AnalysisConfidenceLevel | null;
  declare opportunityScoreBreakdown: Record<string, unknown>;
  declare fitScoreBreakdown: Record<string, unknown>;
  declare riskReasons: unknown[];
  declare aiAnalysis: Record<string, unknown> | null;
  declare aiProvider: string | null;
  declare aiModel: string | null;
  declare generatedAt: Date;
  declare createdAt: Date;
  declare user: NonAttribute<User> | undefined;
  declare opportunity: NonAttribute<Opportunity> | undefined;
  declare datasetVersion: NonAttribute<DatasetVersion> | undefined;
  declare scoringModel: NonAttribute<ScoringModel> | undefined;
}

export function getUserOpportunityAnalysisModel(): typeof UserOpportunityAnalysis {
  if (globalThis.__venturexUserOpportunityAnalysisModel) {
    return globalThis.__venturexUserOpportunityAnalysisModel;
  }

  UserOpportunityAnalysis.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false, field: "user_id" },
      opportunityId: { type: DataTypes.UUID, allowNull: false, field: "opportunity_id" },
      datasetVersionId: { type: DataTypes.UUID, allowNull: true, field: "dataset_version_id" },
      scoringModelId: { type: DataTypes.UUID, allowNull: true, field: "scoring_model_id" },
      profileVersion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "profile_version",
        validate: { min: 1, isInt: true },
      },
      opportunityScore: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        field: "opportunity_score",
        validate: {
          isValidOpportunityScore(value: unknown) {
            if (!isPercentage(value)) throw new Error("Opportunity score must be between 0 and 100.");
          },
        },
      },
      fitScore: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        field: "fit_score",
        validate: {
          isValidFitScore(value: unknown) {
            if (!isPercentage(value)) throw new Error("Fit score must be between 0 and 100.");
          },
        },
      },
      scoreStatus: {
        type: DataTypes.STRING(32),
        allowNull: false,
        field: "score_status",
        validate: { isIn: [[...ANALYSIS_SCORE_STATUSES]] },
      },
      riskLevel: {
        type: DataTypes.STRING(16),
        allowNull: true,
        field: "risk_level",
        validate: { isIn: [[...ANALYSIS_RISK_LEVELS]] },
      },
      confidenceLevel: {
        type: DataTypes.STRING(16),
        allowNull: true,
        field: "confidence_level",
        validate: { isIn: [[...ANALYSIS_CONFIDENCE_LEVELS]] },
      },
      opportunityScoreBreakdown: {
        type: DataTypes.JSONB,
        allowNull: false,
        field: "opportunity_score_breakdown",
      },
      fitScoreBreakdown: {
        type: DataTypes.JSONB,
        allowNull: false,
        field: "fit_score_breakdown",
      },
      riskReasons: { type: DataTypes.JSONB, allowNull: false, field: "risk_reasons" },
      aiAnalysis: { type: DataTypes.JSONB, allowNull: true, field: "ai_analysis" },
      aiProvider: { type: DataTypes.STRING(80), allowNull: true, field: "ai_provider" },
      aiModel: { type: DataTypes.STRING(120), allowNull: true, field: "ai_model" },
      generatedAt: { type: DataTypes.DATE, allowNull: false, field: "generated_at" },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: "created_at" },
    },
    {
      sequelize: getSequelize(),
      tableName: "user_opportunity_analyses",
      timestamps: false,
      underscored: true,
      indexes: [
        {
          name: "user_opportunity_analyses_user_opportunity_generated_at_idx",
          fields: ["userId", "opportunityId", { name: "generatedAt", order: "DESC" }],
        },
        {
          name: "user_opportunity_analyses_user_generated_at_idx",
          fields: ["userId", { name: "generatedAt", order: "DESC" }],
        },
        { name: "user_opportunity_analyses_opportunity_id_idx", fields: ["opportunityId"] },
        { name: "user_opportunity_analyses_dataset_version_id_idx", fields: ["datasetVersionId"] },
        { name: "user_opportunity_analyses_scoring_model_id_idx", fields: ["scoringModelId"] },
      ],
      validate: {
        hasReasonWhenRiskIsSet(this: UserOpportunityAnalysis) {
          if (this.riskLevel !== null && (!Array.isArray(this.riskReasons) || this.riskReasons.length === 0)) {
            throw new Error("Risk requires at least one reason.");
          }
        },
      },
    },
  );

  globalThis.__venturexUserOpportunityAnalysisModel = UserOpportunityAnalysis;
  return UserOpportunityAnalysis;
}
