import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from "sequelize";

import { getSequelize } from "../db/sequelize";

declare global {
  var __venturexFnbCategoryModel: typeof FnbCategory | undefined;
}

export class FnbCategory extends Model<
  InferAttributes<FnbCategory>,
  InferCreationAttributes<FnbCategory>
> {
  declare id: CreationOptional<string>;
  declare code: string;
  declare name: string;
  declare parentId: string | null;
  declare isActive: boolean;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function getFnbCategoryModel(): typeof FnbCategory {
  if (globalThis.__venturexFnbCategoryModel) {
    return globalThis.__venturexFnbCategoryModel;
  }

  FnbCategory.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      code: { type: DataTypes.STRING(64), allowNull: false },
      name: { type: DataTypes.STRING(120), allowNull: false },
      parentId: { type: DataTypes.UUID, allowNull: true, field: "parent_id" },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_active" },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: "updated_at" },
    },
    { sequelize: getSequelize(), tableName: "fnb_categories", timestamps: true, underscored: true },
  );

  globalThis.__venturexFnbCategoryModel = FnbCategory;
  return FnbCategory;
}
