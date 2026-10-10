import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from "sequelize";

import { getSequelize } from "../db/sequelize";

declare global {
  var __venturexBusinessProductModel: typeof BusinessProduct | undefined;
}

export class BusinessProduct extends Model<
  InferAttributes<BusinessProduct>,
  InferCreationAttributes<BusinessProduct>
> {
  declare id: CreationOptional<string>;
  declare businessProfileId: string;
  declare name: string;
  declare fnbCategoryId: string | null;
  declare price: number | null;
  declare isActive: boolean;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function getBusinessProductModel(): typeof BusinessProduct {
  if (globalThis.__venturexBusinessProductModel) {
    return globalThis.__venturexBusinessProductModel;
  }

  BusinessProduct.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      businessProfileId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "business_profile_id",
      },
      name: { type: DataTypes.STRING(180), allowNull: false },
      fnbCategoryId: { type: DataTypes.UUID, allowNull: true, field: "fnb_category_id" },
      price: { type: DataTypes.BIGINT, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_active" },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: "updated_at" },
    },
    {
      sequelize: getSequelize(),
      tableName: "business_products",
      timestamps: true,
      underscored: true,
    },
  );

  globalThis.__venturexBusinessProductModel = BusinessProduct;
  return BusinessProduct;
}
