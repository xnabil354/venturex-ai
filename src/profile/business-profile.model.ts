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
  var __venturexBusinessProfileModel: typeof BusinessProfile | undefined;
}

export class BusinessProfile extends Model<
  InferAttributes<BusinessProfile>,
  InferCreationAttributes<BusinessProfile>
> {
  declare id: CreationOptional<string>;
  declare userId: UserId;
  declare businessName: string;
  declare businessCategoryId: string;
  declare locationText: string;
  declare city: string | null;
  declare province: string | null;
  declare countryCode: string;
  declare averagePriceMin: number;
  declare averagePriceMax: number;
  declare businessDescription: string | null;
  declare operationModel: string | null;
  declare notes: string | null;
  declare profileVersion: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function getBusinessProfileModel(): typeof BusinessProfile {
  if (globalThis.__venturexBusinessProfileModel) {
    return globalThis.__venturexBusinessProfileModel;
  }

  BusinessProfile.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false, field: "user_id" },
      businessName: { type: DataTypes.STRING(180), allowNull: false, field: "business_name" },
      businessCategoryId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "business_category_id",
      },
      locationText: { type: DataTypes.STRING(255), allowNull: false, field: "location_text" },
      city: { type: DataTypes.STRING(120), allowNull: true },
      province: { type: DataTypes.STRING(120), allowNull: true },
      countryCode: {
        type: DataTypes.CHAR(2),
        allowNull: false,
        defaultValue: "ID",
        field: "country_code",
      },
      averagePriceMin: { type: DataTypes.BIGINT, allowNull: false, field: "average_price_min" },
      averagePriceMax: { type: DataTypes.BIGINT, allowNull: false, field: "average_price_max" },
      businessDescription: { type: DataTypes.TEXT, allowNull: true, field: "business_description" },
      operationModel: { type: DataTypes.STRING(100), allowNull: true, field: "operation_model" },
      notes: { type: DataTypes.TEXT, allowNull: true },
      profileVersion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        field: "profile_version",
      },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: "updated_at" },
    },
    {
      sequelize: getSequelize(),
      tableName: "business_profiles",
      timestamps: true,
      underscored: true,
    },
  );

  globalThis.__venturexBusinessProfileModel = BusinessProfile;
  return BusinessProfile;
}
