import { Op, type Transaction } from "sequelize";

import type { UserId, UserType } from "../auth/user-types";
import { initializeProfileAssociations } from "../profile/associations";
import { getBusinessProductModel, type BusinessProduct } from "../profile/business-product.model";
import { getBusinessProfileModel, type BusinessProfile } from "../profile/business-profile.model";
import { getEntrepreneurProfileModel, type EntrepreneurProfile } from "../profile/entrepreneur-profile.model";
import { getFnbCategoryModel, type FnbCategory } from "../reference/fnb-category.model";
import { getCustomerSegmentModel, type CustomerSegment } from "../reference/customer-segment.model";
import { getSalesChannelModel, type SalesChannel } from "../reference/sales-channel.model";
import { getOpportunityModel, type Opportunity } from "../db/models/opportunity.model";
import { getOpportunityEvidenceModel, type OpportunityEvidence } from "../db/models/evidence.model";
import { getRoadmapModel, type Roadmap } from "../db/models/roadmap.model";
import { getRoadmapStepModel, type RoadmapStep } from "../db/models/roadmap-step.model";
import { getTrendModel, type Trend } from "../db/models/trend.model";
import { getUserOpportunityAnalysisModel, type UserOpportunityAnalysis } from "../db/models/user-opportunity-analysis.model";
import { initializeRoadmapAssociations } from "./associations";
import type {
  GrowthRoadmapGenerationContext,
  RoadmapAnalysisContext,
  RoadmapDetail,
  RoadmapGenerationContext,
  GrowthRoadmapProfileContext,
  RoadmapOpportunityContext,
  RoadmapPage,
  RoadmapProfileContext,
  RoadmapStepRecord,
  StartupRoadmapGenerationContext,
} from "./domain";

export type RoadmapListFilter = {
  readonly page: number;
  readonly pageSize: number;
  readonly type?: "STARTUP" | "GROWTH";
  readonly opportunityId?: string;
  readonly sort?: "createdAt";
  readonly order?: "ASC" | "DESC";
};

export type RoadmapCreateValues = {
  readonly userId: UserId;
  readonly roadmapType: "STARTUP" | "GROWTH";
  readonly opportunityId: string;
  readonly analysisId: string | null;
  readonly generationContext: RoadmapGenerationContext;
  readonly steps: readonly Omit<RoadmapStepRecord, "id">[];
};

export interface RoadmapRepositoryPort {
  loadProfileContext(userId: UserId, transaction: Transaction): Promise<RoadmapProfileContext | null>;
  loadGrowthProfileContext(userId: UserId, transaction: Transaction): Promise<GrowthRoadmapProfileContext | null>;
  loadOpportunityContext(opportunityId: string, userType: UserType, transaction: Transaction): Promise<RoadmapOpportunityContext | null>;
  findAnalysis(userId: UserId, userType: UserType, opportunityId: string, analysisId: string | undefined, transaction: Transaction): Promise<RoadmapAnalysisContext | null>;
  createWithSteps(values: RoadmapCreateValues, transaction: Transaction): Promise<RoadmapDetail>;
  listForUser(userId: UserId, userType: UserType, filter: RoadmapListFilter): Promise<RoadmapPage>;
  findForUser(userId: UserId, userType: UserType, roadmapId: string): Promise<RoadmapDetail | null>;
}

function roadmapTypeForUser(userType: UserType): "STARTUP" | "GROWTH" {
  return userType === "ENTREPRENEUR" ? "STARTUP" : "GROWTH";
}

export type RoadmapRepositoryModels = {
  readonly profileModel: typeof EntrepreneurProfile;
  readonly businessProfileModel?: typeof BusinessProfile;
  readonly businessProductModel?: typeof BusinessProduct;
  readonly opportunityModel: typeof Opportunity;
  readonly trendModel: typeof Trend;
  readonly categoryModel: typeof FnbCategory;
  readonly customerSegmentModel?: typeof CustomerSegment;
  readonly salesChannelModel?: typeof SalesChannel;
  readonly evidenceModel: typeof OpportunityEvidence;
  readonly analysisModel: typeof UserOpportunityAnalysis;
  readonly roadmapModel: typeof Roadmap;
  readonly stepModel: typeof RoadmapStep;
};

type ProfileWithSelections = EntrepreneurProfile & {
  readonly interests?: readonly FnbCategory[];
  readonly customerSegments?: readonly CustomerSegment[];
  readonly salesChannels?: readonly SalesChannel[];
};

