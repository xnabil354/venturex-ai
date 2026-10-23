import type { QueryInterface } from "sequelize";
import { describe, expect, it, vi } from "vitest";

import { down, up } from "../../db/migrations/016-create-roadmaps";

function migrationContext() {
  const createTable = vi.fn().mockResolvedValue(undefined);
  const query = vi.fn().mockResolvedValue([[], undefined]);
  const addIndex = vi.fn().mockResolvedValue(undefined);
  const dropTable = vi.fn().mockResolvedValue(undefined);
  const context = { createTable, sequelize: { query }, addIndex, dropTable } as unknown as QueryInterface;
  return { context, createTable, query, addIndex, dropTable };
}

describe("Roadmap persistence migration", () => {
  it("creates the documented tables, foreign keys, indexes, and checks", async () => {
    const { context, createTable, query, addIndex } = migrationContext();
    await up({ context } as Parameters<typeof up>[0]);

    expect(createTable.mock.calls.map(([table]) => table)).toEqual(["roadmaps", "roadmap_steps"]);
    const roadmaps = createTable.mock.calls[0]?.[1] as Record<string, { allowNull?: boolean; references?: { model: string; key: string }; onDelete?: string }>;
    expect(roadmaps.user_id).toMatchObject({ allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" });
    expect(roadmaps.opportunity_id).toMatchObject({ allowNull: false, references: { model: "opportunities", key: "id" }, onDelete: "RESTRICT" });
    expect(roadmaps.user_opportunity_analysis_id).toMatchObject({ allowNull: true, references: { model: "user_opportunity_analyses", key: "id" }, onDelete: "SET NULL" });
    expect(roadmaps.generation_context).toMatchObject({ allowNull: false });

    const steps = createTable.mock.calls[1]?.[1] as Record<string, { allowNull?: boolean; references?: { model: string; key: string }; onDelete?: string }>;
    expect(steps.roadmap_id).toMatchObject({ allowNull: false, references: { model: "roadmaps", key: "id" }, onDelete: "CASCADE" });
    expect(steps.expected_output).toMatchObject({ allowNull: false });
    expect(addIndex).toHaveBeenCalledTimes(4);
    expect(query.mock.calls.map(([sql]) => String(sql)).join("\n")).toContain("sequence\" > 0");
    expect(query.mock.calls.map(([sql]) => String(sql)).join("\n")).toContain("'STARTUP', 'GROWTH'");
  });

  it("drops child rows before roadmap headers", async () => {
    const { context, dropTable } = migrationContext();
    await down({ context } as Parameters<typeof down>[0]);
    expect(dropTable.mock.calls.map(([table]) => table)).toEqual(["roadmap_steps", "roadmaps"]);
  });
});
