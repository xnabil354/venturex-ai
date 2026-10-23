import { DataTypes, type QueryInterface } from "sequelize";
import type { MigrationFn } from "umzug";

const createPrivateOpportunityHypotheses: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.createTable("user_generated_opportunities", {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    user_type: { type: DataTypes.STRING(32), allowNull: false },
    hypothesis: { type: DataTypes.JSONB, allowNull: false },
    source_reference: { type: DataTypes.JSONB, allowNull: false },
    provider: { type: DataTypes.STRING(32), allowNull: false },
    model: { type: DataTypes.STRING(120), allowNull: false },
    generated_at: { type: DataTypes.DATE, allowNull: false },
    is_saved: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    saved_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await context.sequelize.query(`
    ALTER TABLE "user_generated_opportunities"
      ADD CONSTRAINT "user_generated_opportunities_user_type_check"
        CHECK ("user_type" IN ('ENTREPRENEUR', 'UMKM_EXISTING')),
      ADD CONSTRAINT "user_generated_opportunities_provider_check"
        CHECK ("provider" = 'ninerouter'),
      ADD CONSTRAINT "user_generated_opportunities_saved_at_check"
        CHECK (("is_saved" = TRUE AND "saved_at" IS NOT NULL) OR ("is_saved" = FALSE AND "saved_at" IS NULL))
  `);
  await context.addIndex("user_generated_opportunities", {
    fields: ["user_id", { name: "created_at", order: "DESC" }],
    name: "user_generated_opportunities_user_created_at_idx",
  });
  await context.addIndex("user_generated_opportunities", {
    fields: ["user_id", "is_saved", { name: "created_at", order: "DESC" }],
    name: "user_generated_opportunities_user_saved_created_at_idx",
  });
};

const dropPrivateOpportunityHypotheses: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.dropTable("user_generated_opportunities");
};

export const up = createPrivateOpportunityHypotheses;
export const down = dropPrivateOpportunityHypotheses;
