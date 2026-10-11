import "server-only";

import { Op } from "sequelize";
import type { AnalysisRiskLevel, AnalysisScoreStatus } from "../scoring/persistence-types";
import { getUserOpportunityAnalysisModel, type UserOpportunityAnalysis } from "../db/models/user-opportunity-analysis.model";
import type { UserId } from "../auth/user-types";

export type OpportunityAnalysisRecord = {
  readonly id: string;
  readonly userId: UserId;
  readonly opportunityId: string;
  readonly profileVersion: number;
  readonly opportunityScore: string | null;
  readonly fitScore: string | null;
  readonly scoreStatus: AnalysisScoreStatus;
  readonly riskLevel: AnalysisRiskLevel | null;
  readonly riskReasons: unknown[];
  readonly aiAnalysis: Record<string, unknown> | null;
  readonly aiProvider: string | null;
  readonly aiModel: string | null;
  readonly generatedAt: Date;
};

export type OpportunityAnalysisCreateValues = Omit<OpportunityAnalysisRecord, "id"> & {
  readonly datasetVersionId: string | null;
  readonly scoringModelId: string | null;
  readonly confidenceLevel: "LOW" | "MEDIUM" | "HIGH" | null;
  readonly opportunityScoreBreakdown: Record<string, unknown>;
  readonly fitScoreBreakdown: Record<string, unknown>;
  readonly createdAt: Date;
};

export interface OpportunityAnalysisRepositoryPort {
  findLatest(userId: UserId, opportunityId: string, contextFingerprint: string): Promise<OpportunityAnalysisRecord | null>;
  create(values: OpportunityAnalysisCreateValues): Promise<OpportunityAnalysisRecord>;
}

function toRecord(model: UserOpportunityAnalysis): OpportunityAnalysisRecord {
  return {
    id: model.id,
    userId: model.userId,
    opportunityId: model.opportunityId,
    profileVersion: model.profileVersion,
    opportunityScore: model.opportunityScore,
    fitScore: model.fitScore,
    scoreStatus: model.scoreStatus,
    riskLevel: model.riskLevel,
    riskReasons: model.riskReasons,
    aiAnalysis: model.aiAnalysis,
    aiProvider: model.aiProvider,
    aiModel: model.aiModel,
    generatedAt: model.generatedAt,
  };
}

export class OpportunityAnalysisRepository implements OpportunityAnalysisRepositoryPort {
  private readonly model: typeof UserOpportunityAnalysis;

  constructor(model: typeof UserOpportunityAnalysis = getUserOpportunityAnalysisModel()) {
    this.model = model;
  }

  async findLatest(userId: UserId, opportunityId: string, contextFingerprint: string): Promise<OpportunityAnalysisRecord | null> {
    const model = await this.model.findOne({
      where: { userId, opportunityId, aiAnalysis: { [Op.contains]: { contextFingerprint } as never } },
      order: [["generatedAt", "DESC"], ["id", "ASC"]],
    });
    return model ? toRecord(model) : null;
  }

  async create(values: OpportunityAnalysisCreateValues): Promise<OpportunityAnalysisRecord> {
    const model = await this.model.create({
      ...values,
    });
    return toRecord(model);
  }
}
