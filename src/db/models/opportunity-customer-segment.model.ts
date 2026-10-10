import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
} from "sequelize";

import { getSequelize } from "../sequelize";

declare global {
  var __venturexOpportunityCustomerSegmentModel: typeof OpportunityCustomerSegment | undefined;
}

export class OpportunityCustomerSegment extends Model<
  InferAttributes<OpportunityCustomerSegment>,
  InferCreationAttributes<OpportunityCustomerSegment>
> {
  declare opportunityId: string;
  declare customerSegmentId: string;
}

export function getOpportunityCustomerSegmentModel(): typeof OpportunityCustomerSegment {
  if (globalThis.__venturexOpportunityCustomerSegmentModel) {
    return globalThis.__venturexOpportunityCustomerSegmentModel;
  }

  OpportunityCustomerSegment.init(
    {
      opportunityId: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        field: "opportunity_id",
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
      tableName: "opportunity_customer_segments",
      timestamps: false,
      underscored: true,
    },
  );

  globalThis.__venturexOpportunityCustomerSegmentModel = OpportunityCustomerSegment;
  return OpportunityCustomerSegment;
}
