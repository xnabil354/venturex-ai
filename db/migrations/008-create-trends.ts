import { DataTypes, Sequelize, type QueryInterface } from "sequelize";
import type { MigrationFn } from "umzug";

const createTrends: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.createTable("trends", {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    title: { type: DataTypes.STRING(180), allowNull: false },
    category_code: { type: DataTypes.STRING(64), allowNull: false },
    fnb_category_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "fnb_categories", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    signal_summary: { type: DataTypes.STRING(500), allowNull: false },
    signal_description: { type: DataTypes.TEXT, allowNull: false },
    direction: { type: DataTypes.STRING(16), allowNull: true },
    period_start: { type: DataTypes.DATEONLY, allowNull: true },
    period_end: { type: DataTypes.DATEONLY, allowNull: true },
    business_relevance_explanation: { type: DataTypes.TEXT, allowNull: true },
    affected_user_types: { type: DataTypes.ARRAY(DataTypes.STRING(32)), allowNull: false, defaultValue: [] },
    lifecycle_state: { type: DataTypes.STRING(16), allowNull: false, defaultValue: "DRAFT" },
    archived_reason: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
  });

  await context.sequelize.query("ALTER TABLE \"trends\" ADD CONSTRAINT \"trends_category_code_check\" CHECK (\"category_code\" IN ('CONSUMER_BEHAVIOR', 'PRODUCT_MENU', 'CHANNEL_DISTRIBUTION', 'TECHNOLOGY_ADOPTION', 'OPERATIONAL_PATTERN', 'MARKET_MOVEMENT'))");
  await context.sequelize.query("ALTER TABLE \"trends\" ADD CONSTRAINT \"trends_direction_check\" CHECK (\"direction\" IS NULL OR \"direction\" IN ('RISING', 'STABLE', 'DECLINING'))");
  await context.sequelize.query("ALTER TABLE \"trends\" ADD CONSTRAINT \"trends_period_check\" CHECK (\"period_start\" IS NULL OR \"period_end\" IS NULL OR \"period_end\" >= \"period_start\")");
  await context.sequelize.query("ALTER TABLE \"trends\" ADD CONSTRAINT \"trends_affected_user_types_check\" CHECK (cardinality(\"affected_user_types\") <= 2 AND \"affected_user_types\" <@ ARRAY['ENTREPRENEUR', 'UMKM_EXISTING']::VARCHAR(32)[])");
  await context.sequelize.query("ALTER TABLE \"trends\" ADD CONSTRAINT \"trends_lifecycle_state_check\" CHECK (\"lifecycle_state\" IN ('DRAFT', 'VALIDATED', 'PUBLISHED', 'ARCHIVED'))");
  await context.sequelize.query("ALTER TABLE \"trends\" ADD CONSTRAINT \"trends_archived_reason_check\" CHECK (\"lifecycle_state\" <> 'ARCHIVED' OR (\"archived_reason\" IS NOT NULL AND \"archived_reason\" ~ '[^[:space:]]'))");
  await context.addIndex("trends", ["lifecycle_state", "created_at"], { name: "trends_lifecycle_created_at_idx" });

  await context.createTable("trend_evidences", {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    trend_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "trends", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    source_name: { type: DataTypes.STRING(180), allowNull: false },
    source_reference: { type: DataTypes.TEXT, allowNull: false },
    supporting_detail: { type: DataTypes.TEXT, allowNull: false },
    source_date: { type: DataTypes.DATE, allowNull: true },
    limitations: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
  });
  await context.addIndex("trend_evidences", ["trend_id"], { name: "trend_evidences_trend_id_idx" });
};

const dropTrends: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.dropTable("trend_evidences");
  await context.dropTable("trends");
};

export const up = createTrends;
export const down = dropTrends;
