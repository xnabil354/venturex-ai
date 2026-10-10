import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from "sequelize";

import type { UserId } from "../auth/user-types";
import { getSequelize } from "../db/sequelize";

declare global {
  var __venturexEntrepreneurProfileModel: typeof EntrepreneurProfile | undefined;
}

export class EntrepreneurProfile extends Model<
  InferAttributes<EntrepreneurProfile>,
  InferCreationAttributes<EntrepreneurProfile>
> {
  declare id: CreationOptional<string>;
  declare userId: UserId;
  declare locationText: string;
  declare city: string | null;
  declare province: string | null;
  declare countryCode: string;
  declare budgetMin: number;
  declare budgetMax: number;
  declare experienceLevel: string;
  declare timeCommitment: string;
  declare preferredProductType: string | null;
  declare businessObjective: string | null;
  declare notes: string | null;
  declare profileVersion: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function getEntrepreneurProfileModel(): typeof EntrepreneurProfile {
  if (globalThis.__venturexEntrepreneurProfileModel) {
    return globalThis.__venturexEntrepreneurProfileModel;
  }

  EntrepreneurProfile.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false, field: "user_id" },
      locationText: { type: DataTypes.STRING(255), allowNull: false, field: "location_text" },
      city: { type: DataTypes.STRING(120), allowNull: true },
      province: { type: DataTypes.STRING(120), allowNull: true },
      countryCode: { type: DataTypes.STRING(2), allowNull: false, defaultValue: "ID", field: "country_code" },
      budgetMin: { type: DataTypes.BIGINT, allowNull: false, field: "budget_min" },
      budgetMax: { type: DataTypes.BIGINT, allowNull: false, field: "budget_max" },
      experienceLevel: { type: DataTypes.STRING(32), allowNull: false, field: "experience_level" },
      timeCommitment: { type: DataTypes.STRING(32), allowNull: false, field: "time_commitment" },
      preferredProductType: { type: DataTypes.STRING(100), allowNull: true, field: "preferred_product_type" },
      businessObjective: { type: DataTypes.TEXT, allowNull: true, field: "business_objective" },
      notes: { type: DataTypes.TEXT, allowNull: true },
      profileVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: "profile_version" },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: "updated_at" },
    },
    { sequelize: getSequelize(), tableName: "entrepreneur_profiles", timestamps: true, underscored: true },
  );

  globalThis.__venturexEntrepreneurProfileModel = EntrepreneurProfile;
  return EntrepreneurProfile;
}
