import { Op, type Sequelize } from "sequelize";

import {
  Trend,
  TrendEvidence,
  getTrendEvidenceModel,
  getTrendModel,
} from "../db/models/trend.model";
import { getSequelize } from "../db/sequelize";
import { getFnbCategoryModel } from "../reference/fnb-category.model";
import {
  TREND_LIFECYCLE_STATES,
  TrendNotFoundError,
  TrendSubjectAreaNotFoundError,
  trendIdSchema,
  type CreateDraftTrendInput,
  type TrendEvidenceRecord,
  type TrendId,
  type TrendLifecycleState,
  type TrendRecord,
} from "./domain";

export interface TrendRepositoryPort {
  createDraft(input: CreateDraftTrendInput): Promise<TrendRecord>;
  findById(id: TrendId): Promise<TrendRecord | null>;
  transition(
    id: TrendId,
    currentState: TrendLifecycleState,
    nextState: TrendLifecycleState,
    archivedReason: string | null,
  ): Promise<TrendRecord | null>;
  listPublished(): Promise<readonly TrendRecord[]>;
}

function toEvidenceRecord(evidence: TrendEvidence): TrendEvidenceRecord {
  return {
    id: evidence.id,
    sourceName: evidence.sourceName,
    sourceReference: evidence.sourceReference,
    supportingDetail: evidence.supportingDetail,
    sourceDate: evidence.sourceDate,
    limitations: evidence.limitations,
  };
}

export class TrendRepository implements TrendRepositoryPort {
  private readonly trendModel: typeof Trend;
  private readonly evidenceModel: typeof TrendEvidence;
  private readonly categoryModel: ReturnType<typeof getFnbCategoryModel>;
  private readonly sequelize: Sequelize;

  constructor(
    sequelize: Sequelize = getSequelize(),
    trendModel: typeof Trend = getTrendModel(),
    evidenceModel: typeof TrendEvidence = getTrendEvidenceModel(),
    categoryModel: ReturnType<typeof getFnbCategoryModel> = getFnbCategoryModel(),
  ) {
    this.sequelize = sequelize;
    this.trendModel = trendModel;
    this.evidenceModel = evidenceModel;
    this.categoryModel = categoryModel;
  }

  async createDraft(input: CreateDraftTrendInput): Promise<TrendRecord> {
    const trend = await this.sequelize.transaction(async (transaction) => {
      const createdTrend = await this.trendModel.create({
        title: input.title,
        categoryCode: input.categoryCode,
        subjectAreaId: input.subjectAreaId,
        signalSummary: input.signal.summary,
        signalDescription: input.signal.description,
        direction: input.signal.direction,
        periodStart: input.signal.periodStart,
        periodEnd: input.signal.periodEnd,
        businessRelevanceExplanation: input.businessRelevanceExplanation,
        affectedUserTypes: [...input.affectedUserTypes],
        lifecycleState: TREND_LIFECYCLE_STATES[0],
        archivedReason: null,
      }, { transaction });

      if (input.evidence.length > 0) {
        await this.evidenceModel.bulkCreate(input.evidence.map((item) => ({
          trendId: createdTrend.id,
          sourceName: item.sourceName,
          sourceReference: item.sourceReference,
          supportingDetail: item.supportingDetail,
          sourceDate: item.sourceDate === null ? null : new Date(item.sourceDate),
          limitations: item.limitations,
        })), { transaction });
      }
      return createdTrend;
    });

    const record = (await this.toRecords([trend]))[0];
    if (!record) throw new TrendNotFoundError(trendIdSchema.parse(trend.id));
    return record;
  }

  async findById(id: TrendId): Promise<TrendRecord | null> {
    const trend = await this.trendModel.findByPk(id);
    if (!trend) return null;
    return (await this.toRecords([trend]))[0] ?? null;
  }

  async transition(
    id: TrendId,
    currentState: TrendLifecycleState,
    nextState: TrendLifecycleState,
    archivedReason: string | null,
  ): Promise<TrendRecord | null> {
    const [, updatedTrends] = await this.trendModel.update(
      { lifecycleState: nextState, archivedReason },
      { returning: true, where: { id, lifecycleState: currentState } },
    );
    const updatedTrend = updatedTrends[0];
    if (!updatedTrend) return null;
    return (await this.toRecords([updatedTrend]))[0] ?? null;
  }

  async listPublished(): Promise<readonly TrendRecord[]> {
    const trends = await this.trendModel.findAll({
      where: { lifecycleState: "PUBLISHED" },
      order: [["createdAt", "DESC"], ["id", "ASC"]],
    });
    return this.toRecords(trends);
  }

  private async toRecords(trends: readonly Trend[]): Promise<TrendRecord[]> {
    if (trends.length === 0) return [];
    const trendIds = trends.map(({ id }) => id);
    const subjectAreaIds = [...new Set(trends.flatMap((trend) =>
      trend.subjectAreaId === null ? [] : [trend.subjectAreaId],
    ))];
    const [evidenceRows, categories] = await Promise.all([
      this.evidenceModel.findAll({
        where: { trendId: { [Op.in]: trendIds } },
        order: [["sourceName", "ASC"], ["id", "ASC"]],
      }),
      subjectAreaIds.length > 0
        ? this.categoryModel.findAll({
            attributes: ["id", "code", "name"],
            where: { id: { [Op.in]: subjectAreaIds } },
          })
        : Promise.resolve([]),
    ]);

    const evidenceByTrendId = new Map<string, TrendEvidenceRecord[]>();
    for (const evidence of evidenceRows) {
      const items = evidenceByTrendId.get(evidence.trendId) ?? [];
      items.push(toEvidenceRecord(evidence));
      evidenceByTrendId.set(evidence.trendId, items);
    }
    const categoryById = new Map(categories.map((category) => [category.id, category]));

    return trends.map((trend) => {
      const subjectArea = trend.subjectAreaId ? categoryById.get(trend.subjectAreaId) : null;
      if (trend.subjectAreaId && !subjectArea) {
        throw new TrendSubjectAreaNotFoundError(trend.subjectAreaId);
      }
      return {
        id: trendIdSchema.parse(trend.id),
        title: trend.title,
        categoryCode: trend.categoryCode,
        subjectArea: subjectArea ? { code: subjectArea.code, name: subjectArea.name } : null,
        signal: {
          summary: trend.signalSummary,
          description: trend.signalDescription,
          direction: trend.direction,
          periodStart: trend.periodStart,
          periodEnd: trend.periodEnd,
        },
        evidence: evidenceByTrendId.get(trend.id) ?? [],
        businessRelevanceExplanation: trend.businessRelevanceExplanation,
        affectedUserTypes: [...trend.affectedUserTypes],
        lifecycleState: trend.lifecycleState,
        archivedReason: trend.archivedReason,
        createdAt: trend.createdAt,
        updatedAt: trend.updatedAt,
      };
    });
  }
}
