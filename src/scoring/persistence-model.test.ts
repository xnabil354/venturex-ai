import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sequelize: undefined as unknown }));

vi.mock("../db/sequelize", () => ({
  getSequelize: () => mocks.sequelize as import("sequelize").Sequelize,
}));

import { Sequelize } from "sequelize";

import { parseUserId } from "../auth/user-types";
import { getDatasetVersionModel } from "../db/models/dataset-version.model";
import { getOpportunityModel } from "../db/models/opportunity.model";
import { getScoringModel } from "../db/models/scoring-model.model";
import { getUserModel } from "../db/models/user.model";
import { getUserOpportunityAnalysisModel } from "../db/models/user-opportunity-analysis.model";
import { initializeScoringPersistenceAssociations } from "./persistence-associations";

let sequelize: Sequelize;

beforeAll(() => {
  sequelize = new Sequelize({ dialect: "postgres", logging: false });
  mocks.sequelize = sequelize;
});

afterAll(async () => {
  await sequelize.close();
});

describe("scoring persistence models", () => {
  it("validates dataset modes and scoring model types without supplying weights", async () => {
    const DatasetVersion = getDatasetVersionModel();
    const ScoringModel = getScoringModel();

    const dataset = DatasetVersion.build({
      sourceName: "approved-source",
      sourceMode: "PREPARED",
      versionKey: "version-1",
      sourceUpdatedAt: null,
      checksum: null,
      metadata: {},
    });
    await expect(dataset.validate()).resolves.toBeDefined();

    const invalidDataset = DatasetVersion.build({
      sourceName: "approved-source",
      sourceMode: "UNAPPROVED" as never,
      versionKey: "version-2",
      sourceUpdatedAt: null,
      checksum: null,
      metadata: {},
    });
    await expect(invalidDataset.validate()).rejects.toThrow();

    const scoringModel = ScoringModel.build({
      modelType: "OPPORTUNITY_SCORE",
      version: "v1",
      weights: {},
    });
    await expect(scoringModel.validate()).resolves.toBeDefined();
    expect(scoringModel.isActive).toBe(false);
    expect(scoringModel.configuration).toEqual({});
    expect(ScoringModel.rawAttributes.weights?.defaultValue).toBeUndefined();

    const invalidScoringModel = ScoringModel.build({
      modelType: "UNAPPROVED" as never,
      version: "v1",
      weights: {},
    });
    await expect(invalidScoringModel.validate()).rejects.toThrow();
  });

  it("accepts nullable scores and INSUFFICIENT_DATA without fabricating score values", async () => {
    const UserOpportunityAnalysis = getUserOpportunityAnalysisModel();
    const analysis = UserOpportunityAnalysis.build({
      userId: parseUserId("10000000-0000-4000-8000-000000000001"),
      userType: "ENTREPRENEUR" as const,
      opportunityId: "20000000-0000-4000-8000-000000000001",
      datasetVersionId: null,
      scoringModelId: null,
      profileVersion: 1,
      opportunityScore: null,
      fitScore: null,
      scoreStatus: "INSUFFICIENT_DATA",
      riskLevel: null,
      confidenceLevel: null,
      opportunityScoreBreakdown: {},
      fitScoreBreakdown: {},
      riskReasons: [],
      aiAnalysis: null,
      aiProvider: null,
      aiModel: null,
      generatedAt: new Date("2026-10-09T00:00:00.000Z"),
      createdAt: new Date("2026-10-09T00:00:00.000Z"),
    });

    await expect(analysis.validate()).resolves.toBeDefined();
    expect(analysis.opportunityScore).toBeNull();
    expect(analysis.fitScore).toBeNull();
    expect(UserOpportunityAnalysis.rawAttributes.opportunityScore?.allowNull).toBe(true);
    expect(UserOpportunityAnalysis.rawAttributes.fitScore?.allowNull).toBe(true);
    expect(UserOpportunityAnalysis.rawAttributes.opportunityScore?.defaultValue).toBeUndefined();
    expect(UserOpportunityAnalysis.rawAttributes.fitScore?.defaultValue).toBeUndefined();
  });

  it("rejects invalid score ranges, statuses, levels, versions, and missing risk reasons", async () => {
    const UserOpportunityAnalysis = getUserOpportunityAnalysisModel();
    const base = {
      userId: parseUserId("10000000-0000-4000-8000-000000000001"),
      userType: "ENTREPRENEUR" as const,
      opportunityId: "20000000-0000-4000-8000-000000000001",
      datasetVersionId: null,
      scoringModelId: null,
      profileVersion: 1,
      opportunityScore: "100.01",
      fitScore: null,
      scoreStatus: "AVAILABLE" as const,
      riskLevel: null,
      confidenceLevel: null,
      opportunityScoreBreakdown: {},
      fitScoreBreakdown: {},
      riskReasons: [],
      aiAnalysis: null,
      aiProvider: null,
      aiModel: null,
      generatedAt: new Date("2026-10-09T00:00:00.000Z"),
      createdAt: new Date("2026-10-09T00:00:00.000Z"),
    };

    await expect(UserOpportunityAnalysis.build(base).validate()).rejects.toThrow();
    await expect(
      UserOpportunityAnalysis.build({ ...base, opportunityScore: null, scoreStatus: "UNKNOWN" as never }).validate(),
    ).rejects.toThrow();
    await expect(
      UserOpportunityAnalysis.build({ ...base, opportunityScore: null, profileVersion: 0 }).validate(),
    ).rejects.toThrow();
    await expect(
      UserOpportunityAnalysis.build({ ...base, opportunityScore: null, riskLevel: "EXTREME" as never }).validate(),
    ).rejects.toThrow();
    await expect(
      UserOpportunityAnalysis.build({ ...base, opportunityScore: null, riskLevel: "HIGH" }).validate(),
    ).rejects.toThrow("Risk requires at least one reason.");
  });

  it("associates analyses to users, opportunities, dataset versions, and scoring models without Trend linkage", () => {
    initializeScoringPersistenceAssociations();
    initializeScoringPersistenceAssociations();

    const User = getUserModel();
    const Opportunity = getOpportunityModel();
    const DatasetVersion = getDatasetVersionModel();
    const ScoringModel = getScoringModel();
    const UserOpportunityAnalysis = getUserOpportunityAnalysisModel();

    expect(User.associations.opportunityAnalyses).toMatchObject({ foreignKey: "userId" });
    expect(UserOpportunityAnalysis.associations.user).toMatchObject({ options: { onDelete: "CASCADE" } });
    expect(Opportunity.associations.analyses).toMatchObject({ foreignKey: "opportunityId" });
    expect(UserOpportunityAnalysis.associations.opportunity).toMatchObject({ options: { onDelete: "RESTRICT" } });
    expect(DatasetVersion.associations.analyses).toMatchObject({ foreignKey: "datasetVersionId" });
    expect(UserOpportunityAnalysis.associations.datasetVersion).toMatchObject({ options: { onDelete: "SET NULL" } });
    expect(ScoringModel.associations.analyses).toMatchObject({ foreignKey: "scoringModelId" });
    expect(UserOpportunityAnalysis.associations.scoringModel).toMatchObject({ options: { onDelete: "SET NULL" } });
    expect(DatasetVersion.associations.trends).toBeUndefined();
    expect(UserOpportunityAnalysis.options.indexes?.some(({ unique }) => unique)).toBe(false);
  });
});
