import "server-only";

import { createHash } from "node:crypto";
import { Op } from "sequelize";

import type { SafeUser, UserType } from "../auth/user-types";
import { getTrendEvidenceModel, getTrendModel, type Trend, type TrendEvidence } from "../db/models/trend.model";
import { getCustomerSegmentModel, type CustomerSegment } from "../reference/customer-segment.model";
import { getFnbCategoryModel, type FnbCategory } from "../reference/fnb-category.model";
import { getSalesChannelModel, type SalesChannel } from "../reference/sales-channel.model";
import type { OpportunityEvidenceState } from "../opportunity/evidence-dto";
import { OpportunityEvidenceService } from "../opportunity/evidence-service";
import { OpportunityFitInputContextService } from "../opportunity/fit-input-context-service";
import type { OpportunityFitInputContext } from "../opportunity/fit-input-context";
import { OpportunityService } from "../opportunity/service";
import { FitScoreService } from "../scoring/fit-score-service";
import type { FitScoreMvpResult } from "../scoring/fit-score-mvp";
import { OpportunityScoreService } from "../scoring/opportunity-score-service";
import type { OpportunityScoreServiceResult } from "../scoring/opportunity-score-service";
import { RiskAssessmentService } from "../scoring/risk-assessment-service";
import type { RiskAssessmentDisplayState } from "../scoring/risk-assessment-service";
import { AIAnalysisInsufficientDataError, AIAnalysisProfileIncompleteError } from "./domain";

const MAX_TEXT = 1600;
const MAX_EVIDENCE = 8;

function boundedText(value: string | null | undefined, maximum = MAX_TEXT): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maximum) : null;
}

function stableFingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function asDate(value: Date | null): string | null {
  return value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : null;
}

export type TrendSource = {
  readonly title: string;
  readonly signalSummary: string;
  readonly signalDescription: string;
  readonly businessRelevanceExplanation: string | null;
  readonly direction: string | null;
  readonly periodStart: string | null;
  readonly periodEnd: string | null;
  readonly evidence: readonly {
    readonly sourceName: string;
    readonly sourceReference: string;
    readonly supportingDetail: string;
    readonly sourceDate: string | null;
    readonly limitations: string | null;
  }[];
};

export interface TrendContextRepositoryPort {
  findPublishedForUser(trendId: string, userType: UserType): Promise<TrendSource | null>;
}

export class TrendContextRepository implements TrendContextRepositoryPort {
  private readonly trendModel: typeof Trend;
  private readonly evidenceModel: typeof TrendEvidence;

  constructor(
    trendModel: typeof Trend = getTrendModel(),
    evidenceModel: typeof TrendEvidence = getTrendEvidenceModel(),
  ) {
    this.trendModel = trendModel;
    this.evidenceModel = evidenceModel;
  }

  async findPublishedForUser(trendId: string, userType: UserType): Promise<TrendSource | null> {
    const trend = await this.trendModel.findOne({
      where: {
        id: trendId,
        lifecycleState: "PUBLISHED",
        affectedUserTypes: { [Op.contains]: [userType] },
      },
      attributes: ["id", "title", "signalSummary", "signalDescription", "businessRelevanceExplanation", "direction", "periodStart", "periodEnd"],
    });
    if (!trend) return null;
    const evidence = await this.evidenceModel.findAll({
      where: { trendId },
      attributes: ["sourceName", "sourceReference", "supportingDetail", "sourceDate", "limitations"],
      order: [["id", "ASC"]],
      limit: MAX_EVIDENCE,
    });

    return {
      title: trend.title,
      signalSummary: trend.signalSummary,
      signalDescription: trend.signalDescription,
      businessRelevanceExplanation: trend.businessRelevanceExplanation,
      direction: trend.direction,
      periodStart: trend.periodStart,
      periodEnd: trend.periodEnd,
      evidence: evidence.map((item) => ({
        sourceName: item.sourceName,
        sourceReference: item.sourceReference,
        supportingDetail: item.supportingDetail,
        sourceDate: asDate(item.sourceDate),
        limitations: item.limitations,
      })),
    };
  }
}

