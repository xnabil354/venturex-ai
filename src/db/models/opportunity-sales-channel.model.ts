import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
} from "sequelize";

import { getSequelize } from "../sequelize";

declare global {
  var __venturexOpportunitySalesChannelModel: typeof OpportunitySalesChannel | undefined;
}

export class OpportunitySalesChannel extends Model<
  InferAttributes<OpportunitySalesChannel>,
  InferCreationAttributes<OpportunitySalesChannel>
> {
  declare opportunityId: string;
  declare salesChannelId: string;
}

export function getOpportunitySalesChannelModel(): typeof OpportunitySalesChannel {
  if (globalThis.__venturexOpportunitySalesChannelModel) {
    return globalThis.__venturexOpportunitySalesChannelModel;
  }

  OpportunitySalesChannel.init(
    {
      opportunityId: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        field: "opportunity_id",
      },
      salesChannelId: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        field: "sales_channel_id",
      },
    },
    {
      sequelize: getSequelize(),
      tableName: "opportunity_sales_channels",
      timestamps: false,
      underscored: true,
    },
  );

  globalThis.__venturexOpportunitySalesChannelModel = OpportunitySalesChannel;
  return OpportunitySalesChannel;
}
