import type { QueryInterface } from "sequelize";
import { describe, expect, it, vi } from "vitest";

import { down, up } from "../../db/migrations/010-create-evidences";

function migrationContext() {
  const createTable = vi.fn().mockResolvedValue(undefined);
  const addIndex = vi.fn().mockResolvedValue(undefined);
  const query = vi.fn().mockResolvedValue([[], undefined]);
  const dropTable = vi.fn().mockResolvedValue(undefined);
  const context = {
    createTable,
    addIndex,
    sequelize: { query },
    dropTable,
  } as unknown as QueryInterface;
  return { context, createTable, addIndex, query, dropTable };
}

describe("Opportunity evidence migration source", () => {
  it("matches the planned shared evidence columns without adding a limitations column", async () => {
    const { context, createTable, addIndex, query } = migrationContext();

    await up({ context } as Parameters<typeof up>[0]);

    expect(createTable).toHaveBeenCalledOnce();
    expect(createTable.mock.calls[0]?.[0]).toBe("evidences");
    const columns = createTable.mock.calls[0]?.[1] as Record<string, {
      readonly allowNull?: boolean;
      readonly references?: { readonly model: string; readonly key: string };
    }>;
    expect(columns).toMatchObject({
      id: { allowNull: false },
      trend_id: {
        allowNull: true,
        references: { model: "trends", key: "id" },
      },
      opportunity_id: {
        allowNull: true,
        references: { model: "opportunities", key: "id" },
      },
      source_name: { allowNull: false },
      source_type: { allowNull: false },
      source_mode: { allowNull: false },
      source_reference: { allowNull: true },
      source_url: { allowNull: true },
      source_date: { allowNull: true },
      retrieved_at: { allowNull: false },
      metadata: { allowNull: false },
      created_at: { allowNull: false },
    });
    expect(columns).not.toHaveProperty("limitations");
    expect(query).toHaveBeenCalledOnce();
    expect(String(query.mock.calls[0]?.[0])).toContain("evidences_exactly_one_parent_check");
    expect(addIndex).toHaveBeenCalledTimes(3);
    expect(addIndex).toHaveBeenCalledWith(
      "evidences",
      {
        fields: [{ name: "source_date", order: "DESC" }],
        name: "evidences_source_date_idx",
      },
    );
  });

  it("drops only the shared evidences table on rollback", async () => {
    const { context, dropTable } = migrationContext();

    await down({ context } as Parameters<typeof down>[0]);

    expect(dropTable).toHaveBeenCalledExactlyOnceWith("evidences");
  });
});
