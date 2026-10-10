import type { QueryInterface } from "sequelize";
import { describe, expect, it, vi } from "vitest";

import { down as downDatasetVersions, up as upDatasetVersions } from "../../db/migrations/012-create-dataset-versions";
import { down as downScoringModels, up as upScoringModels } from "../../db/migrations/013-create-scoring-models";
import { down as downAnalyses, up as upAnalyses } from "../../db/migrations/014-create-user-opportunity-analyses";

function migrationContext() {
  const createTable = vi.fn().mockResolvedValue(undefined);
  const addConstraint = vi.fn().mockResolvedValue(undefined);
  const addIndex = vi.fn().mockResolvedValue(undefined);
  const query = vi.fn().mockResolvedValue([[], undefined]);
  const dropTable = vi.fn().mockResolvedValue(undefined);
  const context = {
    createTable,
    addConstraint,
    addIndex,
    sequelize: { query },
    dropTable,
  } as unknown as QueryInterface;
  return { context, createTable, addConstraint, addIndex, query, dropTable };
}

describe("Scoring persistence migration source", () => {
  it("creates dataset versions with supported source modes and a stable unique key, without Trend linkage", async () => {
    const { context, createTable, addConstraint, query } = migrationContext();

    await upDatasetVersions({ context } as Parameters<typeof upDatasetVersions>[0]);

    expect(createTable).toHaveBeenCalledOnce();
    expect(createTable.mock.calls[0]?.[0]).toBe("dataset_versions");
    const columns = createTable.mock.calls[0]?.[1] as Record<string, {
      readonly allowNull?: boolean;
      readonly primaryKey?: boolean;
      readonly defaultValue?: unknown;
    }>;
    expect(columns).toMatchObject({
      id: { allowNull: false, primaryKey: true },
      source_name: { allowNull: false },
      source_mode: { allowNull: false },
      version_key: { allowNull: false },
      source_updated_at: { allowNull: true },
      imported_at: { allowNull: false },
      checksum: { allowNull: true },
      metadata: { allowNull: false },
      created_at: { allowNull: false },
    });
    expect(columns).not.toHaveProperty("trend_id");
    expect(query).toHaveBeenCalledOnce();
    expect(String(query.mock.calls[0]?.[0])).toContain("dataset_versions_source_mode_check");
    expect(String(query.mock.calls[0]?.[0])).toContain("'LIVE', 'CACHED', 'PREPARED'");
    expect(addConstraint).toHaveBeenCalledExactlyOnceWith("dataset_versions", {
      fields: ["source_name", "version_key"],
      type: "unique",
      name: "uq_dataset_versions_source_version",
    });
  });

  it("creates scoring model version rows without activating or seeding a model", async () => {
    const { context, createTable, addConstraint, query } = migrationContext();

    await upScoringModels({ context } as Parameters<typeof upScoringModels>[0]);

    expect(createTable.mock.calls[0]?.[0]).toBe("scoring_models");
    const columns = createTable.mock.calls[0]?.[1] as Record<string, {
      readonly allowNull?: boolean;
      readonly defaultValue?: unknown;
    }>;
    expect(columns).toMatchObject({
      model_type: { allowNull: false },
      version: { allowNull: false },
      weights: { allowNull: false },
      configuration: { allowNull: false },
      is_active: { allowNull: false, defaultValue: false },
      created_at: { allowNull: false },
    });
    expect(query).toHaveBeenCalledOnce();
    expect(String(query.mock.calls[0]?.[0])).toContain("scoring_models_model_type_check");
    expect(String(query.mock.calls[0]?.[0])).toContain("'BUSINESS_FIT', 'RISK'");
    expect(addConstraint).toHaveBeenCalledExactlyOnceWith("scoring_models", {
      fields: ["model_type", "version"],
      type: "unique",
      name: "uq_scoring_models_type_version",
    });
  });

  it("creates nullable analysis snapshots with ownership, version, status and score constraints", async () => {
    const { context, createTable, addIndex, query } = migrationContext();

    await upAnalyses({ context } as Parameters<typeof upAnalyses>[0]);

    expect(createTable.mock.calls[0]?.[0]).toBe("user_opportunity_analyses");
    const columns = createTable.mock.calls[0]?.[1] as Record<string, {
      readonly allowNull?: boolean;
      readonly references?: { readonly model: string; readonly key: string };
      readonly onDelete?: string;
    }>;
    expect(columns).toMatchObject({
      user_id: {
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
      },
      opportunity_id: {
        allowNull: false,
        references: { model: "opportunities", key: "id" },
        onDelete: "RESTRICT",
      },
      dataset_version_id: {
        allowNull: true,
        references: { model: "dataset_versions", key: "id" },
        onDelete: "SET NULL",
      },
      scoring_model_id: {
        allowNull: true,
        references: { model: "scoring_models", key: "id" },
        onDelete: "SET NULL",
      },
      opportunity_score: { allowNull: true },
      fit_score: { allowNull: true },
      score_status: { allowNull: false },
      risk_level: { allowNull: true },
      confidence_level: { allowNull: true },
      opportunity_score_breakdown: { allowNull: false },
      fit_score_breakdown: { allowNull: false },
      risk_reasons: { allowNull: false },
    });
    expect(columns).not.toHaveProperty("trend_id");
    expect(query).toHaveBeenCalledTimes(7);
    const checks = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(checks).toContain("profile_version_check");
    expect(checks).toContain("BETWEEN 0 AND 100");
    expect(checks).toContain("'INSUFFICIENT_DATA'");
    expect(checks).toContain("'LOW', 'MEDIUM', 'HIGH'");
    expect(checks).toContain("jsonb_array_length(\"risk_reasons\") > 0");
    expect(addIndex).toHaveBeenCalledTimes(5);
    expect(addIndex).toHaveBeenCalledWith(
      "user_opportunity_analyses",
      {
        fields: ["user_id", "opportunity_id", { name: "generated_at", order: "DESC" }],
        name: "user_opportunity_analyses_user_opportunity_generated_at_idx",
      },
    );
    expect(addIndex).toHaveBeenCalledWith(
      "user_opportunity_analyses",
      {
        fields: ["user_id", { name: "generated_at", order: "DESC" }],
        name: "user_opportunity_analyses_user_generated_at_idx",
      },
    );
  });

  it("keeps history appendable and rolls back dependent tables in reverse order", async () => {
    const { context, addConstraint, dropTable } = migrationContext();

    await upAnalyses({ context } as Parameters<typeof upAnalyses>[0]);
    expect(addConstraint).not.toHaveBeenCalled();

    await downAnalyses({ context } as Parameters<typeof downAnalyses>[0]);
    await downScoringModels({ context } as Parameters<typeof downScoringModels>[0]);
    await downDatasetVersions({ context } as Parameters<typeof downDatasetVersions>[0]);

    expect(dropTable.mock.calls.map(([table]) => table)).toEqual([
      "user_opportunity_analyses",
      "scoring_models",
      "dataset_versions",
    ]);
  });
});
