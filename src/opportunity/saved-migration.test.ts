import type { QueryInterface } from "sequelize";
import { describe, expect, it, vi } from "vitest";

import { down, up } from "../../db/migrations/011-create-saved-opportunities";

function migrationContext() {
  const createTable = vi.fn().mockResolvedValue(undefined);
  const addConstraint = vi.fn().mockResolvedValue(undefined);
  const dropTable = vi.fn().mockResolvedValue(undefined);
  const context = { createTable, addConstraint, dropTable } as unknown as QueryInterface;
  return { context, createTable, addConstraint, dropTable };
}

describe("Saved Opportunity migration source", () => {
  it("creates owned relations with master-preserving foreign keys and a unique user/opportunity key", async () => {
    const { context, createTable, addConstraint } = migrationContext();

    await up({ context } as Parameters<typeof up>[0]);

    expect(createTable).toHaveBeenCalledOnce();
    expect(createTable.mock.calls[0]?.[0]).toBe("saved_opportunities");
    const columns = createTable.mock.calls[0]?.[1] as Record<string, {
      readonly allowNull?: boolean;
      readonly references?: { readonly model: string; readonly key: string };
      readonly onDelete?: string;
    }>;
    expect(columns).toMatchObject({
      id: { allowNull: false },
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
      created_at: { allowNull: false },
    });
    expect(addConstraint).toHaveBeenCalledExactlyOnceWith("saved_opportunities", {
      fields: ["user_id", "opportunity_id"],
      type: "unique",
      name: "uq_saved_opportunity",
    });
  });

  it("drops only the saved relation table on rollback", async () => {
    const { context, dropTable } = migrationContext();

    await down({ context } as Parameters<typeof down>[0]);

    expect(dropTable).toHaveBeenCalledExactlyOnceWith("saved_opportunities");
  });
});