export type AnalysisReferenceNames = {
  readonly categories: ReadonlyMap<string, string>;
  readonly customerSegments: ReadonlyMap<string, string>;
  readonly salesChannels: ReadonlyMap<string, string>;
};

export interface AnalysisReferenceRepositoryPort {
  resolve(ids: {
    readonly categoryIds: readonly string[];
    readonly customerSegmentIds: readonly string[];
    readonly salesChannelIds: readonly string[];
  }): Promise<AnalysisReferenceNames>;
}

export class AnalysisReferenceRepository implements AnalysisReferenceRepositoryPort {
  private readonly categoryModel: typeof FnbCategory;
  private readonly customerSegmentModel: typeof CustomerSegment;
  private readonly salesChannelModel: typeof SalesChannel;

  constructor(
    categoryModel: typeof FnbCategory = getFnbCategoryModel(),
    customerSegmentModel: typeof CustomerSegment = getCustomerSegmentModel(),
    salesChannelModel: typeof SalesChannel = getSalesChannelModel(),
  ) {
    this.categoryModel = categoryModel;
    this.customerSegmentModel = customerSegmentModel;
    this.salesChannelModel = salesChannelModel;
  }

  async resolve(ids: {
    readonly categoryIds: readonly string[];
    readonly customerSegmentIds: readonly string[];
    readonly salesChannelIds: readonly string[];
  }): Promise<AnalysisReferenceNames> {
    const [categories, segments, channels] = await Promise.all([
      ids.categoryIds.length ? this.categoryModel.findAll({ where: { id: { [Op.in]: [...new Set(ids.categoryIds)] } }, attributes: ["id", "name"] }) : [],
      ids.customerSegmentIds.length ? this.customerSegmentModel.findAll({ where: { id: { [Op.in]: [...new Set(ids.customerSegmentIds)] } }, attributes: ["id", "name"] }) : [],
      ids.salesChannelIds.length ? this.salesChannelModel.findAll({ where: { id: { [Op.in]: [...new Set(ids.salesChannelIds)] } }, attributes: ["id", "name"] }) : [],
    ]);
    return {
      categories: new Map(categories.map((item) => [item.id, item.name])),
      customerSegments: new Map(segments.map((item) => [item.id, item.name])),
      salesChannels: new Map(channels.map((item) => [item.id, item.name])),
    };
  }
}

export type AnalysisProfileContext =
  | {
      readonly type: "ENTREPRENEUR";
      readonly profileVersion: number;
      readonly location: string;
      readonly budgetIdr: { readonly minimum: number; readonly maximum: number };
      readonly experienceLevel: string;
      readonly timeCommitment: string;
      readonly preferredProductType: string | null;
      readonly interests: readonly string[];
      readonly targetCustomers: readonly string[];
      readonly salesChannels: readonly string[];
    }
  | {
      readonly type: "UMKM_EXISTING";
      readonly profileVersion: number;
      readonly location: string;
      readonly businessCategory: string | null;
      readonly businessDescription: string | null;
      readonly averagePriceIdr: { readonly minimum: number; readonly maximum: number };
      readonly products: readonly { readonly category: string | null; readonly priceIdr: number | null }[];
      readonly targetCustomers: readonly string[];
      readonly salesChannels: readonly string[];
    };

export type OpportunityAnalysisContext = {
  readonly userType: UserType;
  readonly profileVersion: number;
  readonly profile: AnalysisProfileContext;
  readonly opportunity: {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly category: string;
    readonly type: string;
    readonly targetConsumer: string | null;
    readonly competitionLevel: string | null;
    readonly competitionSummary: string | null;
    readonly requirements: Readonly<Record<string, string | null>>;
  };
  readonly trend: TrendSource;
  readonly opportunityScore: Readonly<Record<string, unknown>>;
  readonly fitScore: Readonly<Record<string, unknown>>;
  readonly riskAssessment: Readonly<Record<string, unknown>>;
  readonly evidence: {
    readonly status: "AVAILABLE" | "EMPTY" | "UNAVAILABLE";
    readonly limited: boolean;
    readonly opportunity: readonly Readonly<Record<string, unknown>>[];
    readonly trend: TrendSource["evidence"];
  };
  readonly contextFingerprint: string;
};

