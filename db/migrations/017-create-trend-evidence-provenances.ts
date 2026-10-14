import { DataTypes, Sequelize, type QueryInterface } from "sequelize";
import type { MigrationFn } from "umzug";

const createTrendEvidenceProvenances: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.createTable("trend_evidence_provenances", {
    trend_evidence_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: { model: "trend_evidences", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    schema_version: { type: DataTypes.SMALLINT, allowNull: false },
    source_id: { type: DataTypes.STRING(80), allowNull: false },
    original_publisher: { type: DataTypes.STRING(32), allowNull: false },
    transport_provider: { type: DataTypes.STRING(32), allowNull: false },
    source_product: { type: DataTypes.STRING(64), allowNull: false },
    collection_target_url: { type: DataTypes.TEXT, allowNull: true },
    retrieved_at: { type: DataTypes.DATE, allowNull: true },
    observation_period_status: { type: DataTypes.STRING(24), allowNull: false },
    observation_period_start: { type: DataTypes.DATEONLY, allowNull: true },
    observation_period_end: { type: DataTypes.DATEONLY, allowNull: true },
    geography_code: { type: DataTypes.STRING(2), allowNull: true },
    metrics_availability: { type: DataTypes.STRING(16), allowNull: false },
    metrics: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: Sequelize.literal("'[]'::jsonb"),
    },
    completeness: { type: DataTypes.STRING(16), allowNull: false },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
  });

  await context.sequelize.query(`
    ALTER TABLE "trend_evidence_provenances"
    ADD CONSTRAINT "trend_evidence_provenances_schema_version_check"
      CHECK ("schema_version" = 1),
    ADD CONSTRAINT "trend_evidence_provenances_source_check"
      CHECK ("source_id" IN ('google_year_in_search_indonesia_2025', 'google_trends_trending_now_indonesia')),
    ADD CONSTRAINT "trend_evidence_provenances_publisher_check"
      CHECK ("original_publisher" = 'GOOGLE'),
    ADD CONSTRAINT "trend_evidence_provenances_source_transport_check"
      CHECK (
        ("source_id" = 'google_year_in_search_indonesia_2025'
          AND "source_product" = 'GOOGLE_YEAR_IN_SEARCH_2025'
          AND "transport_provider" IN ('UNKNOWN', 'NOT_APPLICABLE')
          AND "collection_target_url" IS NULL)
        OR
        ("source_id" = 'google_trends_trending_now_indonesia'
          AND "source_product" = 'GOOGLE_TRENDS_TRENDING_NOW'
          AND "transport_provider" = 'BRIGHTDATA_SERP_API'
          AND "collection_target_url" = 'https://trends.google.com/trending?geo=ID&hl=id&brd_json=1')
      ),
    ADD CONSTRAINT "trend_evidence_provenances_observation_period_check"
      CHECK (
        ("observation_period_status" = 'KNOWN'
          AND "observation_period_start" IS NOT NULL
          AND "observation_period_end" IS NOT NULL
          AND "observation_period_end" >= "observation_period_start")
        OR
        ("observation_period_status" IN ('NOT_PROVIDED', 'UNKNOWN', 'NOT_APPLICABLE')
          AND "observation_period_start" IS NULL
          AND "observation_period_end" IS NULL)
      ),
    ADD CONSTRAINT "trend_evidence_provenances_geography_check"
      CHECK ("geography_code" IS NULL OR "geography_code" = 'ID'),
    ADD CONSTRAINT "trend_evidence_provenances_metrics_availability_check"
      CHECK ("metrics_availability" IN ('AVAILABLE', 'PARTIAL', 'UNAVAILABLE', 'UNKNOWN')),
    ADD CONSTRAINT "trend_evidence_provenances_metrics_shape_check"
      CHECK (
        jsonb_typeof("metrics") = 'array'
        AND jsonb_array_length("metrics") <= 3
        AND pg_column_size("metrics") <= 512
      ),
    ADD CONSTRAINT "trend_evidence_provenances_completeness_check"
      CHECK ("completeness" IN ('COMPLETE', 'PARTIAL', 'UNKNOWN')),
    ADD CONSTRAINT "trend_evidence_provenances_target_url_check"
      CHECK (
        "collection_target_url" IS NULL
        OR ("collection_target_url" LIKE 'https://%' AND "collection_target_url" !~ '^https://[^/]*@')
      )
  `);
};

const dropTrendEvidenceProvenances: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.dropTable("trend_evidence_provenances");
};

export const up = createTrendEvidenceProvenances;
export const down = dropTrendEvidenceProvenances;
