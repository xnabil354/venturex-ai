import "server-only";
import { getSequelize } from "../db/sequelize";
import { entrepreneurAnalysisSchema, type EntrepreneurAnalysis } from "./entrepreneur-analysis-contract";
import { generatePrivateStartupRoadmap } from "../roadmap/private-startup-generator";
import { privateStartupRoadmapSchema } from "../roadmap/private-startup-contract";
import { businessAnalysisSchema, privateGrowthRoadmapSchema, type BusinessAnalysis } from "./business-analysis-contract";
import { generatePrivateGrowthRoadmap } from "../roadmap/private-growth-generator";

import { getUserGeneratedOpportunityModel, type UserGeneratedOpportunity } from "../db/models/user-generated-opportunity.model";
import {
  privateOpportunityHypothesisSchema,
  privateOpportunityModelSchema,
  privateOpportunitySourceSchema,
  type PrivateOpportunityIdeaDto,
  type PrivateOpportunityHypothesis,
  type PrivateOpportunitySource,
} from "./private-hypothesis";

export type PrivateHypothesisPersistenceInput = Readonly<{
  userId: string;
  userType: "ENTREPRENEUR" | "UMKM_EXISTING";
  hypothesis: PrivateOpportunityHypothesis;
  sourceReference: PrivateOpportunitySource;
  provider: "ninerouter";
  model: string;
  generatedAt: Date;
}>;

function toDto(record: UserGeneratedOpportunity): PrivateOpportunityIdeaDto | null {
  let hypothesis = privateOpportunityHypothesisSchema.safeParse(record.hypothesis);
  if (!hypothesis.success && record.hypothesis && typeof record.hypothesis === "object") {
    const { analysis, startupRoadmap, businessAnalysis, growthRoadmap, ...base } = record.hypothesis;
    const safeAnalysis = entrepreneurAnalysisSchema.safeParse(analysis);
    const safeRoadmap = privateStartupRoadmapSchema.safeParse(startupRoadmap);
    const business = businessAnalysisSchema.safeParse(businessAnalysis);
    const growth = privateGrowthRoadmapSchema.safeParse(growthRoadmap);
    hypothesis = privateOpportunityHypothesisSchema.safeParse({ ...base, ...(safeAnalysis.success ? { analysis: safeAnalysis.data } : {}), ...(safeRoadmap.success ? { startupRoadmap: safeRoadmap.data } : {}), ...(business.success ? { businessAnalysis: business.data } : {}), ...(growth.success ? { growthRoadmap: growth.data } : {}) });
  }
  const source = privateOpportunitySourceSchema.safeParse(record.sourceReference);
  const model = privateOpportunityModelSchema.safeParse(record.model);
  if (!hypothesis.success || !source.success || !model.success || !record.id) return null;
  return {
    id: record.id,
    hypothesis: hypothesis.data,
    source: source.data,
    provider: "ninerouter",
    model: model.data,
    generatedAt: record.generatedAt.toISOString(),
    saved: record.isSaved,
  };
}

export class PrivateHypothesisStateError extends Error {
  constructor(readonly code: "ANALYSIS_REQUIRED" | "ANALYSIS_CHANGED" | "SAVED_PERMANENT") { super(code); }
}

export class PrivateOpportunityHypothesisRepository {
  private readonly model = getUserGeneratedOpportunityModel();

  async createMany(input: readonly PrivateHypothesisPersistenceInput[]): Promise<readonly PrivateOpportunityIdeaDto[]> {
    const rows = await this.model.bulkCreate(input.map((item) => ({
      userId: item.userId,
      userType: item.userType,
      hypothesis: item.hypothesis,
      sourceReference: item.sourceReference,
      provider: item.provider,
      model: item.model,
      generatedAt: item.generatedAt,
      isSaved: false,
      savedAt: null,
    })), { returning: true });
    return rows.map(toDto).filter((item): item is PrivateOpportunityIdeaDto => item !== null);
  }

  async listForUser(userId: string, savedOnly = false): Promise<readonly PrivateOpportunityIdeaDto[]> {
    const rows = await this.model.findAll({
      where: { userId, ...(savedOnly ? { isSaved: true } : {}) },
      order: [["createdAt", "DESC"], ["id", "ASC"]],
      limit: 50,
    });
    return rows.map(toDto).filter((item): item is PrivateOpportunityIdeaDto => item !== null);
  }

  async findForEntrepreneur(userId: string, id: string): Promise<PrivateOpportunityIdeaDto | null> {
    const row = await this.model.findOne({ where: { id, userId, userType: "ENTREPRENEUR" } });
    return row ? toDto(row) : null;
  }

  async findForBusiness(userId: string, id: string): Promise<PrivateOpportunityIdeaDto | null> {
    const row = await this.model.findOne({ where: { id, userId, userType: "UMKM_EXISTING" } });
    return row ? toDto(row) : null;
  }

  async listBusinessPage(userId: string, page = 1, savedOnly = false, roadmapOnly = false) {
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new Error("INVALID_PAGE");
    const rows = await this.model.findAll({ where: { userId, userType: "UMKM_EXISTING", ...(savedOnly ? { isSaved: true } : {}), ...(roadmapOnly ? { "hypothesis.growthRoadmap.version": "private-growth-v1" } : {}) }, order: [["createdAt", "DESC"], ["id", "ASC"]], limit: 13, offset: (page - 1) * 12 });
    return { items: rows.slice(0, 12).map(toDto).filter((item): item is PrivateOpportunityIdeaDto => item !== null), page, hasMore: rows.length > 12 };
  }

