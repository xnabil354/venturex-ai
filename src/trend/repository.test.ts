import { describe, expect, it, vi } from "vitest";
import type { Sequelize } from "sequelize";

vi.mock("server-only", () => ({}));

import { getFnbCategoryModel } from "../reference/fnb-category.model";
import { Trend, TrendEvidence } from "../db/models/trend.model";
import { TrendRepository } from "./repository";

describe("TrendRepository.listPublished", () => {
  it("queries only PUBLISHED records in deterministic catalog order", async () => {
    const findAll = vi.fn().mockResolvedValue([]);
    const trendModel = { findAll } as unknown as typeof Trend;
    const evidenceModel = {} as typeof TrendEvidence;
    const categoryModel = {} as ReturnType<typeof getFnbCategoryModel>;
    const repository = new TrendRepository(
      {} as Sequelize,
      trendModel,
      evidenceModel,
      categoryModel,
    );

    await repository.listPublished();

    expect(findAll).toHaveBeenCalledWith({
      where: { lifecycleState: "PUBLISHED" },
      order: [["createdAt", "DESC"], ["id", "ASC"]],
    });
  });
});
