import { DataTypes, Sequelize, type QueryInterface } from "sequelize";
import type { MigrationFn } from "umzug";

const createScoringModels: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.createTable("scoring_models", {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    model_type: { type: DataTypes.STRING(40), allowNull: false },
    version: { type: DataTypes.STRING(40), allowNull: false },
    weights: { type: DataTypes.JSONB, allowNull: false },
    configuration: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: Sequelize.literal("'{}'::jsonb"),
    },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
  });

  await context.sequelize.query(`
    ALTER TABLE "scoring_models"
    ADD CONSTRAINT "scoring_models_model_type_check"
    CHECK ("model_type" IN ('OPPORTUNITY_SCORE', 'ENTREPRENEUR_FIT', 'BUSINESS_FIT', 'RISK'))
  `);
  await context.addConstraint("scoring_models", {
    fields: ["model_type", "version"],
    type: "unique",
    name: "uq_scoring_models_type_version",
  });
};

const dropScoringModels: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.dropTable("scoring_models");
};

export const up = createScoringModels;
export const down = dropScoringModels;