type AnalysisContextBuilderDependencies = {
  readonly fitContextService?: Pick<OpportunityFitInputContextService, "getForOpportunity">;
  readonly opportunityService?: Pick<OpportunityService, "getDetail">;
  readonly evidenceService?: Pick<OpportunityEvidenceService, "listForOpportunity">;
  readonly opportunityScoreService?: Pick<OpportunityScoreService, "calculateForOpportunity">;
  readonly riskAssessmentService?: Pick<RiskAssessmentService, "assessForOpportunity">;
  readonly trendRepository?: TrendContextRepositoryPort;
  readonly referenceRepository?: AnalysisReferenceRepositoryPort;
  readonly fitScoreCalculator?: (context: OpportunityFitInputContext) => FitScoreMvpResult;
};

function location(city: string | null, province: string | null, fallback: string): string {
  return [city, province].filter((item): item is string => Boolean(item?.trim())).join(", ") || boundedText(fallback, 240) || "Tidak dicantumkan";
}

function labels(ids: readonly string[], map: ReadonlyMap<string, string>): string[] {
  return ids.map((id) => map.get(id)).filter((value): value is string => Boolean(value)).sort((left, right) => left.localeCompare(right, "id"));
}

function buildProfile(
  context: OpportunityFitInputContext,
  references: AnalysisReferenceNames,
): AnalysisProfileContext {
  if (context.profile === null) throw new AIAnalysisProfileIncompleteError();
  if (context.userType === "ENTREPRENEUR") {
    const profile = context.profile;
    return {
      type: context.userType,
      profileVersion: profile.profileVersion,
      location: location(profile.city, profile.province, profile.locationText),
      budgetIdr: { minimum: profile.budgetMin, maximum: profile.budgetMax },
      experienceLevel: profile.experienceLevel,
      timeCommitment: profile.timeCommitment,
      preferredProductType: boundedText(profile.preferredProductType, 180),
      interests: labels(profile.interestCategoryIds, references.categories),
      targetCustomers: labels(profile.customerSegmentIds, references.customerSegments),
      salesChannels: labels(profile.salesChannelIds, references.salesChannels),
    };
  }

  const profile = context.profile;
  return {
    type: context.userType,
    profileVersion: profile.profileVersion,
    location: location(profile.city, profile.province, profile.locationText),
    businessCategory: references.categories.get(profile.businessCategoryId) ?? null,
    businessDescription: boundedText(profile.businessDescription, 900),
    averagePriceIdr: { minimum: profile.averagePriceMin, maximum: profile.averagePriceMax },
    products: profile.products.slice(0, 12).map((product) => ({
      category: product.fnbCategoryId ? references.categories.get(product.fnbCategoryId) ?? null : null,
      priceIdr: product.price,
    })),
    targetCustomers: labels(profile.customerSegmentIds, references.customerSegments),
    salesChannels: labels(profile.salesChannelIds, references.salesChannels),
  };
}

function opportunityScoreSnapshot(value: OpportunityScoreServiceResult | null | "ERROR") {
  if (value === "ERROR" || value === null) return { status: "UNAVAILABLE", score: null, explanation: "Opportunity Score tidak tersedia saat ini." };
  if (value.status === "AVAILABLE") return { status: value.status, score: value.score, modelVersion: value.modelVersion };
  return { status: value.status, score: null, reason: value.reason, missingComponents: value.missingComponents };
}

function fitScoreSnapshot(value: FitScoreMvpResult | "ERROR" | null) {
  if (value === "ERROR" || value === null) return { status: "UNAVAILABLE", score: null, explanation: "Fit Score tidak tersedia saat ini." };
  if (value.status === "AVAILABLE") return { status: value.status, score: value.score, policyVersion: value.policyVersion };
  return { status: value.status, score: null, reason: value.reason, missingComponents: value.missingComponents };
}

