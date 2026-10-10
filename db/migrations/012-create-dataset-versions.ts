import { DataTypes, Sequelize, type QueryInterface } from "sequelize";
import type { MigrationFn } from "umzug";

const createDatasetVersions: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.createTable("dataset_versions", {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    source_name: { type: DataTypes.STRING(180), allowNull: false },
    source_mode: { type: DataTypes.STRING(16), allowNull: false },
    version_key: { type: DataTypes.STRING(120), allowNull: false },
    source_updated_at: { type: DataTypes.DATE, allowNull: true },
    imported_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    checksum: { type: DataTypes.STRING(128), allowNull: true },
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
    ALTER TABLE "dataset_versions"
    ADD CONSTRAINT "dataset_versions_source_mode_check"
    CHECK ("source_mode" IN ('LIVE', 'CACHED', 'PREPARED'))
  `);
  await context.addConstraint("dataset_versions", {
    fields: ["source_name", "version_key"],
    type: "unique",
    name: "uq_dataset_versions_source_version",
  });
};

const dropDatasetVersions: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.dropTable("dataset_versions");
};

export const up = createDatasetVersions;
export const down = dropDatasetVersions;
