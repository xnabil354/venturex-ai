import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from "sequelize";

import { getSequelize } from "../db/sequelize";

declare global {
  var __venturexSalesChannelModel: typeof SalesChannel | undefined;
}

export class SalesChannel extends Model<
  InferAttributes<SalesChannel>,
  InferCreationAttributes<SalesChannel>
> {
  declare id: CreationOptional<string>;
  declare code: string;
  declare name: string;
  declare isActive: boolean;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function getSalesChannelModel(): typeof SalesChannel {
  if (globalThis.__venturexSalesChannelModel) {
    return globalThis.__venturexSalesChannelModel;
  }

  SalesChannel.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      code: { type: DataTypes.STRING(64), allowNull: false },
      name: { type: DataTypes.STRING(120), allowNull: false },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_active" },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: "updated_at" },
    },
    { sequelize: getSequelize(), tableName: "sales_channels", timestamps: true, underscored: true },
  );

  globalThis.__venturexSalesChannelModel = SalesChannel;
  return SalesChannel;
}
