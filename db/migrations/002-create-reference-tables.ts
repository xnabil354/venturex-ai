import { DataTypes, type QueryInterface } from "sequelize";
import type { MigrationFn } from "umzug";

const createReferenceTables: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.createTable("fnb_categories", {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    code: { type: DataTypes.STRING(64), allowNull: false },
    name: { type: DataTypes.STRING(120), allowNull: false },
    parent_id: { type: DataTypes.UUID, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await context.addConstraint("fnb_categories", {
    fields: ["code"],
    type: "unique",
    name: "fnb_categories_code_unique",
  });
  await context.addConstraint("fnb_categories", {
    fields: ["name"],
    type: "unique",
    name: "fnb_categories_name_unique",
  });
  await context.addConstraint("fnb_categories", {
    fields: ["parent_id"],
    type: "foreign key",
    name: "fnb_categories_parent_id_fk",
    references: { table: "fnb_categories", field: "id" },
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  });

  await context.createTable("customer_segments", {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    code: { type: DataTypes.STRING(64), allowNull: false },
    name: { type: DataTypes.STRING(120), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await context.addConstraint("customer_segments", {
    fields: ["code"],
    type: "unique",
    name: "customer_segments_code_unique",
  });
  await context.addConstraint("customer_segments", {
    fields: ["name"],
    type: "unique",
    name: "customer_segments_name_unique",
  });

  await context.createTable("sales_channels", {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    code: { type: DataTypes.STRING(64), allowNull: false },
    name: { type: DataTypes.STRING(120), allowNull: false },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await context.addConstraint("sales_channels", {
    fields: ["code"],
    type: "unique",
    name: "sales_channels_code_unique",
  });
  await context.addConstraint("sales_channels", {
    fields: ["name"],
    type: "unique",
    name: "sales_channels_name_unique",
  });
};

const dropReferenceTables: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.dropTable("sales_channels");
  await context.dropTable("customer_segments");
  await context.dropTable("fnb_categories");
};

export const up = createReferenceTables;
export const down = dropReferenceTables;
