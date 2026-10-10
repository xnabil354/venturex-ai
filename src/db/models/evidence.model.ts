import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
} from "sequelize";

import type { Opportunity } from "./opportunity.model";
import { getSequelize } from "../sequelize";

declare global {
  var __venturexOpportunityEvidenceModel: typeof OpportunityEvidence | undefined;
}

export class OpportunityEvidence extends Model<
  InferAttributes<OpportunityEvidence>,
  InferCreationAttributes<OpportunityEvidence>
> {
  declare id: CreationOptional<string>;
  declare trendId: string | null;
  declare opportunityId: string | null;
  declare sourceName: string;
  declare sourceType: string;
  declare sourceMode: string;
  declare sourceReference: string | null;
  declare sourceUrl: string | null;
  declare sourceDate: Date | null;
  declare retrievedAt: Date;
  declare metadata: Record<string, unknown>;
  declare createdAt: CreationOptional<Date>;
  declare opportunity: NonAttribute<Opportunity> | undefined;
}

export function getOpportunityEvidenceModel(): typeof OpportunityEvidence {
  if (globalThis.__venturexOpportunityEvidenceModel) {
    return globalThis.__venturexOpportunityEvidenceModel;
  }

  OpportunityEvidence.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      trendId: { type: DataTypes.UUID, allowNull: true, field: "trend_id" },
      opportunityId: { type: DataTypes.UUID, allowNull: true, field: "opportunity_id" },
      sourceName: { type: DataTypes.STRING(180), allowNull: false, field: "source_name" },
      sourceType: { type: DataTypes.STRING(64), allowNull: false, field: "source_type" },
      sourceMode: { type: DataTypes.STRING(16), allowNull: false, field: "source_mode" },
      sourceReference: { type: DataTypes.TEXT, allowNull: true, field: "source_reference" },
      sourceUrl: { type: DataTypes.TEXT, allowNull: true, field: "source_url" },
      sourceDate: { type: DataTypes.DATE, allowNull: true, field: "source_date" },
      retrievedAt: { type: DataTypes.DATE, allowNull: false, field: "retrieved_at" },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize: getSequelize(),
      tableName: "evidences",
      timestamps: false,
      underscored: true,
    },
  );

  globalThis.__venturexOpportunityEvidenceModel = OpportunityEvidence;
  return OpportunityEvidence;
}
