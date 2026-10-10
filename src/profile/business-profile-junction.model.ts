import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
} from "sequelize";

import { getSequelize } from "../db/sequelize";

declare global {
  var __venturexBusinessProfileCustomerSegmentModel:
    | typeof BusinessProfileCustomerSegment
    | undefined;
  var __venturexBusinessProfileSalesChannelModel:
    | typeof BusinessProfileSalesChannel
    | undefined;
}

export class BusinessProfileCustomerSegment extends Model<
  InferAttributes<BusinessProfileCustomerSegment>,
  InferCreationAttributes<BusinessProfileCustomerSegment>
> {
  declare businessProfileId: string;
  declare customerSegmentId: string;
}

export class BusinessProfileSalesChannel extends Model<
  InferAttributes<BusinessProfileSalesChannel>,
  InferCreationAttributes<BusinessProfileSalesChannel>
> {
  declare businessProfileId: string;
  declare salesChannelId: string;
}

export function getBusinessProfileCustomerSegmentModel():
  typeof BusinessProfileCustomerSegment {
  if (globalThis.__venturexBusinessProfileCustomerSegmentModel) {
    return globalThis.__venturexBusinessProfileCustomerSegmentModel;
  }

  BusinessProfileCustomerSegment.init(
    {
      businessProfileId: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        field: "business_profile_id",
      },
      customerSegmentId: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        field: "customer_segment_id",
      },
    },
    {
      sequelize: getSequelize(),
      tableName: "business_profile_customer_segments",
      timestamps: false,
      underscored: true,
    },
  );
  globalThis.__venturexBusinessProfileCustomerSegmentModel = BusinessProfileCustomerSegment;
  return BusinessProfileCustomerSegment;
}

export function getBusinessProfileSalesChannelModel():
  typeof BusinessProfileSalesChannel {
  if (globalThis.__venturexBusinessProfileSalesChannelModel) {
    return globalThis.__venturexBusinessProfileSalesChannelModel;
  }

  BusinessProfileSalesChannel.init(
    {
      businessProfileId: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        field: "business_profile_id",
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
      tableName: "business_profile_sales_channels",
      timestamps: false,
      underscored: true,
    },
  );
  globalThis.__venturexBusinessProfileSalesChannelModel = BusinessProfileSalesChannel;
  return BusinessProfileSalesChannel;
}
