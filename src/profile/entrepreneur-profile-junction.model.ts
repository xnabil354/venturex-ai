import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
} from "sequelize";

import { getSequelize } from "../db/sequelize";

declare global {
  var __venturexEntrepreneurProfileInterestModel: typeof EntrepreneurProfileInterest | undefined;
  var __venturexEntrepreneurProfileCustomerSegmentModel: typeof EntrepreneurProfileCustomerSegment | undefined;
  var __venturexEntrepreneurProfileSalesChannelModel: typeof EntrepreneurProfileSalesChannel | undefined;
}

export class EntrepreneurProfileInterest extends Model<
  InferAttributes<EntrepreneurProfileInterest>,
  InferCreationAttributes<EntrepreneurProfileInterest>
> {
  declare entrepreneurProfileId: string;
  declare fnbCategoryId: string;
}

export class EntrepreneurProfileCustomerSegment extends Model<
  InferAttributes<EntrepreneurProfileCustomerSegment>,
  InferCreationAttributes<EntrepreneurProfileCustomerSegment>
> {
  declare entrepreneurProfileId: string;
  declare customerSegmentId: string;
}

export class EntrepreneurProfileSalesChannel extends Model<
  InferAttributes<EntrepreneurProfileSalesChannel>,
  InferCreationAttributes<EntrepreneurProfileSalesChannel>
> {
  declare entrepreneurProfileId: string;
  declare salesChannelId: string;
}

export function getEntrepreneurProfileInterestModel(): typeof EntrepreneurProfileInterest {
  if (globalThis.__venturexEntrepreneurProfileInterestModel) {
    return globalThis.__venturexEntrepreneurProfileInterestModel;
  }

  EntrepreneurProfileInterest.init(
    {
      entrepreneurProfileId: { type: DataTypes.UUID, allowNull: false, primaryKey: true, field: "entrepreneur_profile_id" },
      fnbCategoryId: { type: DataTypes.UUID, allowNull: false, primaryKey: true, field: "fnb_category_id" },
    },
    { sequelize: getSequelize(), tableName: "entrepreneur_profile_interests", timestamps: false, underscored: true },
  );
  globalThis.__venturexEntrepreneurProfileInterestModel = EntrepreneurProfileInterest;
  return EntrepreneurProfileInterest;
}

export function getEntrepreneurProfileCustomerSegmentModel(): typeof EntrepreneurProfileCustomerSegment {
  if (globalThis.__venturexEntrepreneurProfileCustomerSegmentModel) {
    return globalThis.__venturexEntrepreneurProfileCustomerSegmentModel;
  }

  EntrepreneurProfileCustomerSegment.init(
    {
      entrepreneurProfileId: { type: DataTypes.UUID, allowNull: false, primaryKey: true, field: "entrepreneur_profile_id" },
      customerSegmentId: { type: DataTypes.UUID, allowNull: false, primaryKey: true, field: "customer_segment_id" },
    },
    { sequelize: getSequelize(), tableName: "entrepreneur_profile_customer_segments", timestamps: false, underscored: true },
  );
  globalThis.__venturexEntrepreneurProfileCustomerSegmentModel = EntrepreneurProfileCustomerSegment;
  return EntrepreneurProfileCustomerSegment;
}

export function getEntrepreneurProfileSalesChannelModel(): typeof EntrepreneurProfileSalesChannel {
  if (globalThis.__venturexEntrepreneurProfileSalesChannelModel) {
    return globalThis.__venturexEntrepreneurProfileSalesChannelModel;
  }

  EntrepreneurProfileSalesChannel.init(
    {
      entrepreneurProfileId: { type: DataTypes.UUID, allowNull: false, primaryKey: true, field: "entrepreneur_profile_id" },
      salesChannelId: { type: DataTypes.UUID, allowNull: false, primaryKey: true, field: "sales_channel_id" },
    },
    { sequelize: getSequelize(), tableName: "entrepreneur_profile_sales_channels", timestamps: false, underscored: true },
  );
  globalThis.__venturexEntrepreneurProfileSalesChannelModel = EntrepreneurProfileSalesChannel;
  return EntrepreneurProfileSalesChannel;
}