type BusinessProductWithCategory = BusinessProduct & { readonly category?: FnbCategory | null };
type BusinessProfileWithSelections = BusinessProfile & {
  readonly products?: readonly BusinessProductWithCategory[];
  readonly customerSegments?: readonly CustomerSegment[];
  readonly salesChannels?: readonly SalesChannel[];
};

function toProfileContext(profile: ProfileWithSelections): RoadmapProfileContext {
  return {
    profileVersion: profile.profileVersion,
    locationText: profile.locationText,
    countryCode: profile.countryCode,
    budgetMin: Number(profile.budgetMin),
    budgetMax: Number(profile.budgetMax),
    experienceLevel: profile.experienceLevel,
    timeCommitment: profile.timeCommitment,
    preferredProductType: profile.preferredProductType,
    businessObjective: profile.businessObjective,
    interests: (profile.interests ?? []).map((item) => item.name),
    customerSegments: (profile.customerSegments ?? []).map((item) => item.name),
    salesChannels: (profile.salesChannels ?? []).map((item) => item.name),
  };
}

function toOpportunityContext(opportunity: Opportunity): RoadmapOpportunityContext {
  const category = opportunity.category;
  const trend = opportunity.relatedTrend;
  if (!category || !trend) throw new Error("Roadmap opportunity associations are missing.");
  return {
    id: opportunity.id,
    name: opportunity.name,
    description: opportunity.description,
    categoryName: category.name,
    opportunityType: opportunity.opportunityType,
    targetConsumerSummary: opportunity.targetConsumerSummary,
    competitionLevel: opportunity.competitionLevel,
    competitionSummary: opportunity.competitionSummary,
    trend: {
      id: trend.id,
      title: trend.title,
      signalSummary: trend.signalSummary,
      signalDescription: trend.signalDescription,
      lifecycleState: trend.lifecycleState,
      affectedUserTypes: [...trend.affectedUserTypes],
    },
    evidence: (opportunity.evidences ?? []).slice(0, 10).map((evidence) => ({
      id: evidence.id,
      sourceName: evidence.sourceName.trim().slice(0, 180),
      sourceReference: traceableReference(evidence.sourceReference, evidence.sourceUrl),
      sourceUrl: evidence.sourceUrl,
    })),
  };
}

function traceableReference(reference: string | null, sourceUrl: string | null): string | null {
  const value = reference?.trim() || sourceUrl?.trim() || "";
  if (!value) return null;
  if (/^https?:/iu.test(value)) {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password) return null;
      return url.toString().slice(0, 500);
    } catch {
      return null;
    }
  }
  return value.slice(0, 500);
}

function toAnalysisContext(analysis: UserOpportunityAnalysis): RoadmapAnalysisContext {
  return {
    id: analysis.id,
    scoreStatus: analysis.scoreStatus,
    opportunityScore: analysis.opportunityScore,
    fitScore: analysis.fitScore,
    riskLevel: analysis.riskLevel,
    riskReasons: [...analysis.riskReasons],
  };
}

function toStepRecord(step: RoadmapStep): RoadmapStepRecord {
  return {
    id: step.id,
    sequence: step.sequence,
    stage: step.stage as RoadmapStepRecord["stage"],
    action: step.action,
    objective: step.objective,
    timeline: step.timeline,
    expectedOutput: step.expectedOutput,
  };
}

type RoadmapWithRelations = Pick<Roadmap, "id" | "roadmapType" | "createdAt" | "generationContext"> & {
  readonly opportunity?: Opportunity;
  readonly steps?: readonly RoadmapStep[];
};

function toListItem(roadmap: RoadmapWithRelations) {
  if (!roadmap.opportunity) throw new Error("Roadmap opportunity association is missing.");
  return {
    id: roadmap.id,
    roadmapType: roadmap.roadmapType,
    createdAt: roadmap.createdAt.toISOString(),
    opportunity: { id: roadmap.opportunity.id, name: roadmap.opportunity.name },
  } as const;
}

