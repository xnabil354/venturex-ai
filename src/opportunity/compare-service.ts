import "server-only";

import { getCurrentUser as defaultCurrentUserResolver } from "../auth/current-user";
import { isUserType, ONBOARDING_STATUSES, type SafeUser, type UserType } from "../auth/user-types";
import { OpportunityFitInputContextService } from "./fit-input-context-service";
import { FitScoreService } from "../scoring/fit-score-service";
import type { FitScoreMvpResult } from "../scoring/fit-score-mvp";
import { OpportunityScoreService, type OpportunityScoreServiceResult } from "../scoring/opportunity-score-service";
import { RiskAssessmentService, type RiskAssessmentDisplayState } from "../scoring/risk-assessment-service";
import { OpportunityComparisonRepository } from "./compare-repository";
import {
  opportunityComparisonRequestSchema,
  opportunityComparisonResultSchema,
  type OpportunityComparisonItem,
  type OpportunityComparisonMetric,
  type OpportunityComparisonRepositoryPort,
  type OpportunityComparisonResult,
} from "./compare-domain";

export class OpportunityComparisonUnauthenticatedError extends Error {
  override readonly name = "OpportunityComparisonUnauthenticatedError";
  constructor() { super("Authentication is required to compare Opportunities."); }
}

export class OpportunityComparisonAccessContextError extends Error {
  override readonly name = "OpportunityComparisonAccessContextError";
  constructor() { super("A completed user type is required to compare Opportunities."); }
}

export class OpportunityComparisonInvalidRequestError extends Error {
  override readonly name = "OpportunityComparisonInvalidRequestError";
  constructor() { super("Comparison requires two or three distinct Opportunity IDs."); }
}

export class OpportunityComparisonResourceNotFoundError extends Error {
  override readonly name = "OpportunityComparisonResourceNotFoundError";
  constructor() { super("One or more eligible Opportunities could not be found."); }
}

export type OpportunityComparisonScoringPort = {
  readonly opportunityScores: (ids: readonly string[]) => Promise<Readonly<Record<string, OpportunityScoreServiceResult>>>;
  readonly fitScore: (id: string) => Promise<FitScoreMvpResult | null>;
  readonly risks: (ids: readonly string[]) => Promise<Readonly<Record<string, RiskAssessmentDisplayState>>>;
};

type OpportunityComparisonServiceDependencies = {
  readonly repository?: OpportunityComparisonRepositoryPort;
  readonly currentUserResolver?: () => Promise<SafeUser | null>;
  readonly scoringFactory?: (user: SafeUser & { readonly userType: UserType }) => OpportunityComparisonScoringPort;
};

function defaultScoringFactory(user: SafeUser & { readonly userType: UserType }): OpportunityComparisonScoringPort {
  const currentUserResolver = async () => user;
  const fitInputContextService = new OpportunityFitInputContextService({ currentUserResolver });
  return {
    opportunityScores: (ids) => new OpportunityScoreService({ currentUserResolver }).calculateForOpportunities(ids),
    fitScore: (id) => new FitScoreService({ fitInputContextService }).calculateForOpportunity(id),
    risks: (ids) => new RiskAssessmentService({ currentUserResolver }).assessForOpportunities(ids),
  };
}

function metric<T>(status: OpportunityComparisonMetric<T>["status"], value: T | null, explanation: string): OpportunityComparisonMetric<T> {
  return { status, value, explanation };
}

function scoreMetric(value: OpportunityScoreServiceResult | undefined): OpportunityComparisonItem["opportunityScore"] {
  if (!value) return metric<number>("UNAVAILABLE", null, "Opportunity Score belum dapat dimuat.");
  if (value.status === "AVAILABLE") return metric("AVAILABLE", value.score, "Opportunity Score tersedia dari konfigurasi yang disetujui.");
  return metric<number>("INSUFFICIENT_DATA", null, "Score belum dapat dihitung karena data atau konfigurasi yang disetujui belum lengkap.");
}

function fitMetric(value: FitScoreMvpResult | null | undefined): OpportunityComparisonItem["fitScore"] {
  if (!value) return metric<number>("UNAVAILABLE", null, "Fit Score belum dapat dimuat untuk profil saat ini.");
  if (value.status === "AVAILABLE") return metric("AVAILABLE", value.score, "Fit Score dihitung dari profil dan kebutuhan Opportunity saat ini.");
  return metric<number>("INSUFFICIENT_DATA", null, "Data profil atau kebutuhan Opportunity belum cukup untuk Fit Score.");
}

function riskMetric(value: RiskAssessmentDisplayState | undefined): OpportunityComparisonItem["risk"] {
  if (!value || value.status === "ERROR") return metric<NonNullable<OpportunityComparisonItem["risk"]["value"]>>("UNAVAILABLE", null, "Risk assessment belum dapat dimuat.");
  if (value.status === "INSUFFICIENT_DATA") return metric<NonNullable<OpportunityComparisonItem["risk"]["value"]>>("INSUFFICIENT_DATA", null, "Data atau policy RISK yang disetujui belum cukup untuk menilai risiko.");
  return metric("AVAILABLE", { level: value.level, reasons: [...value.reasons] }, "Risk assessment mengikuti policy yang disetujui.");
}

