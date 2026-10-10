import { DataTypes, Sequelize, type QueryInterface } from "sequelize";
import type { MigrationFn } from "umzug";

const createOpportunityFitInputs: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.createTable("opportunity_fit_requirements", {
    opportunity_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: { model: "opportunities", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    capital_min: { type: DataTypes.BIGINT, allowNull: true },
    capital_max: { type: DataTypes.BIGINT, allowNull: true },
    expected_price_min: { type: DataTypes.BIGINT, allowNull: true },
    expected_price_max: { type: DataTypes.BIGINT, allowNull: true },
    required_experience_level: { type: DataTypes.STRING(32), allowNull: true },
    required_time_commitment: { type: DataTypes.STRING(32), allowNull: true },
    operational_complexity: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    location_scope: { type: DataTypes.STRING(40), allowNull: true },
    metadata: { type: DataTypes.JSONB, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });

  await context.sequelize.query(`
    ALTER TABLE "opportunity_fit_requirements"
    ADD CONSTRAINT "opportunity_fit_requirements_capital_range_check"
    CHECK ("capital_min" IS NULL OR "capital_max" IS NULL OR "capital_max" >= "capital_min")
  `);
  await context.sequelize.query(`
    ALTER TABLE "opportunity_fit_requirements"
    ADD CONSTRAINT "opportunity_fit_requirements_expected_price_range_check"
    CHECK (
      "expected_price_min" IS NULL
      OR "expected_price_max" IS NULL
      OR "expected_price_max" >= "expected_price_min"
    )
  `);
  await context.sequelize.query(`
    ALTER TABLE "opportunity_fit_requirements"
    ADD CONSTRAINT "opportunity_fit_requirements_operational_complexity_check"
    CHECK (
      "operational_complexity" IS NULL
      OR "operational_complexity" BETWEEN 0 AND 100
    )
  `);

  await context.createTable("opportunity_customer_segments", {
    opportunity_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: { model: "opportunities", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    customer_segment_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: { model: "customer_segments", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
  });

  await context.createTable("opportunity_sales_channels", {
    opportunity_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: { model: "opportunities", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    sales_channel_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: { model: "sales_channels", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
  });
};

const dropOpportunityFitInputs: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.dropTable("opportunity_sales_channels");
  await context.dropTable("opportunity_customer_segments");
  await context.dropTable("opportunity_fit_requirements");
};

export const up = createOpportunityFitInputs;
export const down = dropOpportunityFitInputs;