function toDetail(roadmap: RoadmapWithRelations): RoadmapDetail {
  const listItem = toListItem(roadmap);
  const steps = [...(roadmap.steps ?? [])]
    .sort((left, right) => left.sequence - right.sequence)
    .map(toStepRecord);
  if (roadmap.roadmapType === "GROWTH") {
    return { ...listItem, roadmapType: "GROWTH", generationContext: roadmap.generationContext as GrowthRoadmapGenerationContext, steps };
  }
  return { ...listItem, roadmapType: "STARTUP", generationContext: roadmap.generationContext as StartupRoadmapGenerationContext, steps };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export class RoadmapRepository implements RoadmapRepositoryPort {
  private readonly profileModel: typeof EntrepreneurProfile;
  private readonly businessProfileModel: typeof BusinessProfile;
  private readonly businessProductModel: typeof BusinessProduct;
  private readonly opportunityModel: typeof Opportunity;
  private readonly trendModel: typeof Trend;
  private readonly categoryModel: typeof FnbCategory;
  private readonly customerSegmentModel: typeof CustomerSegment | undefined;
  private readonly salesChannelModel: typeof SalesChannel | undefined;
  private readonly evidenceModel: typeof OpportunityEvidence;
  private readonly analysisModel: typeof UserOpportunityAnalysis;
  private readonly roadmapModel: typeof Roadmap;
  private readonly stepModel: typeof RoadmapStep;

  constructor(models?: RoadmapRepositoryModels) {
    this.profileModel = models?.profileModel ?? getEntrepreneurProfileModel();
    this.businessProfileModel = models?.businessProfileModel ?? getBusinessProfileModel();
    this.businessProductModel = models?.businessProductModel ?? getBusinessProductModel();
    this.opportunityModel = models?.opportunityModel ?? getOpportunityModel();
    this.trendModel = models?.trendModel ?? getTrendModel();
    this.categoryModel = models?.categoryModel ?? getFnbCategoryModel();
    this.customerSegmentModel = models?.customerSegmentModel ?? (models ? undefined : getCustomerSegmentModel());
    this.salesChannelModel = models?.salesChannelModel ?? (models ? undefined : getSalesChannelModel());
    this.evidenceModel = models?.evidenceModel ?? getOpportunityEvidenceModel();
    this.analysisModel = models?.analysisModel ?? getUserOpportunityAnalysisModel();
    this.roadmapModel = models?.roadmapModel ?? getRoadmapModel();
    this.stepModel = models?.stepModel ?? getRoadmapStepModel();
    if (!models) {
      initializeProfileAssociations();
      initializeRoadmapAssociations();
    }
  }

  async loadProfileContext(userId: UserId, transaction: Transaction): Promise<RoadmapProfileContext | null> {
    const profile = await this.profileModel.findOne({
      where: { userId },
      include: [
        { model: getFnbCategoryModel(), as: "interests", attributes: ["id", "name"], through: { attributes: [] }, required: false },
        { model: getCustomerSegmentModel(), as: "customerSegments", attributes: ["id", "name"], through: { attributes: [] }, required: false },
        { model: getSalesChannelModel(), as: "salesChannels", attributes: ["id", "name"], through: { attributes: [] }, required: false },
      ],
      transaction,
    });
    return profile ? toProfileContext(profile as ProfileWithSelections) : null;
  }

  async loadGrowthProfileContext(userId: UserId, transaction: Transaction): Promise<GrowthRoadmapProfileContext | null> {
    if (!this.customerSegmentModel || !this.salesChannelModel) {
      throw new Error("Growth profile reference models are not initialized.");
    }
    const profile = await this.businessProfileModel.findOne({
      where: { userId },
      include: [
        {
          model: this.businessProductModel,
          as: "products",
          where: { isActive: true },
          required: false,
          separate: true,
          order: [["name", "ASC"], ["id", "ASC"]],
          include: [{ model: this.categoryModel, as: "category", attributes: ["name"], required: false }],
        },
        { model: this.customerSegmentModel, as: "customerSegments", attributes: ["id", "name"], through: { attributes: [] }, required: false },
        { model: this.salesChannelModel, as: "salesChannels", attributes: ["id", "name"], through: { attributes: [] }, required: false },
      ],
      transaction,
    });
    if (!profile) return null;
    const category = await this.categoryModel.findByPk(profile.businessCategoryId, {
      attributes: ["name"],
      transaction,
    });
    if (!category) return null;

    const selected = profile as BusinessProfileWithSelections;
    return {
      profileVersion: profile.profileVersion,
      businessName: profile.businessName,
      businessCategory: category.name,
      locationText: profile.locationText,
      countryCode: profile.countryCode,
      averagePriceMin: Number(profile.averagePriceMin),
      averagePriceMax: Number(profile.averagePriceMax),
      businessDescription: profile.businessDescription,
      products: (selected.products ?? []).map((product) => ({
        name: product.name,
        category: product.category?.name ?? null,
        price: product.price === null ? null : Number(product.price),
      })),
      customerSegments: (selected.customerSegments ?? []).map((item) => item.name).sort(compareText),
      salesChannels: (selected.salesChannels ?? []).map((item) => item.name).sort(compareText),
    };
  }

  async loadOpportunityContext(opportunityId: string, userType: UserType, transaction: Transaction): Promise<RoadmapOpportunityContext | null> {
    const opportunity = await this.opportunityModel.findOne({
      where: { id: opportunityId },
      include: [
        { model: this.trendModel, as: "relatedTrend", attributes: ["id", "title", "signalSummary", "signalDescription", "lifecycleState", "affectedUserTypes"], where: { lifecycleState: "PUBLISHED", affectedUserTypes: { [Op.contains]: [userType] } }, required: true },
        { model: this.categoryModel, as: "category", attributes: ["name"], required: true },
        { model: this.evidenceModel, as: "evidences", attributes: ["id", "sourceName", "sourceReference", "sourceUrl"], separate: true, limit: 10, order: [["id", "ASC"]], required: false },
      ],
      transaction,
    });
    return opportunity ? toOpportunityContext(opportunity) : null;
  }

  async findAnalysis(userId: UserId, userType: UserType, opportunityId: string, analysisId: string | undefined, transaction: Transaction): Promise<RoadmapAnalysisContext | null> {
    const analysis = await this.analysisModel.findOne({
      where: { userId, userType, opportunityId, ...(analysisId ? { id: analysisId } : {}) },
      order: [["generatedAt", "DESC"], ["id", "ASC"]],
      transaction,
    });
    return analysis ? toAnalysisContext(analysis) : null;
  }

  async createWithSteps(values: RoadmapCreateValues, transaction: Transaction): Promise<RoadmapDetail> {
    const roadmap = await this.roadmapModel.create({
      userId: values.userId,
      opportunityId: values.opportunityId,
      userOpportunityAnalysisId: values.analysisId,
      roadmapType: values.roadmapType,
      generationContext: values.generationContext,
    }, { transaction });
    const createdAt = new Date();
    const steps = await this.stepModel.bulkCreate(values.steps.map((step) => ({
      roadmapId: roadmap.id,
      createdAt,
      ...step,
    })), { transaction, returning: true });
    const loaded = await this.roadmapModel.findOne({
      where: { id: roadmap.id, userId: values.userId },
      include: [
        { model: this.opportunityModel, as: "opportunity", attributes: ["id", "name"], required: true },
      ],
      transaction,
    });
    if (!loaded) throw new Error("Roadmap could not be reloaded after creation.");
    if (!loaded.opportunity) throw new Error("Roadmap opportunity association is missing after creation.");
    return toDetail({
      id: loaded.id,
      roadmapType: loaded.roadmapType,
      createdAt: loaded.createdAt,
      generationContext: loaded.generationContext,
      opportunity: loaded.opportunity,
      steps,
    });
  }

  async listForUser(userId: UserId, userType: UserType, filter: RoadmapListFilter): Promise<RoadmapPage> {
    const where = {
      userId,
      roadmapType: roadmapTypeForUser(userType),
      ...(filter.opportunityId ? { opportunityId: filter.opportunityId } : {}),
    };
    const { rows, count } = await this.roadmapModel.findAndCountAll({
      where,
      include: [{ model: this.opportunityModel, as: "opportunity", attributes: ["id", "name"], required: true }],
      order: [[filter.sort ?? "createdAt", filter.order ?? "DESC"], ["id", "ASC"]],
      limit: filter.pageSize,
      offset: (filter.page - 1) * filter.pageSize,
      distinct: true,
    });
    return {
      items: rows.map((roadmap) => toListItem(roadmap as RoadmapWithRelations)),
      page: filter.page,
      pageSize: filter.pageSize,
      totalCount: count,
      totalPages: Math.max(1, Math.ceil(count / filter.pageSize)),
    };
  }

  async findForUser(userId: UserId, userType: UserType, roadmapId: string): Promise<RoadmapDetail | null> {
    const roadmap = await this.roadmapModel.findOne({
      where: { id: roadmapId, userId, roadmapType: roadmapTypeForUser(userType) },
      include: [
        { model: this.opportunityModel, as: "opportunity", attributes: ["id", "name"], required: true },
        { model: this.stepModel, as: "steps", separate: true, order: [["sequence", "ASC"]] },
      ],
    });
    return roadmap ? toDetail(roadmap as RoadmapWithRelations) : null;
  }
}
