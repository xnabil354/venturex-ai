import { DataTypes, Sequelize, type QueryInterface } from "sequelize";
import type { MigrationFn } from "umzug";

const createEvidences: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.createTable("evidences", {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    trend_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "trends", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    opportunity_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "opportunities", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    source_name: { type: DataTypes.STRING(180), allowNull: false },
    source_type: { type: DataTypes.STRING(64), allowNull: false },
    source_mode: { type: DataTypes.STRING(16), allowNull: false },
    source_reference: { type: DataTypes.TEXT, allowNull: true },
    source_url: { type: DataTypes.TEXT, allowNull: true },
    source_date: { type: DataTypes.DATE, allowNull: true },
    retrieved_at: { type: DataTypes.DATE, allowNull: false },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: Sequelize.literal("'{}'::jsonb"),
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
  });

  await context.sequelize.query(`
    ALTER TABLE "evidences"
    ADD CONSTRAINT "evidences_exactly_one_parent_check"
    CHECK (
      ("trend_id" IS NOT NULL AND "opportunity_id" IS NULL)
      OR
      ("trend_id" IS NULL AND "opportunity_id" IS NOT NULL)
    )
  `);
  await context.addIndex("evidences", ["trend_id"], { name: "evidences_trend_id_idx" });
  await context.addIndex("evidences", ["opportunity_id"], { name: "evidences_opportunity_id_idx" });
  await context.addIndex("evidences", {
    fields: [{ name: "source_date", order: "DESC" }],
    name: "evidences_source_date_idx",
  });
};

const dropEvidences: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.dropTable("evidences");
};

export const up = createEvidences;
export const down = dropEvidences;
