import { DataTypes, type QueryInterface } from "sequelize";
import type { MigrationFn } from "umzug";

const createBusinessProducts: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.createTable("business_products", {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    business_profile_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "business_profiles", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    name: { type: DataTypes.STRING(180), allowNull: false },
    fnb_category_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "fnb_categories", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    price: { type: DataTypes.BIGINT, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await context.sequelize.query(`
    ALTER TABLE "business_products"
    ADD CONSTRAINT "business_products_price_check"
    CHECK ("price" IS NULL OR "price" >= 0)
  `);
};

const dropBusinessProducts: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.dropTable("business_products");
};

export const up = createBusinessProducts;
export const down = dropBusinessProducts;
