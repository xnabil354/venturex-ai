import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from "sequelize";

import { getSequelize } from "../sequelize";
import { getTrendEvidenceModel } from "./trend.model";
import {
  TREND_EVIDENCE_PROVENANCE_OBSERVATION_PERIOD_STATUSES,
  TREND_EVIDENCE_PROVENANCE_SOURCE_IDS,
  parseTrendEvidenceProvenanceInput,
  trendEvidenceProvenanceMetricsSchema,
  trendEvidenceProvenanceInputSchema,
} from "../../trend/trend-evidence-provenance.schema";
import type {
  TrendEvidenceProvenanceInput,
  TrendEvidenceProvenanceMetric,
} from "../../trend/trend-evidence-provenance.schema";

export {
  TREND_EVIDENCE_PROVENANCE_OBSERVATION_PERIOD_STATUSES,
  TREND_EVIDENCE_PROVENANCE_SOURCE_IDS,
  parseTrendEvidenceProvenanceInput,
  trendEvidenceProvenanceInputSchema,
} from "../../trend/trend-evidence-provenance.schema";
export type {
  TrendEvidenceProvenanceInput,
  TrendEvidenceProvenanceMetric,
} from "../../trend/trend-evidence-provenance.schema";

declare global {
  var __venturexTrendEvidenceProvenanceModel: typeof TrendEvidenceProvenance | undefined;
}

export class TrendEvidenceProvenance extends Model<
  InferAttributes<TrendEvidenceProvenance>,
  InferCreationAttributes<TrendEvidenceProvenance>
> {
  declare trendEvidenceId: string;
  declare schemaVersion: number;
  declare sourceId: TrendEvidenceProvenanceInput["sourceId"];
  declare originalPublisher: "GOOGLE";
  declare transportProvider: TrendEvidenceProvenanceInput["transportProvider"];
  declare sourceProduct: TrendEvidenceProvenanceInput["sourceProduct"];
  declare collectionTargetUrl: string | null;
  declare retrievedAt: Date | null;
  declare observationPeriodStatus: TrendEvidenceProvenanceInput["observationPeriodStatus"];
  declare observationPeriodStart: string | null;
  declare observationPeriodEnd: string | null;
  declare geographyCode: "ID" | null;
  declare metricsAvailability: TrendEvidenceProvenanceInput["metricsAvailability"];
  declare metrics: TrendEvidenceProvenanceMetric[];
  declare completeness: TrendEvidenceProvenanceInput["completeness"];
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export async function createTrendEvidenceProvenance(input: unknown): Promise<TrendEvidenceProvenance> {
  const validatedInput = parseTrendEvidenceProvenanceInput(input);
  return getTrendEvidenceProvenanceModel().create(validatedInput);
}

export function getTrendEvidenceProvenanceModel(): typeof TrendEvidenceProvenance {
  if (globalThis.__venturexTrendEvidenceProvenanceModel) {
    return globalThis.__venturexTrendEvidenceProvenanceModel;
  }

  const evidenceModel = getTrendEvidenceModel();
  TrendEvidenceProvenance.init({
    trendEvidenceId: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      field: "trend_evidence_id",
    },
    schemaVersion: { type: DataTypes.SMALLINT, allowNull: false, field: "schema_version", validate: { isIn: [[1]] } },
    sourceId: { type: DataTypes.STRING(80), allowNull: false, field: "source_id", validate: { isIn: [[...TREND_EVIDENCE_PROVENANCE_SOURCE_IDS]] } },
    originalPublisher: { type: DataTypes.STRING(32), allowNull: false, field: "original_publisher", validate: { isIn: [["GOOGLE"]] } },
    transportProvider: { type: DataTypes.STRING(32), allowNull: false, field: "transport_provider", validate: { isIn: [["BRIGHTDATA_SERP_API", "UNKNOWN", "NOT_APPLICABLE"]] } },
    sourceProduct: { type: DataTypes.STRING(64), allowNull: false, field: "source_product", validate: { isIn: [["GOOGLE_YEAR_IN_SEARCH_2025", "GOOGLE_TRENDS_TRENDING_NOW"]] } },
    collectionTargetUrl: { type: DataTypes.TEXT, allowNull: true, field: "collection_target_url" },
    retrievedAt: { type: DataTypes.DATE, allowNull: true, field: "retrieved_at" },
    observationPeriodStatus: { type: DataTypes.STRING(24), allowNull: false, field: "observation_period_status", validate: { isIn: [[...TREND_EVIDENCE_PROVENANCE_OBSERVATION_PERIOD_STATUSES]] } },
    observationPeriodStart: { type: DataTypes.DATEONLY, allowNull: true, field: "observation_period_start" },
    observationPeriodEnd: { type: DataTypes.DATEONLY, allowNull: true, field: "observation_period_end" },
    geographyCode: { type: DataTypes.STRING(2), allowNull: true, field: "geography_code", validate: { isIn: [["ID"]] } },
    metricsAvailability: { type: DataTypes.STRING(16), allowNull: false, field: "metrics_availability", validate: { isIn: [["AVAILABLE", "PARTIAL", "UNAVAILABLE", "UNKNOWN"]] } },
    metrics: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: "metrics",
      defaultValue: [],
      validate: {
        validMetricMetadata(value: unknown) {
          trendEvidenceProvenanceMetricsSchema.parse(value);
        },
      },
    },
    completeness: { type: DataTypes.STRING(16), allowNull: false, field: "completeness", validate: { isIn: [["COMPLETE", "PARTIAL", "UNKNOWN"]] } },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: "updated_at" },
  }, {
    sequelize: getSequelize(),
    tableName: "trend_evidence_provenances",
    timestamps: true,
    underscored: true,
    validate: {
      provenanceContract(this: TrendEvidenceProvenance) {
        parseTrendEvidenceProvenanceInput({
          trendEvidenceId: this.trendEvidenceId,
          schemaVersion: this.schemaVersion,
          sourceId: this.sourceId,
          originalPublisher: this.originalPublisher,
          transportProvider: this.transportProvider,
          sourceProduct: this.sourceProduct,
          collectionTargetUrl: this.collectionTargetUrl,
          retrievedAt: this.retrievedAt,
          observationPeriodStatus: this.observationPeriodStatus,
          observationPeriodStart: this.observationPeriodStart,
          observationPeriodEnd: this.observationPeriodEnd,
          geographyCode: this.geographyCode,
          metricsAvailability: this.metricsAvailability,
          metrics: this.metrics,
          completeness: this.completeness,
        });
      },
    },
  });

  globalThis.__venturexTrendEvidenceProvenanceModel = TrendEvidenceProvenance;
  if (!evidenceModel.associations.provenance) {
    evidenceModel.hasOne(TrendEvidenceProvenance, {
      as: "provenance",
      foreignKey: "trendEvidenceId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  }
  if (!TrendEvidenceProvenance.associations.evidence) {
    TrendEvidenceProvenance.belongsTo(evidenceModel, {
      as: "evidence",
      foreignKey: "trendEvidenceId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  }

  return TrendEvidenceProvenance;
}
