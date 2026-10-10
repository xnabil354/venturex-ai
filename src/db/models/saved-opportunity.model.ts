import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
} from "sequelize";

import type { Opportunity } from "./opportunity.model";
import { getSequelize } from "../sequelize";

declare global {
  var __venturexSavedOpportunityModel: typeof SavedOpportunity | undefined;
}

export class SavedOpportunity extends Model<
  InferAttributes<SavedOpportunity>,
  InferCreationAttributes<SavedOpportunity>
> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare opportunityId: string;
  declare createdAt: CreationOptional<Date>;
  declare opportunity: NonAttribute<Opportunity> | undefined;
}

export function getSavedOpportunityModel(): typeof SavedOpportunity {
  if (globalThis.__venturexSavedOpportunityModel) {
    return globalThis.__venturexSavedOpportunityModel;
  }

  SavedOpportunity.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false, field: "user_id" },
      opportunityId: { type: DataTypes.UUID, allowNull: false, field: "opportunity_id" },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize: getSequelize(),
      tableName: "saved_opportunities",
      timestamps: false,
      underscored: true,
    },
  );

  globalThis.__venturexSavedOpportunityModel = SavedOpportunity;
  return SavedOpportunity;
}
