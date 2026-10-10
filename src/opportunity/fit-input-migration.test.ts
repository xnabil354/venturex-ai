import type { QueryInterface } from "sequelize";
import { describe, expect, it, vi } from "vitest";

import { down, up } from "../../db/migrations/015-create-opportunity-fit-inputs";

function migrationContext() {
  const createTable = vi.fn().mockResolvedValue(undefined);
  const query = vi.fn().mockResolvedValue([[], undefined]);
  const dropTable = vi.fn().mockResolvedValue(undefined);
  const context = { createTable, sequelize: { query }, dropTable } as unknown as QueryInterface;
  return { context, createTable, query, dropTable };
}

describe("Opportunity fit input migration", () => {
  it("creates only the designed requirement and junction tables with keys and delete behavior", async () => {
    const { context, createTable, query } = migrationContext();

    await up({ context } as Parameters<typeof up>[0]);

    expect(createTable.mock.calls.map(([table]) => table)).toEqual([
      "opportunity_fit_requirements",
      "opportunity_customer_segments",
      "opportunity_sales_channels",
    ]);

    const requirements = createTable.mock.calls[0]?.[1] as Record<string, {
      readonly allowNull?: boolean;
      readonly primaryKey?: boolean;
      readonly references?: { readonly model: string; readonly key: string };
      readonly onDelete?: string;
      readonly defaultValue?: unknown;
    }>;
    expect(requirements).toMatchObject({
      opportunity_id: {
        allowNull: false,
        primaryKey: true,
        references: { model: "opportunities", key: "id" },
        onDelete: "CASCADE",
      },
      capital_min: { allowNull: true },
      capital_max: { allowNull: true },
      expected_price_min: { allowNull: true },
      expected_price_max: { allowNull: true },
      required_experience_level: { allowNull: true },
      required_time_commitment: { allowNull: true },
      operational_complexity: { allowNull: true },
      location_scope: { allowNull: true },
      metadata: { allowNull: false },
      updated_at: { allowNull: false },
    });
    expect(requirements.metadata).not.toHaveProperty("defaultValue");
    expect(requirements.updated_at).not.toHaveProperty("defaultValue");

    const customerSegments = createTable.mock.calls[1]?.[1] as Record<string, {
      readonly primaryKey?: boolean;
      readonly references?: { readonly model: string; readonly key: string };
      readonly onDelete?: string;
    }>;
    expect(customerSegments).toMatchObject({
      opportunity_id: {
        primaryKey: true,
        references: { model: "opportunities", key: "id" },
        onDelete: "CASCADE",
      },
      customer_segment_id: {
        primaryKey: true,
        references: { model: "customer_segments", key: "id" },
        onDelete: "RESTRICT",
      },
    });

    const salesChannels = createTable.mock.calls[2]?.[1] as Record<string, {
      readonly primaryKey?: boolean;
      readonly references?: { readonly model: string; readonly key: string };
      readonly onDelete?: string;
    }>;
    expect(salesChannels).toMatchObject({
      opportunity_id: {
        primaryKey: true,
        references: { model: "opportunities", key: "id" },
        onDelete: "CASCADE",
      },
      sales_channel_id: {
        primaryKey: true,
        references: { model: "sales_channels", key: "id" },
        onDelete: "RESTRICT",
      },
    });
    expect(query).toHaveBeenCalledTimes(3);
    const constraints = query.mock.calls.map(([sql]) => String(sql)).join("\n");
    expect(constraints).toContain("capital_range_check");
    expect(constraints).toContain("expected_price_range_check");
    expect(constraints).toContain("operational_complexity" + '" BETWEEN 0 AND 100');
  });

  it("drops dependent junctions before requirements", async () => {
    const { context, dropTable } = migrationContext();

    await down({ context } as Parameters<typeof down>[0]);

    expect(dropTable.mock.calls.map(([table]) => table)).toEqual([
      "opportunity_sales_channels",
      "opportunity_customer_segments",
      "opportunity_fit_requirements",
    ]);
  });
});
