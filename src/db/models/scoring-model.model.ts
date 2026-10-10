import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
} from "sequelize";

import type { UserOpportunityAnalysis } from "./user-opportunity-analysis.model";
import type { ScoringModelType } from "../../scoring/persistence-types";
import { SCORING_MODEL_TYPES } from "../../scoring/persistence-types";
import { getSequelize } from "../sequelize";

declare global {
  var __venturexScoringModel: typeof ScoringModel | undefined;
}

export class ScoringModel extends Model<
  InferAttributes<ScoringModel>,
  InferCreationAttributes<ScoringModel>
> {
  declare id: CreationOptional<string>;
  declare modelType: ScoringModelType;
  declare version: string;
  declare weights: Record<string, unknown>;
  declare configuration: CreationOptional<Record<string, unknown>>;
  declare isActive: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare analyses: NonAttribute<UserOpportunityAnalysis[]> | undefined;
}

export function getScoringModel(): typeof ScoringModel {
  if (globalThis.__venturexScoringModel) return globalThis.__venturexScoringModel;

  ScoringModel.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      modelType: {
        type: DataTypes.STRING(40),
        allowNull: false,
        field: "model_type",
        validate: { isIn: [[...SCORING_MODEL_TYPES]] },
      },
      version: { type: DataTypes.STRING(40), allowNull: false },
      weights: { type: DataTypes.JSONB, allowNull: false },
      configuration: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "is_active",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize: getSequelize(),
      tableName: "scoring_models",
      timestamps: false,
      underscored: true,
      indexes: [{
        unique: true,
        name: "uq_scoring_models_type_version",
        fields: ["modelType", "version"],
      }],
    },
  );

  globalThis.__venturexScoringModel = ScoringModel;
  return ScoringModel;
}
