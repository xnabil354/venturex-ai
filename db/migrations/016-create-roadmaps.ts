import { DataTypes, type QueryInterface } from "sequelize";
import type { MigrationFn } from "umzug";

const createRoadmaps: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.createTable("roadmaps", {
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
    user_opportunity_analysis_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "user_opportunity_analyses", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    roadmap_type: { type: DataTypes.STRING(16), allowNull: false },
    generation_context: { type: DataTypes.JSONB, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await context.sequelize.query(`ALTER TABLE "roadmaps" ADD CONSTRAINT "roadmaps_type_check" CHECK ("roadmap_type" IN ('STARTUP', 'GROWTH'))`);
  await context.addIndex("roadmaps", { fields: ["user_id", { name: "created_at", order: "DESC" }], name: "roadmaps_user_created_at_idx" });
  await context.addIndex("roadmaps", ["opportunity_id"], { name: "roadmaps_opportunity_id_idx" });
  await context.addIndex("roadmaps", ["user_opportunity_analysis_id"], { name: "roadmaps_user_opportunity_analysis_id_idx" });

  await context.createTable("roadmap_steps", {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    roadmap_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "roadmaps", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    sequence: { type: DataTypes.SMALLINT, allowNull: false },
    stage: { type: DataTypes.STRING(120), allowNull: false },
    action: { type: DataTypes.TEXT, allowNull: false },
    objective: { type: DataTypes.TEXT, allowNull: false },
    timeline: { type: DataTypes.STRING(120), allowNull: false },
    expected_output: { type: DataTypes.TEXT, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await context.sequelize.query(`ALTER TABLE "roadmap_steps" ADD CONSTRAINT "roadmap_steps_sequence_check" CHECK ("sequence" > 0)`);
  await context.addIndex("roadmap_steps", ["roadmap_id", "sequence"], { unique: true, name: "roadmap_steps_roadmap_sequence_uq" });
};

const dropRoadmaps: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.dropTable("roadmap_steps");
  await context.dropTable("roadmaps");
};

export const up = createRoadmaps;
export const down = dropRoadmaps;
