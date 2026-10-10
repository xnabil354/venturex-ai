import { type QueryInterface, DataTypes } from "sequelize";
import type { MigrationFn } from "umzug";

const createBusinessProfileJunctions: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.createTable("business_profile_customer_segments", {
    business_profile_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: { model: "business_profiles", key: "id" },
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

  await context.createTable("business_profile_sales_channels", {
    business_profile_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: { model: "business_profiles", key: "id" },
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

const dropBusinessProfileJunctions: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.dropTable("business_profile_sales_channels");
  await context.dropTable("business_profile_customer_segments");
};

export const up = createBusinessProfileJunctions;
export const down = dropBusinessProfileJunctions;
