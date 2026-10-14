import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from "sequelize";

import type { UserType } from "../../auth/user-types";
import type { PrivateOpportunityHypothesis, PrivateOpportunitySource } from "../../opportunity/private-hypothesis";
import { getSequelize } from "../sequelize";

declare global {
  var __venturexUserGeneratedOpportunityModel: typeof UserGeneratedOpportunity | undefined;
}

export class UserGeneratedOpportunity extends Model<
  InferAttributes<UserGeneratedOpportunity>,
  InferCreationAttributes<UserGeneratedOpportunity>
> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare userType: UserType;
  declare hypothesis: PrivateOpportunityHypothesis;
  declare sourceReference: PrivateOpportunitySource;
  declare provider: "ninerouter";
  declare model: string;
  declare generatedAt: Date;
  declare isSaved: boolean;
  declare savedAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function getUserGeneratedOpportunityModel(): typeof UserGeneratedOpportunity {
  if (globalThis.__venturexUserGeneratedOpportunityModel) {
    return globalThis.__venturexUserGeneratedOpportunityModel;
  }

  UserGeneratedOpportunity.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false, field: "user_id" },
      userType: {
        type: DataTypes.STRING(32),
        allowNull: false,
        field: "user_type",
        validate: { isIn: [["ENTREPRENEUR", "UMKM_EXISTING"]] },
      },
      hypothesis: { type: DataTypes.JSONB, allowNull: false },
      sourceReference: { type: DataTypes.JSONB, allowNull: false, field: "source_reference" },
      provider: { type: DataTypes.STRING(32), allowNull: false, defaultValue: "ninerouter" },
      model: { type: DataTypes.STRING(120), allowNull: false },
      generatedAt: { type: DataTypes.DATE, allowNull: false, field: "generated_at" },
      isSaved: { type: DataTypes.BOOLEAN, allowNull: false, field: "is_saved", defaultValue: false },
      savedAt: { type: DataTypes.DATE, allowNull: true, field: "saved_at" },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: "created_at", defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: "updated_at", defaultValue: DataTypes.NOW },
    },
    {
      sequelize: getSequelize(),
      tableName: "user_generated_opportunities",
      timestamps: false,
      underscored: true,
      indexes: [
        { name: "user_generated_opportunities_user_created_at_idx", fields: ["userId", { name: "createdAt", order: "DESC" }] },
        { name: "user_generated_opportunities_user_saved_created_at_idx", fields: ["userId", "isSaved", { name: "createdAt", order: "DESC" }] },
      ],
    },
  );

  globalThis.__venturexUserGeneratedOpportunityModel = UserGeneratedOpportunity;
  return UserGeneratedOpportunity;
}
