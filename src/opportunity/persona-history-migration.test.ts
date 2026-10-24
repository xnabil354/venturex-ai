import type { QueryInterface } from "sequelize";
import { describe, expect, it, vi } from "vitest";

import { down, up } from "../../db/migrations/027-scope-persona-history";

function migrationContext() {
  const addColumn = vi.fn().mockResolvedValue(undefined);
  const changeColumn = vi.fn().mockResolvedValue(undefined);
  const removeColumn = vi.fn().mockResolvedValue(undefined);
  const addConstraint = vi.fn().mockResolvedValue(undefined);
  const removeConstraint = vi.fn().mockResolvedValue(undefined);
  const addIndex = vi.fn().mockResolvedValue(undefined);
  const removeIndex = vi.fn().mockResolvedValue(undefined);
  const query = vi.fn().mockResolvedValue([[], undefined]);
  const context = {
    addColumn,
    changeColumn,
    removeColumn,
    addConstraint,
    removeConstraint,
    addIndex,
    removeIndex,
    sequelize: { query },
  } as unknown as QueryInterface;
  return { context, addColumn, changeColumn, removeColumn, addConstraint, removeConstraint, addIndex, removeIndex, query };
}

describe("persona history migration", () => {
  it("adds and backfills persona scope before enforcing not-null and composite uniqueness", async () => {
    const mocks = migrationContext();
    await up({ context: mocks.context } as Parameters<typeof up>[0]);

    expect(mocks.addColumn).toHaveBeenNthCalledWith(1, "saved_opportunities", "user_type", expect.objectContaining({ allowNull: true }));
    expect(mocks.addColumn).toHaveBeenNthCalledWith(2, "user_opportunity_analyses", "user_type", expect.objectContaining({ allowNull: true }));
    expect(mocks.query.mock.calls.map(([sql]) => String(sql)).join("\n")).toContain('SET "user_type" = users."user_type"');
    expect(mocks.query.mock.calls.map(([sql]) => String(sql)).join("\n")).toContain("analysis.\"ai_analysis\"->>'userType'");
    expect(mocks.changeColumn).toHaveBeenCalledWith("saved_opportunities", "user_type", expect.objectContaining({ allowNull: false }));
    expect(mocks.changeColumn).toHaveBeenCalledWith("user_opportunity_analyses", "user_type", expect.objectContaining({ allowNull: false }));
    expect(mocks.removeConstraint).toHaveBeenCalledWith("saved_opportunities", "uq_saved_opportunity");
    expect(mocks.addConstraint).toHaveBeenCalledWith("saved_opportunities", expect.objectContaining({ name: "uq_saved_opportunity_persona" }));
    expect(mocks.addIndex).toHaveBeenCalledWith("user_opportunity_analyses", expect.objectContaining({ name: "user_opportunity_analyses_user_type_opportunity_generated_at_idx" }));
  });

  it("removes only the additive scope and restores the original relation key on rollback", async () => {
    const mocks = migrationContext();
    await down({ context: mocks.context } as Parameters<typeof down>[0]);

    expect(mocks.removeColumn).toHaveBeenNthCalledWith(1, "user_opportunity_analyses", "user_type");
    expect(mocks.removeColumn).toHaveBeenNthCalledWith(2, "saved_opportunities", "user_type");
    expect(mocks.addConstraint).toHaveBeenCalledWith("saved_opportunities", expect.objectContaining({ name: "uq_saved_opportunity" }));
  });
});
