import { DataTypes, Sequelize, type QueryInterface } from "sequelize";
import type { MigrationFn } from "umzug";

const createUserOpportunityAnalyses: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.createTable("user_opportunity_analyses", {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    opportunity_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "opportunities", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    dataset_version_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "dataset_versions", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    scoring_model_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "scoring_models", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    profile_version: { type: DataTypes.INTEGER, allowNull: false },
    opportunity_score: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    fit_score: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    score_status: { type: DataTypes.STRING(32), allowNull: false },
    risk_level: { type: DataTypes.STRING(16), allowNull: true },
    confidence_level: { type: DataTypes.STRING(16), allowNull: true },
    opportunity_score_breakdown: { type: DataTypes.JSONB, allowNull: false },
    fit_score_breakdown: { type: DataTypes.JSONB, allowNull: false },
    risk_reasons: { type: DataTypes.JSONB, allowNull: false },
    ai_analysis: { type: DataTypes.JSONB, allowNull: true },
    ai_provider: { type: DataTypes.STRING(80), allowNull: true },
    ai_model: { type: DataTypes.STRING(120), allowNull: true },
    generated_at: { type: DataTypes.DATE, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
  });

  await context.sequelize.query(`
    ALTER TABLE "user_opportunity_analyses"
    ADD CONSTRAINT "user_opportunity_analyses_profile_version_check"
    CHECK ("profile_version" >= 1)
  `);
  await context.sequelize.query(`
    ALTER TABLE "user_opportunity_analyses"
    ADD CONSTRAINT "user_opportunity_analyses_opportunity_score_check"
    CHECK ("opportunity_score" IS NULL OR "opportunity_score" BETWEEN 0 AND 100)
  `);
  await context.sequelize.query(`
    ALTER TABLE "user_opportunity_analyses"
    ADD CONSTRAINT "user_opportunity_analyses_fit_score_check"
    CHECK ("fit_score" IS NULL OR "fit_score" BETWEEN 0 AND 100)
  `);
  await context.sequelize.query(`
    ALTER TABLE "user_opportunity_analyses"
    ADD CONSTRAINT "user_opportunity_analyses_score_status_check"
    CHECK ("score_status" IN ('PENDING', 'AVAILABLE', 'INSUFFICIENT_DATA', 'ERROR'))
  `);
  await context.sequelize.query(`
    ALTER TABLE "user_opportunity_analyses"
    ADD CONSTRAINT "user_opportunity_analyses_risk_level_check"
    CHECK ("risk_level" IS NULL OR "risk_level" IN ('LOW', 'MEDIUM', 'HIGH'))
  `);
  await context.sequelize.query(`
    ALTER TABLE "user_opportunity_analyses"
    ADD CONSTRAINT "user_opportunity_analyses_confidence_level_check"
    CHECK ("confidence_level" IS NULL OR "confidence_level" IN ('LOW', 'MEDIUM', 'HIGH'))
  `);
  await context.sequelize.query(`
    ALTER TABLE "user_opportunity_analyses"
    ADD CONSTRAINT "user_opportunity_analyses_risk_reasons_check"
    CHECK (
      jsonb_typeof("risk_reasons") = 'array'
      AND ("risk_level" IS NULL OR jsonb_array_length("risk_reasons") > 0)
    )
  `);

  await context.addIndex("user_opportunity_analyses", {
    fields: ["user_id", "opportunity_id", { name: "generated_at", order: "DESC" }],
    name: "user_opportunity_analyses_user_opportunity_generated_at_idx",
  });
  await context.addIndex("user_opportunity_analyses", {
    fields: ["user_id", { name: "generated_at", order: "DESC" }],
    name: "user_opportunity_analyses_user_generated_at_idx",
  });
  await context.addIndex("user_opportunity_analyses", ["opportunity_id"], {
    name: "user_opportunity_analyses_opportunity_id_idx",
  });
  await context.addIndex("user_opportunity_analyses", ["dataset_version_id"], {
    name: "user_opportunity_analyses_dataset_version_id_idx",
  });
  await context.addIndex("user_opportunity_analyses", ["scoring_model_id"], {
    name: "user_opportunity_analyses_scoring_model_id_idx",
  });
};

const dropUserOpportunityAnalyses: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.dropTable("user_opportunity_analyses");
};

export const up = createUserOpportunityAnalyses;
export const down = dropUserOpportunityAnalyses;
