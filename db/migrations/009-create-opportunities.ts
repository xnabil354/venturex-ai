import { DataTypes, Sequelize, type QueryInterface } from "sequelize";
import type { MigrationFn } from "umzug";

const createOpportunities: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.createTable("opportunities", {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    related_trend_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "trends", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    fnb_category_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "fnb_categories", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    name: { type: DataTypes.STRING(180), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    opportunity_type: { type: DataTypes.STRING(40), allowNull: false },
    target_consumer_summary: { type: DataTypes.TEXT, allowNull: true },
    competition_level: { type: DataTypes.STRING(32), allowNull: true },
    competition_summary: { type: DataTypes.TEXT, allowNull: true },
    execution_feasibility: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    market_sustainability: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    additional_attributes: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: Sequelize.literal("'{}'::jsonb"),
    },
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
    ALTER TABLE "opportunities"
    ADD CONSTRAINT "opportunities_execution_feasibility_check"
    CHECK ("execution_feasibility" IS NULL OR "execution_feasibility" BETWEEN 0 AND 100)
  `);
  await context.sequelize.query(`
    ALTER TABLE "opportunities"
    ADD CONSTRAINT "opportunities_market_sustainability_check"
    CHECK ("market_sustainability" IS NULL OR "market_sustainability" BETWEEN 0 AND 100)
  `);
  await context.addIndex("opportunities", ["related_trend_id"], {
    name: "opportunities_related_trend_id_idx",
  });
  await context.addIndex("opportunities", ["fnb_category_id"], {
    name: "opportunities_fnb_category_id_idx",
  });
  await context.addIndex("opportunities", ["opportunity_type"], {
    name: "opportunities_opportunity_type_idx",
  });
};

const dropOpportunities: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.dropTable("opportunities");
};

export const up = createOpportunities;
export const down = dropOpportunities;
