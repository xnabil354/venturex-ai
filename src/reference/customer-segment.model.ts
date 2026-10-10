import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from "sequelize";

import { getSequelize } from "../db/sequelize";

declare global {
  var __venturexCustomerSegmentModel: typeof CustomerSegment | undefined;
}

export class CustomerSegment extends Model<
  InferAttributes<CustomerSegment>,
  InferCreationAttributes<CustomerSegment>
> {
  declare id: CreationOptional<string>;
  declare code: string;
  declare name: string;
  declare description: string | null;
  declare isActive: boolean;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function getCustomerSegmentModel(): typeof CustomerSegment {
  if (globalThis.__venturexCustomerSegmentModel) {
    return globalThis.__venturexCustomerSegmentModel;
  }

  CustomerSegment.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      code: { type: DataTypes.STRING(64), allowNull: false },
      name: { type: DataTypes.STRING(120), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_active" },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: "updated_at" },
    },
    { sequelize: getSequelize(), tableName: "customer_segments", timestamps: true, underscored: true },
  );

  globalThis.__venturexCustomerSegmentModel = CustomerSegment;
  return CustomerSegment;
}