function riskSnapshot(value: RiskAssessmentDisplayState) {
  if (value.status === "ERROR") return { status: "UNAVAILABLE", level: null, reasons: [] as string[], explanation: "Risk assessment tidak tersedia saat ini." };
  if (value.status === "ASSESSED") return { status: value.status, level: value.level, reasons: [...value.reasons], modelVersion: value.modelVersion };
  return { status: value.status, level: null, reasons: [], reason: value.reason, missingFactors: [...value.missingFactors] };
}

function evidenceSnapshot(value: OpportunityEvidenceState | null) {
  if (value === null || value.status === "ERROR") {
    return { status: "UNAVAILABLE" as const, limited: true, opportunity: [] as Readonly<Record<string, unknown>>[] };
  }
  if (value.status === "EMPTY") return { status: value.status, limited: true, opportunity: [] as Readonly<Record<string, unknown>>[] };
  return {
    status: value.status,
    limited: value.limited,
    opportunity: value.items.slice(0, MAX_EVIDENCE).map((source) => ({
      sourceName: boundedText(source.sourceName, 180),
      sourceType: boundedText(source.sourceType, 100),
      sourceDate: boundedText(source.sourceDateLabel, 120),
      sourceReference: boundedText(source.sourceReference, 400),
      sourceUrl: boundedText(source.sourceUrl, 400),
      limitations: source.limitations.slice(0, 8).map((item) => boundedText(item, 350)).filter(Boolean),
    })),
  };
}

export class OpportunityAnalysisContextBuilder {
  private readonly dependencies: AnalysisContextBuilderDependencies;

  constructor(dependencies: AnalysisContextBuilderDependencies = {}) {
    this.dependencies = dependencies;
  }

