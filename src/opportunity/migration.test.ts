import type { QueryInterface } from "sequelize";
import { describe, expect, it, vi } from "vitest";

import { down, up } from "../../db/migrations/009-create-opportunities";

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

describe("Opportunity migration source", () => {
  it("defines the Database Design catalog columns and Trend/category foreign keys", async () => {
    const { context, createTable, addIndex, query } = migrationContext();

    await up({ context } as Parameters<typeof up>[0]);

    expect(createTable).toHaveBeenCalledOnce();
    const columns = createTable.mock.calls[0]?.[1] as Record<string, {
      readonly allowNull?: boolean;
      readonly references?: { readonly model: string; readonly key: string };
      readonly onDelete?: string;
    }>;
    expect(columns.name).toMatchObject({ allowNull: false });
    expect(columns.description).toMatchObject({ allowNull: false });
    expect(columns.related_trend_id).toMatchObject({
      allowNull: false,
      references: { model: "trends", key: "id" },
      onDelete: "RESTRICT",
    });
    expect(columns.fnb_category_id).toMatchObject({
      allowNull: false,
      references: { model: "fnb_categories", key: "id" },
      onDelete: "RESTRICT",
    });
    expect(columns.additional_attributes).toMatchObject({ allowNull: false });
    expect(query).toHaveBeenCalledTimes(2);
    expect(addIndex).toHaveBeenCalledTimes(3);
  });

  it("drops only the Opportunity table on rollback", async () => {
    const { context, dropTable } = migrationContext();

    await down({ context } as Parameters<typeof down>[0]);

    expect(dropTable).toHaveBeenCalledExactlyOnceWith("opportunities");
  });
});
