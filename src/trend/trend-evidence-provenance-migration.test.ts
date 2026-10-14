import type { QueryInterface } from "sequelize";
import { describe, expect, it, vi } from "vitest";

import { down, up } from "../../db/migrations/017-create-trend-evidence-provenances";

function migrationContext() {
  const createTable = vi.fn().mockResolvedValue(undefined);
  const query = vi.fn().mockResolvedValue([[], undefined]);
  const dropTable = vi.fn().mockResolvedValue(undefined);
  const context = { createTable, sequelize: { query }, dropTable } as unknown as QueryInterface;
  return { context, createTable, query, dropTable };
}

describe("Trend evidence provenance migration", () => {
  it("creates one optional one-to-one provenance table with bounded source and metadata constraints", async () => {
    const { context, createTable, query } = migrationContext();
    await up({ context } as Parameters<typeof up>[0]);

    expect(createTable).toHaveBeenCalledTimes(1);
    expect(createTable.mock.calls[0]?.[0]).toBe("trend_evidence_provenances");
    const columns = createTable.mock.calls[0]?.[1] as Record<string, {
      primaryKey?: boolean;
      allowNull?: boolean;
      references?: { model: string; key: string };
      onDelete?: string;
    }>;
    expect(columns.trend_evidence_id).toMatchObject({
      primaryKey: true,
      allowNull: false,
      references: { model: "trend_evidences", key: "id" },
      onDelete: "CASCADE",
    });
    expect(columns.retrieved_at?.allowNull).toBe(true);
    expect(columns.observation_period_start?.allowNull).toBe(true);
    expect(columns.observation_period_end?.allowNull).toBe(true);
    expect(columns.geography_code?.allowNull).toBe(true);
    expect(columns.metrics?.allowNull).toBe(false);

    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).toContain("schema_version\" = 1");
    expect(sql).toContain("google_year_in_search_indonesia_2025");
    expect(sql).toContain("google_trends_trending_now_indonesia");
    expect(sql).toContain("observation_period_end\" >= \"observation_period_start");
    expect(sql).toContain("jsonb_array_length(\"metrics\") <= 3");
    expect(sql).toContain("pg_column_size(\"metrics\") <= 512");
  });

  it("rolls back only the provenance table", async () => {
    const { context, dropTable } = migrationContext();
    await down({ context } as Parameters<typeof down>[0]);
    expect(dropTable.mock.calls.map(([table]) => table)).toEqual(["trend_evidence_provenances"]);
  });
});