  async saveBusinessAnalysis(userId: string, id: string, analysis: BusinessAnalysis, expectedFingerprint: string | null): Promise<boolean> {
    const snapshot = businessAnalysisSchema.parse(analysis);
    return getSequelize().transaction(async transaction => {
      const row = await this.model.findOne({ where: { id, userId, userType: "UMKM_EXISTING" }, transaction, lock: transaction.LOCK.UPDATE });
      if (!row) return false;
      const old = businessAnalysisSchema.safeParse(row.hypothesis.businessAnalysis);
      if ((old.success ? old.data.inputFingerprint : null) !== expectedFingerprint) return false;
      await row.update({ hypothesis: { ...row.hypothesis, businessAnalysis: snapshot }, updatedAt: new Date() }, { transaction });
      return true;
    });
  }

  async createGrowthRoadmap(userId: string, id: string, expectedFingerprint: string): Promise<PrivateOpportunityIdeaDto | null> {
    return getSequelize().transaction(async transaction => {
      const row = await this.model.findOne({ where: { id, userId, userType: "UMKM_EXISTING" }, transaction, lock: transaction.LOCK.UPDATE });
      if (!row) return null;
      const item = toDto(row);
      const analysis = item?.hypothesis.businessAnalysis;
      if (!item?.saved || !analysis?.requirements || analysis.opportunity.score === null || analysis.fit.score === null) throw new PrivateHypothesisStateError("ANALYSIS_REQUIRED");
      if (analysis.inputFingerprint !== expectedFingerprint) throw new PrivateHypothesisStateError("ANALYSIS_CHANGED");
      if (item.hypothesis.growthRoadmap) return item;
      const growthRoadmap = generatePrivateGrowthRoadmap(item);
      await row.update({ hypothesis: { ...row.hypothesis, growthRoadmap }, updatedAt: new Date() }, { transaction });
      return toDto(row);
    });
  }

  async listPageForUser(userId: string, page = 1, savedOnly = false, roadmapOnly = false) {
    const pageSize = 12;
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new Error("INVALID_PAGE");
    const rows = await this.model.findAll({
      where: { userId, userType: "ENTREPRENEUR", ...(savedOnly ? { isSaved: true } : {}), ...(roadmapOnly ? { "hypothesis.startupRoadmap.version": "private-startup-v1" } : {}) },
      order: [["createdAt", "DESC"], ["id", "ASC"]], limit: pageSize + 1, offset: (page - 1) * pageSize,
    });
    return { items: rows.slice(0, pageSize).map(toDto).filter((item): item is PrivateOpportunityIdeaDto => item !== null), page, hasMore: rows.length > pageSize };
  }

  async createStartupRoadmap(userId: string, id: string): Promise<PrivateOpportunityIdeaDto | null> {
    return getSequelize().transaction(async transaction => {
      const row = await this.model.findOne({ where: { id, userId, userType: "ENTREPRENEUR" }, transaction, lock: transaction.LOCK.UPDATE });
      if (!row) return null;
      const item = toDto(row);
      if (!item || !item.saved || !item.hypothesis.analysis?.requirements || item.hypothesis.analysis.opportunity.score === null || item.hypothesis.analysis.fit.score === null) throw new PrivateHypothesisStateError("ANALYSIS_REQUIRED");
      if (item.hypothesis.startupRoadmap) return item;
      const startupRoadmap = generatePrivateStartupRoadmap(item);
      await row.update({ hypothesis: { ...row.hypothesis, startupRoadmap }, updatedAt: new Date() }, { transaction });
      return toDto(row);
    });
  }

  async saveEntrepreneurAnalysis(userId: string, id: string, analysis: EntrepreneurAnalysis): Promise<boolean> {
    const snapshot = entrepreneurAnalysisSchema.parse(analysis);
    const row = await this.model.findOne({ where: { id, userId, userType: "ENTREPRENEUR" } });
    if (!row) return false;
    if (row.isSaved) throw new PrivateHypothesisStateError("SAVED_PERMANENT");
    const [changed] = await this.model.update({ hypothesis: { ...row.hypothesis, analysis: snapshot }, updatedAt: new Date() }, { where: { id, userId, userType: "ENTREPRENEUR", isSaved: false } });
    return changed === 1;
  }

  async setSaved(userId: string, id: string, saved: boolean, now = new Date(), analysisFingerprint?: string): Promise<PrivateOpportunityIdeaDto | null> {
    return getSequelize().transaction(async transaction => {
      const row = await this.model.findOne({ where: { id, userId }, transaction, lock: transaction.LOCK.UPDATE });
      if (!row) return null;
      if (row.userType === "ENTREPRENEUR") {
        if (!saved) throw new PrivateHypothesisStateError("SAVED_PERMANENT");
        if (row.isSaved) return toDto(row);
        const analysis = entrepreneurAnalysisSchema.safeParse(row.hypothesis.analysis);
        if (!analysis.success || !analysis.data.requirements || analysis.data.opportunity.score === null || analysis.data.fit.score === null) throw new PrivateHypothesisStateError("ANALYSIS_REQUIRED");
        if (analysis.data.inputFingerprint !== analysisFingerprint) throw new PrivateHypothesisStateError("ANALYSIS_CHANGED");
      }
      await row.update({ isSaved: saved, savedAt: saved ? (row.savedAt ?? now) : null, updatedAt: now }, { transaction });
      return toDto(row);
    });
  }

  async removeForUser(userId: string, id: string): Promise<void> {
    await getSequelize().transaction(async transaction => {
      const row = await this.model.findOne({ where: { id, userId }, transaction, lock: transaction.LOCK.UPDATE });
      if (!row) return;
      if (row.userType === "ENTREPRENEUR" && row.isSaved) throw new PrivateHypothesisStateError("SAVED_PERMANENT");
      await row.destroy({ transaction });
    });
  }
}