  async build(user: SafeUser & { readonly userType: UserType }, opportunityId: string): Promise<OpportunityAnalysisContext | null> {
    const resolver = async () => user;
    const fitContextService = this.dependencies.fitContextService ?? new OpportunityFitInputContextService({ currentUserResolver: resolver });
    const opportunityService = this.dependencies.opportunityService ?? new OpportunityService({ currentUserResolver: resolver });
    const evidenceService = this.dependencies.evidenceService ?? new OpportunityEvidenceService({ currentUserResolver: resolver });
    const scoreService = this.dependencies.opportunityScoreService ?? new OpportunityScoreService({ currentUserResolver: resolver });
    const riskService = this.dependencies.riskAssessmentService ?? new RiskAssessmentService({ currentUserResolver: resolver });
    const trendRepository = this.dependencies.trendRepository ?? new TrendContextRepository();
    const referenceRepository = this.dependencies.referenceRepository ?? new AnalysisReferenceRepository();

    const inputContext = await fitContextService.getForOpportunity(opportunityId);
    if (!inputContext) return null;
    if (inputContext.userType !== user.userType) return null;
    if (inputContext.profile === null) throw new AIAnalysisProfileIncompleteError();

    const detail = await opportunityService.getDetail(opportunityId);
    if (!detail || detail.id !== inputContext.opportunity.id || detail.relatedTrend.id !== inputContext.opportunity.relatedTrend.id) return null;
    const trend = await trendRepository.findPublishedForUser(inputContext.opportunity.relatedTrend.id, user.userType);
    if (!trend) return null;

    const categoryIds = inputContext.userType === "ENTREPRENEUR"
      ? inputContext.profile.interestCategoryIds
      : [inputContext.profile.businessCategoryId, ...inputContext.profile.products.map((product) => product.fnbCategoryId)].filter((value): value is string => Boolean(value));
    const references = await referenceRepository.resolve({
      categoryIds,
      customerSegmentIds: inputContext.profile.customerSegmentIds,
      salesChannelIds: inputContext.profile.salesChannelIds,
    });
    const profile = buildProfile(inputContext, references);

    const [evidence, scoreResult, fitResult, riskResult] = await Promise.all([
      evidenceService.listForOpportunity(opportunityId).catch(() => null),
      scoreService.calculateForOpportunity(opportunityId).catch(() => "ERROR" as const),
      Promise.resolve().then(() => this.dependencies.fitScoreCalculator
        ? this.dependencies.fitScoreCalculator(inputContext)
        : new FitScoreService({ fitInputContextService: { getForOpportunity: async () => inputContext } }).calculateForOpportunity(opportunityId)).catch(() => "ERROR" as const),
      riskService.assessForOpportunity(opportunityId).catch(() => ({ status: "ERROR" as const })),
    ]);
    if (scoreResult === null || riskResult === null) return null;

    const score = opportunityScoreSnapshot(scoreResult);
    const fit = fitScoreSnapshot(fitResult);
    const risk = riskSnapshot(riskResult);
    const evidenceData = evidenceSnapshot(evidence);
    const trendContext: TrendSource = {
      title: boundedText(trend.title, 220) ?? "",
      signalSummary: boundedText(trend.signalSummary, 500) ?? "",
      signalDescription: boundedText(trend.signalDescription, 1500) ?? "",
      businessRelevanceExplanation: boundedText(trend.businessRelevanceExplanation, 800),
      direction: trend.direction,
      periodStart: trend.periodStart,
      periodEnd: trend.periodEnd,
      evidence: trend.evidence.slice(0, MAX_EVIDENCE).map((source) => ({
        sourceName: boundedText(source.sourceName, 180) ?? "",
        sourceReference: boundedText(source.sourceReference, 400) ?? "",
        supportingDetail: boundedText(source.supportingDetail, 800) ?? "",
        sourceDate: source.sourceDate,
        limitations: boundedText(source.limitations, 350),
      })),
    };
    const contextWithoutFingerprint = {
      userType: user.userType,
      profileVersion: profile.profileVersion,
      profile,
      opportunity: {
        id: detail.id,
        name: boundedText(detail.name, 300) ?? "",
        description: boundedText(detail.description, 1600) ?? "",
        category: boundedText(detail.categoryName, 160) ?? "",
        type: boundedText(detail.opportunityType, 80) ?? "",
        targetConsumer: boundedText(detail.targetConsumerSummary, 700),
        competitionLevel: boundedText(detail.competitionLevel, 100),
        competitionSummary: boundedText(detail.competitionSummary, 700),
        requirements: {
          capitalMinIdr: inputContext.opportunity.requirements?.capitalMin ?? null,
          capitalMaxIdr: inputContext.opportunity.requirements?.capitalMax ?? null,
          expectedPriceMinIdr: inputContext.opportunity.requirements?.expectedPriceMin ?? null,
          expectedPriceMaxIdr: inputContext.opportunity.requirements?.expectedPriceMax ?? null,
          requiredExperienceLevel: inputContext.opportunity.requirements?.requiredExperienceLevel ?? null,
          requiredTimeCommitment: inputContext.opportunity.requirements?.requiredTimeCommitment ?? null,
          operationalComplexity: inputContext.opportunity.requirements?.operationalComplexity ?? null,
          locationScope: inputContext.opportunity.requirements?.locationScope ?? null,
        },
      },
      trend: trendContext,
      opportunityScore: score,
      fitScore: fit,
      riskAssessment: risk,
      evidence: {
        status: evidenceData.status,
        limited: evidenceData.limited || trend.evidence.length === 0 || trend.evidence.some((source) => Boolean(source.limitations?.trim())),
        opportunity: evidenceData.opportunity,
        trend: trendContext.evidence,
      },
    };

    if (!contextWithoutFingerprint.opportunity.name || !contextWithoutFingerprint.opportunity.description) {
      throw new AIAnalysisInsufficientDataError();
    }
    return { ...contextWithoutFingerprint, contextFingerprint: stableFingerprint(contextWithoutFingerprint) };
  }
}

export function serializeGenerationContext(context: OpportunityAnalysisContext): Record<string, unknown> {
  const { contextFingerprint: _fingerprint, ...snapshot } = context;
  return snapshot;
}