function storedPercentage(value: string | null): number | null {
  if (value === null) return null;
  const normalized = value.trim();
  if (!/^[+-]?\d+(?:\.\d+)?$/u.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
}

function executionMetric(value: string | null): OpportunityComparisonItem["executionFeasibility"] {
  const parsed = storedPercentage(value);
  return parsed === null
    ? metric<number>("UNAVAILABLE", null, "Nilai Execution Feasibility tersimpan belum tersedia atau tidak valid.")
    : metric("AVAILABLE", parsed, "Nilai Execution Feasibility yang tersimpan pada Opportunity (0–100).");
}

function compareItem(
  source: Awaited<ReturnType<OpportunityComparisonRepositoryPort["findEligibleForUser"]>>[number],
  scores: Readonly<Record<string, OpportunityScoreServiceResult>> | null,
  fit: FitScoreMvpResult | null,
  risks: Readonly<Record<string, RiskAssessmentDisplayState>> | null,
): OpportunityComparisonItem {
  const level = source.competitionLevel?.trim() || null;
  const summary = source.competitionSummary?.trim() || null;
  const hasCompetition = level !== null || summary !== null;
  const trend = source.relatedTrend.title.trim();
  return {
    opportunityId: source.id,
    name: source.name,
    categoryName: source.categoryName,
    opportunityScore: scoreMetric(scores?.[source.id]),
    fitScore: fitMetric(fit),
    relatedTrend: trend
      ? metric("AVAILABLE", { title: trend, direction: source.relatedTrend.direction }, "Trend terpublikasi dan sesuai audiens akun.")
      : metric<NonNullable<OpportunityComparisonItem["relatedTrend"]["value"]>>("UNAVAILABLE", null, "Trend terkait belum tersedia."),
    competition: hasCompetition
      ? metric("AVAILABLE", { level, summary }, "Konteks kompetisi berasal dari data Opportunity tersimpan.")
      : metric<NonNullable<OpportunityComparisonItem["competition"]["value"]>>("UNAVAILABLE", null, "Konteks kompetisi belum dicantumkan."),
    risk: riskMetric(risks?.[source.id]),
    executionFeasibility: executionMetric(source.executionFeasibility),
  };
}

export class OpportunityComparisonService {
  private readonly repository: OpportunityComparisonRepositoryPort;
  private readonly currentUserResolver: () => Promise<SafeUser | null>;
  private readonly scoringFactory: (user: SafeUser & { readonly userType: UserType }) => OpportunityComparisonScoringPort;

  constructor(dependencies: OpportunityComparisonServiceDependencies = {}) {
    this.repository = dependencies.repository ?? new OpportunityComparisonRepository();
    this.currentUserResolver = dependencies.currentUserResolver ?? defaultCurrentUserResolver;
    this.scoringFactory = dependencies.scoringFactory ?? defaultScoringFactory;
  }

  async compare(requestInput: unknown): Promise<OpportunityComparisonResult> {
    const user = await this.currentUserResolver();
    if (!user) throw new OpportunityComparisonUnauthenticatedError();
    if (user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED || !isUserType(user.userType)) {
      throw new OpportunityComparisonAccessContextError();
    }
    const parsed = opportunityComparisonRequestSchema.safeParse(requestInput);
    if (!parsed.success) throw new OpportunityComparisonInvalidRequestError();

    const ids = parsed.data.opportunityIds;
    const userType = user.userType;
    const sources = await this.repository.findEligibleForUser(userType, ids);
    const requestedIds = new Set<string>(ids);
    if (sources.length !== ids.length
      || new Set(sources.map(({ id }) => id)).size !== sources.length
      || sources.some(({ id, relatedTrend }) => !requestedIds.has(id)
        || relatedTrend.lifecycleState !== "PUBLISHED"
        || !relatedTrend.affectedUserTypes.includes(userType))) {
      throw new OpportunityComparisonResourceNotFoundError();
    }

    const scoring = this.scoringFactory(user as SafeUser & { readonly userType: UserType });
    const [scores, risks, fits] = await Promise.all([
      scoring.opportunityScores(ids).catch(() => null),
      scoring.risks(ids).catch(() => null),
      Promise.all(ids.map((id) => scoring.fitScore(id).catch(() => null))),
    ]);
    const sourcesById = new Map(sources.map((source) => [source.id, source]));
    const result = {
      items: ids.map((id, index) => {
        const source = sourcesById.get(id);
        if (!source) throw new OpportunityComparisonResourceNotFoundError();
        return compareItem(source, scores, fits[index] ?? null, risks);
      }),
    };
    return opportunityComparisonResultSchema.parse(result);
  }
}
