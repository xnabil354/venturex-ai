import { DataTypes, type QueryInterface } from "sequelize";
import type { MigrationFn } from "umzug";

const createJunctionTables: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.createTable("entrepreneur_profile_interests", {
    entrepreneur_profile_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: { model: "entrepreneur_profiles", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    fnb_category_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: { model: "fnb_categories", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
  });

  await context.createTable("entrepreneur_profile_customer_segments", {
    entrepreneur_profile_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: { model: "entrepreneur_profiles", key: "id" },
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

  await context.createTable("entrepreneur_profile_sales_channels", {
    entrepreneur_profile_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: { model: "entrepreneur_profiles", key: "id" },
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

const dropJunctionTables: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.dropTable("entrepreneur_profile_sales_channels");
  await context.dropTable("entrepreneur_profile_customer_segments");
  await context.dropTable("entrepreneur_profile_interests");
};

export const up = createJunctionTables;
export const down = dropJunctionTables;
