import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from "sequelize";

import type { UserType } from "../../auth/user-types";
import {
  TREND_DIRECTIONS,
  TREND_LIFECYCLE_STATES,
  type TrendCategoryCode,
  type TrendDirection,
  type TrendId,
  type TrendLifecycleState,
} from "../../trend/domain";
import { getSequelize } from "../sequelize";

declare global {
  var __venturexTrendModel: typeof Trend | undefined;
  var __venturexTrendEvidenceModel: typeof TrendEvidence | undefined;
}

export class Trend extends Model<InferAttributes<Trend>, InferCreationAttributes<Trend>> {
  declare id: CreationOptional<TrendId>;
  declare title: string;
  declare categoryCode: TrendCategoryCode;
  declare subjectAreaId: string | null;
  declare signalSummary: string;
  declare signalDescription: string;
  declare direction: TrendDirection | null;
  declare periodStart: string | null;
  declare periodEnd: string | null;
  declare businessRelevanceExplanation: string | null;
  declare affectedUserTypes: UserType[];
  declare lifecycleState: TrendLifecycleState;
  declare archivedReason: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export class TrendEvidence extends Model<InferAttributes<TrendEvidence>, InferCreationAttributes<TrendEvidence>> {
  declare id: CreationOptional<string>;
  declare trendId: TrendId;
  declare sourceName: string;
  declare sourceReference: string;
  declare supportingDetail: string;
  declare sourceDate: Date | null;
  declare limitations: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function getTrendModel(): typeof Trend {
  if (globalThis.__venturexTrendModel) return globalThis.__venturexTrendModel;
  Trend.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    title: { type: DataTypes.STRING(180), allowNull: false },
    categoryCode: { type: DataTypes.STRING(64), allowNull: false, field: "category_code" },
    subjectAreaId: { type: DataTypes.UUID, allowNull: true, field: "fnb_category_id" },
    signalSummary: { type: DataTypes.STRING(500), allowNull: false, field: "signal_summary" },
    signalDescription: { type: DataTypes.TEXT, allowNull: false, field: "signal_description" },
    direction: { type: DataTypes.STRING(16), allowNull: true, validate: { isIn: [[...TREND_DIRECTIONS]] } },
    periodStart: { type: DataTypes.DATEONLY, allowNull: true, field: "period_start" },
    periodEnd: { type: DataTypes.DATEONLY, allowNull: true, field: "period_end" },
    businessRelevanceExplanation: { type: DataTypes.TEXT, allowNull: true, field: "business_relevance_explanation" },
    affectedUserTypes: { type: DataTypes.ARRAY(DataTypes.STRING(32)), allowNull: false, defaultValue: [], field: "affected_user_types" },
    lifecycleState: { type: DataTypes.STRING(16), allowNull: false, defaultValue: "DRAFT", field: "lifecycle_state", validate: { isIn: [[...TREND_LIFECYCLE_STATES]] } },
    archivedReason: { type: DataTypes.TEXT, allowNull: true, field: "archived_reason" },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: "updated_at" },
  }, { sequelize: getSequelize(), tableName: "trends", timestamps: true, underscored: true });
  globalThis.__venturexTrendModel = Trend;
  return Trend;
}

export function getTrendEvidenceModel(): typeof TrendEvidence {
  if (globalThis.__venturexTrendEvidenceModel) return globalThis.__venturexTrendEvidenceModel;
  TrendEvidence.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    trendId: { type: DataTypes.UUID, allowNull: false, field: "trend_id" },
    sourceName: { type: DataTypes.STRING(180), allowNull: false, field: "source_name" },
    sourceReference: { type: DataTypes.TEXT, allowNull: false, field: "source_reference" },
    supportingDetail: { type: DataTypes.TEXT, allowNull: false, field: "supporting_detail" },
    sourceDate: { type: DataTypes.DATE, allowNull: true, field: "source_date" },
    limitations: { type: DataTypes.TEXT, allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: "updated_at" },
  }, { sequelize: getSequelize(), tableName: "trend_evidences", timestamps: true, underscored: true });
  globalThis.__venturexTrendEvidenceModel = TrendEvidence;
  return TrendEvidence;
}
