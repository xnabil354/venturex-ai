import { DataTypes, Sequelize, type QueryInterface } from "sequelize";
import type { MigrationFn } from "umzug";

const createSavedOpportunities: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.createTable("saved_opportunities", {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
    },
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
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
  });

  await context.addConstraint("saved_opportunities", {
    fields: ["user_id", "opportunity_id"],
    type: "unique",
    name: "uq_saved_opportunity",
  });
};

const dropSavedOpportunities: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.dropTable("saved_opportunities");
};

export const up = createSavedOpportunities;
export const down = dropSavedOpportunities;
