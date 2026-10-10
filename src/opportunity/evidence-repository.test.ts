import { Op } from "sequelize";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { USER_TYPES } from "../auth/user-types";
import { OpportunityEvidence } from "../db/models/evidence.model";
import { Opportunity } from "../db/models/opportunity.model";
import { Trend } from "../db/models/trend.model";
import { FnbCategory } from "../reference/fnb-category.model";
import { opportunityIdSchema } from "./domain";
import { OpportunityEvidenceRepository } from "./evidence-repository";

const opportunityId = opportunityIdSchema.parse("60000000-0000-4000-8000-000000000001");
const evidenceRecord = {
  id: "61000000-0000-4000-8000-000000000001",
  sourceName: "Laporan industri",
  sourceType: "Government/Open Data",
  sourceReference: "Dataset seri 4, tabel 2",
  sourceUrl: "https://example.org/dataset",
  sourceDate: new Date("2026-01-15T00:00:00.000Z"),
  retrievedAt: new Date("2026-02-01T10:30:00.000Z"),
  metadata: { limitations: "Cakupan data hanya beberapa kota." },
};

function createRepository(evidences: readonly typeof evidenceRecord[] | null = [evidenceRecord]) {
  const findOne = vi.fn().mockResolvedValue(
    evidences === null ? null : { id: opportunityId, evidences },
  );
  const opportunityModel = {
    associations: { relatedTrend: {}, category: {}, evidences: {} },
    belongsTo: vi.fn(),
    hasMany: vi.fn(),
    findOne,
  } as unknown as typeof Opportunity;
  const evidenceModel = {
    associations: { opportunity: {} },
    belongsTo: vi.fn(),
  } as unknown as typeof OpportunityEvidence;
  const repository = new OpportunityEvidenceRepository(
    evidenceModel,
    opportunityModel,
    {} as typeof Trend,
    {} as typeof FnbCategory,
  );
  return { repository, findOne, opportunityModel, evidenceModel };
}

describe("OpportunityEvidenceRepository", () => {
  it.each([USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING])(
    "loads only Opportunity evidence when its Trend is published and eligible for %s",
    async (userType) => {
      const { repository, findOne, evidenceModel } = createRepository();

      await expect(repository.findForVisibleOpportunity(userType, opportunityId)).resolves.toEqual([
        {
          ...evidenceRecord,
        },
      ]);

      const options = findOne.mock.calls[0]?.[0] as {
        readonly where: { readonly id: string };
        readonly include: readonly Record<string, unknown>[];
      };
      expect(options.where).toEqual({ id: opportunityId });
      expect(options.include).toEqual(expect.arrayContaining([
        expect.objectContaining({
          model: expect.anything(),
          as: "relatedTrend",
          required: true,
          where: {
            lifecycleState: "PUBLISHED",
            affectedUserTypes: { [Op.contains]: [userType] },
          },
        }),
        expect.objectContaining({
          model: evidenceModel,
          as: "evidences",
          required: false,
        }),
        expect.objectContaining({ as: "category", required: true }),
      ]));
      expect(options.include.find(({ as }) => as === "evidences")?.model).toBe(evidenceModel);
    },
  );

  it("returns an empty list for a visible Opportunity with no evidence", async () => {
    const { repository } = createRepository([]);

    await expect(repository.findForVisibleOpportunity(USER_TYPES.ENTREPRENEUR, opportunityId))
      .resolves.toEqual([]);
  });

  it("returns null when the Opportunity or its eligible Trend is unavailable", async () => {
    const { repository } = createRepository(null);

    await expect(repository.findForVisibleOpportunity(USER_TYPES.ENTREPRENEUR, opportunityId))
      .resolves.toBeNull();
  });

  it("registers the dedicated evidences association, not trend_evidences", () => {
    const findOne = vi.fn().mockResolvedValue({ id: opportunityId, evidences: [] });
    const opportunityModel = {
      associations: {},
      belongsTo: vi.fn(),
      hasMany: vi.fn(),
      findOne,
    } as unknown as typeof Opportunity;
    const evidenceModel = {
      associations: {},
      belongsTo: vi.fn(),
    } as unknown as typeof OpportunityEvidence;

    new OpportunityEvidenceRepository(
      evidenceModel,
      opportunityModel,
      {} as typeof Trend,
      {} as typeof FnbCategory,
    );

    expect(opportunityModel.hasMany).toHaveBeenCalledWith(evidenceModel, {
      as: "evidences",
      foreignKey: "opportunityId",
    });
    expect(evidenceModel.belongsTo).toHaveBeenCalledWith(opportunityModel, {
      as: "opportunity",
      foreignKey: "opportunityId",
    });
  });
});
