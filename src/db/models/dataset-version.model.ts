import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
} from "sequelize";

import type { UserOpportunityAnalysis } from "./user-opportunity-analysis.model";
import type { DatasetSourceMode } from "../../scoring/persistence-types";
import { DATASET_SOURCE_MODES } from "../../scoring/persistence-types";
import { getSequelize } from "../sequelize";

declare global {
  var __venturexDatasetVersionModel: typeof DatasetVersion | undefined;
}

export class DatasetVersion extends Model<
  InferAttributes<DatasetVersion>,
  InferCreationAttributes<DatasetVersion>
> {
  declare id: CreationOptional<string>;
  declare sourceName: string;
  declare sourceMode: DatasetSourceMode;
  declare versionKey: string;
  declare sourceUpdatedAt: Date | null;
  declare importedAt: CreationOptional<Date>;
  declare checksum: string | null;
  declare metadata: Record<string, unknown>;
  declare createdAt: CreationOptional<Date>;
  declare analyses: NonAttribute<UserOpportunityAnalysis[]> | undefined;
}

export function getDatasetVersionModel(): typeof DatasetVersion {
  if (globalThis.__venturexDatasetVersionModel) {
    return globalThis.__venturexDatasetVersionModel;
  }

  DatasetVersion.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      sourceName: { type: DataTypes.STRING(180), allowNull: false, field: "source_name" },
      sourceMode: {
        type: DataTypes.STRING(16),
        allowNull: false,
        field: "source_mode",
        validate: { isIn: [[...DATASET_SOURCE_MODES]] },
      },
      versionKey: { type: DataTypes.STRING(120), allowNull: false, field: "version_key" },
      sourceUpdatedAt: { type: DataTypes.DATE, allowNull: true, field: "source_updated_at" },
      importedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "imported_at",
        defaultValue: DataTypes.NOW,
      },
      checksum: { type: DataTypes.STRING(128), allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize: getSequelize(),
      tableName: "dataset_versions",
      timestamps: false,
      underscored: true,
      indexes: [{
        unique: true,
        name: "uq_dataset_versions_source_version",
        fields: ["sourceName", "versionKey"],
      }],
    },
  );

  globalThis.__venturexDatasetVersionModel = DatasetVersion;
  return DatasetVersion;
}
