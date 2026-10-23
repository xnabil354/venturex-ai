import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { Op } from "sequelize";

import { USER_TYPES } from "../auth/user-types";
import type { OpportunityEvidence } from "../db/models/evidence.model";
import type { OpportunityFitRequirement } from "../db/models/opportunity-fit-requirement.model";
import type { Opportunity } from "../db/models/opportunity.model";
import type { ScoringModel } from "../db/models/scoring-model.model";
import type { Trend } from "../db/models/trend.model";
import type { FnbCategory } from "../reference/fnb-category.model";
import { RiskAssessmentRepository } from "./risk-assessment-repository";

const opportunityId = "60000000-0000-4000-8000-000000000001";

function opportunityModel(findAll: ReturnType<typeof vi.fn>) {
  return {
    associations: { relatedTrend: {}, category: {}, evidences: {}, fitRequirements: {} },
    findAll,
    belongsTo: vi.fn(),
    hasMany: vi.fn(),
    hasOne: vi.fn(),
  } as unknown as typeof Opportunity;
}

describe("RiskAssessmentRepository", () => {
  it("loads supported inputs, evidence refs, and only published audience-eligible Opportunities in one batch", async () => {
    const findAll = vi.fn(async (_options: unknown) => [{
      id: opportunityId,
      competitionLevel: "High",
      executionFeasibility: "71.50",
      marketSustainability: "62.00",
      fitRequirements: {
        capitalMin: "1000000",
        capitalMax: "5000000",
        operationalComplexity: "75.00",
      },
      relatedTrend: {
        lifecycleState: "PUBLISHED",
        affectedUserTypes: [USER_TYPES.ENTREPRENEUR],
      },
      evidences: [{
        sourceName: "Laporan resmi",
        sourceType: "Government/Open Data",
        sourceReference: "Dataset 4",
        sourceUrl: "https://example.org/dataset",
        sourceDate: new Date("2026-01-15T00:00:00.000Z"),
        retrievedAt: new Date("2026-02-01T00:00:00.000Z"),
        metadata: {},
      }],
    }]);
    const repository = new RiskAssessmentRepository(
      opportunityModel(findAll),
      {} as typeof Trend,
      {} as typeof FnbCategory,
      {} as typeof OpportunityFitRequirement,
      {} as typeof OpportunityEvidence,
      {} as typeof ScoringModel,
    );

    const result = await repository.findVisibleSources(USER_TYPES.ENTREPRENEUR, [opportunityId]);
    const options = findAll.mock.calls[0]?.[0] as {
      readonly where: Record<string, unknown>;
      readonly include: readonly { readonly as: string; readonly where?: Record<string, unknown> }[];
    };

    expect(result).toMatchObject([{
      id: opportunityId,
      inputs: {
        competitionLevel: { value: "High", reference: "opportunities.competition_level" },
        capitalMin: { value: "1000000", reference: "opportunity_fit_requirements.capital_min" },
        operationalComplexity: { value: "75.00", reference: "opportunity_fit_requirements.operational_complexity" },
        executionFeasibility: { value: "71.50", reference: "opportunities.execution_feasibility" },
      },
      evidenceReferences: [{ sourceName: "Laporan resmi", sourceReference: "Dataset 4" }],
    }]);
    expect(options.where).toEqual({ id: { [Op.in]: [opportunityId] } });
    expect(options.include.find(({ as }) => as === "relatedTrend")?.where).toEqual({
      lifecycleState: "PUBLISHED",
      affectedUserTypes: { [Op.contains]: [USER_TYPES.ENTREPRENEUR] },
    });
    expect(options.include.find(({ as }) => as === "category")?.where).toBeUndefined();
    expect(options.include.map(({ as }) => as)).toEqual([
      "relatedTrend",
      "category",
      "fitRequirements",
      "evidences",
    ]);
  });

  it("does not pass unsafe persisted evidence URLs to the assessment display", async () => {
    const findAll = vi.fn(async (_options: unknown) => [{
      id: opportunityId,
      competitionLevel: null,
      executionFeasibility: null,
      marketSustainability: null,
      fitRequirements: null,
      relatedTrend: {
        lifecycleState: "PUBLISHED",
        affectedUserTypes: [USER_TYPES.ENTREPRENEUR],
      },
      evidences: [{
        id: "90000000-0000-4000-8000-000000000001",
        sourceName: "Sumber",
        sourceType: "Report",
        sourceReference: "Reference",
        sourceUrl: "javascript:alert(1)",
        sourceDate: null,
        retrievedAt: new Date("2026-02-01T00:00:00.000Z"),
        metadata: {},
      }],
    }]);
    const repository = new RiskAssessmentRepository(
      opportunityModel(findAll),
      {} as typeof Trend,
      {} as typeof FnbCategory,
      {} as typeof OpportunityFitRequirement,
      {} as typeof OpportunityEvidence,
      {} as typeof ScoringModel,
    );

    const result = await repository.findVisibleSources(USER_TYPES.ENTREPRENEUR, [opportunityId]);
    expect(result[0]?.evidenceReferences).toEqual([{
      sourceName: "Sumber",
      sourceReference: "Reference",
      sourceUrl: null,
    }]);
  });

  it("queries only active RISK models and leaves product approval to the service", async () => {
    const findAll = vi.fn(async (_options: unknown) => []);
    const repository = new RiskAssessmentRepository(
      opportunityModel(vi.fn(async () => [])),
      {} as typeof Trend,
      {} as typeof FnbCategory,
      {} as typeof OpportunityFitRequirement,
      {} as typeof OpportunityEvidence,
      { findAll } as unknown as typeof ScoringModel,
    );

    await repository.findActiveModels();
    const options = findAll.mock.calls[0]?.[0] as { readonly where: Record<string, unknown> };
    expect(options.where).toEqual({ modelType: "RISK", isActive: true });
  });

  it("does not query opportunities for an empty batch", async () => {
    const findAll = vi.fn(async (_options: unknown) => []);
    const repository = new RiskAssessmentRepository(
      opportunityModel(findAll),
      {} as typeof Trend,
      {} as typeof FnbCategory,
      {} as typeof OpportunityFitRequirement,
      {} as typeof OpportunityEvidence,
      {} as typeof ScoringModel,
    );

    await expect(repository.findVisibleSources(USER_TYPES.ENTREPRENEUR, [])).resolves.toEqual([]);
    expect(findAll).not.toHaveBeenCalled();
  });
});
