import "server-only";

import { getCurrentUser as defaultCurrentUserResolver } from "../auth/current-user";
import { isUserType, ONBOARDING_STATUSES, type SafeUser, type UserId, type UserType } from "../auth/user-types";
import { opportunityIdSchema } from "../opportunity/domain";
import type { FitScoreMvpResult } from "../scoring/fit-score-mvp";
import type { AnalysisRiskLevel, AnalysisScoreStatus } from "../scoring/persistence-types";
import type { OpportunityAnalysisContext } from "./context";
import { OpportunityAnalysisContextBuilder, serializeGenerationContext } from "./context";
import {
  AIAnalysisAccessContextError,
  AIAnalysisContextChangedError,
  AIAnalysisInsufficientDataError,
  AIAnalysisProfileIncompleteError,
  AIAnalysisProviderFailureError,
  AIAnalysisProviderUnavailableError,
  AIAnalysisRateLimitedError,
  AIAnalysisResourceNotFoundError,
  AIAnalysisResponseInvalidError,
  AIAnalysisUnauthenticatedError,
  opportunityAnalysisSchema,
  storedOpportunityAnalysisSchema,
  type OpportunityAnalysis,
  type OpportunityAnalysisDto,
  type StoredOpportunityAnalysis,
} from "./domain";
import { OpenAICompatibleOpportunityAnalysisProvider, type OpportunityAnalysisProvider } from "./provider";
import { OpportunityAnalysisRepository, type OpportunityAnalysisCreateValues, type OpportunityAnalysisRecord, type OpportunityAnalysisRepositoryPort } from "./repository";

const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_RATE_LIMIT_ENTRIES = 10_000;

export interface OpportunityAnalysisContextBuilderPort {
  build(user: SafeUser & { readonly userType: UserType }, opportunityId: string): Promise<OpportunityAnalysisContext | null>;
}

export interface OpportunityAnalysisRateLimiter {
  acquire(userId: UserId, now: number): number | null;
}

export class InMemoryOpportunityAnalysisRateLimiter implements OpportunityAnalysisRateLimiter {
  private readonly nextAllowedAt = new Map<UserId, number>();

  acquire(userId: UserId, now: number): number | null {
    for (const [id, expiry] of this.nextAllowedAt) {
      if (expiry <= now) this.nextAllowedAt.delete(id);
    }
    const nextAllowedAt = this.nextAllowedAt.get(userId);
    if (nextAllowedAt && nextAllowedAt > now) {
      return Math.ceil((nextAllowedAt - now) / 1000);
    }
    if (this.nextAllowedAt.size >= MAX_RATE_LIMIT_ENTRIES) {
      const earliest = Math.min(...this.nextAllowedAt.values());
      return Math.max(1, Math.ceil((earliest - now) / 1000));
    }
    this.nextAllowedAt.set(userId, now + RATE_LIMIT_WINDOW_MS);
    return null;
  }
}

type ServiceDependencies = {
  readonly repository?: OpportunityAnalysisRepositoryPort;
  readonly contextBuilder?: OpportunityAnalysisContextBuilderPort;
  readonly currentUserResolver?: () => Promise<SafeUser | null>;
  readonly providerFactory?: () => OpportunityAnalysisProvider;
  readonly rateLimiter?: OpportunityAnalysisRateLimiter;
  readonly now?: () => number;
};

const defaultRateLimiter = new InMemoryOpportunityAnalysisRateLimiter();

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function dtoFromRecord(
  record: OpportunityAnalysisRecord | null,
  context: OpportunityAnalysisContext,
): OpportunityAnalysisDto | null {
  if (!record || !record.aiAnalysis) return null;
  const stored = storedOpportunityAnalysisSchema.safeParse(record.aiAnalysis);
  if (!stored.success || !isCurrent(stored.data, context)) return null;
  if (!record.aiProvider || !record.aiModel) return null;
  return {
    analysisId: record.id,
    ...stored.data.analysis,
    generatedAt: record.generatedAt.toISOString(),
    provider: record.aiProvider,
    model: record.aiModel,
    limitedEvidence: stored.data.limitedEvidence,
  };
}

function isCurrent(stored: StoredOpportunityAnalysis, context: OpportunityAnalysisContext): boolean {
  return stored.contextFingerprint === context.contextFingerprint
    && stored.profileVersion === context.profileVersion
    && stored.userType === context.userType;
}

function collectTextAndNumbers(value: unknown, key = ""): string[] {
  if (typeof value === "string") return key === "id" || key === "sourceUrl" || key === "contextFingerprint" ? [] : [value];
  if (typeof value === "number" && Number.isFinite(value)) return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item) => collectTextAndNumbers(item));
  const record = asRecord(value);
  if (!record) return [];
  return Object.entries(record).flatMap(([childKey, child]) => collectTextAndNumbers(child, childKey));
}

function assertOutputIsGrounded(analysis: OpportunityAnalysis, context: OpportunityAnalysisContext): void {
  const text = [analysis.summary, analysis.whyRelevant, analysis.targetConsumer, analysis.competition, analysis.potential, analysis.nextAction, ...analysis.risks].join(" ");
  if (/\b(dijamin|pasti berhasil|pasti sukses|keuntungan pasti|akan untung|tanpa risiko|dipastikan berhasil)\b/iu.test(text)) {
    throw new AIAnalysisResponseInvalidError();
  }

  const knownNumbers = new Set(collectTextAndNumbers(context).flatMap((item) =>
    item.match(/\d+(?:[.,]\d+)*/gu)?.map((number) => number.replace(/[.,]/gu, "")) ?? [],
  ));
  const outputNumbers = text.match(/\d+(?:[.,]\d+)*/gu) ?? [];
  if (outputNumbers.some((number) => !knownNumbers.has(number.replace(/[.,]/gu, "")))) {
    throw new AIAnalysisResponseInvalidError();
  }
}

function persistenceValues(
  context: OpportunityAnalysisContext,
  userId: UserId,
  analysis: OpportunityAnalysis,
  provider: string,
  model: string,
  generatedAt: Date,
): OpportunityAnalysisCreateValues {
  const score = asRecord(context.opportunityScore);
  const fit = asRecord(context.fitScore);
  const risk = asRecord(context.riskAssessment);
  const stored: StoredOpportunityAnalysis = {
    schemaVersion: 1,
    contextFingerprint: context.contextFingerprint,
    profileVersion: context.profileVersion,
    userType: context.userType,
    limitedEvidence: context.evidence.limited,
    generationContext: serializeGenerationContext(context),
    analysis,
  };
  const scoreStatus: AnalysisScoreStatus = score?.status === "AVAILABLE"
    ? "AVAILABLE"
    : score?.status === "INSUFFICIENT_DATA" ? "INSUFFICIENT_DATA" : "ERROR";
  const opportunityScore = scoreStatus === "AVAILABLE" && typeof score?.score === "number" ? score.score.toFixed(2) : null;
  const fitScore = fit?.status === "AVAILABLE" && typeof fit.score === "number" ? fit.score.toFixed(2) : null;
  const riskLevel = risk?.status === "ASSESSED" && (risk.level === "LOW" || risk.level === "MEDIUM" || risk.level === "HIGH")
    ? risk.level as AnalysisRiskLevel
    : null;
  const riskReasons = riskLevel && risk && Array.isArray(risk.reasons)
    ? risk.reasons.filter((item): item is string => typeof item === "string").slice(0, 10)
    : [];

  return {
    userId,
    opportunityId: context.opportunity.id,
    datasetVersionId: null,
    scoringModelId: null,
    profileVersion: context.profileVersion,
    opportunityScore,
    fitScore,
    scoreStatus,
    riskLevel: riskReasons.length > 0 ? riskLevel : null,
    confidenceLevel: null,
    opportunityScoreBreakdown: { ...score },
    fitScoreBreakdown: { ...fit },
    riskReasons: riskReasons.length > 0 ? riskReasons : [],
    aiAnalysis: stored,
    aiProvider: provider,
    aiModel: model,
    generatedAt,
    createdAt: generatedAt,
  };
}

export class AIAnalysisService {
  private readonly repository: OpportunityAnalysisRepositoryPort;
  private readonly contextBuilder: OpportunityAnalysisContextBuilderPort;
  private readonly currentUserResolver: () => Promise<SafeUser | null>;
  private readonly providerFactory: () => OpportunityAnalysisProvider;
  private readonly rateLimiter: OpportunityAnalysisRateLimiter;
  private readonly now: () => number;

  constructor(dependencies: ServiceDependencies = {}) {
    this.repository = dependencies.repository ?? new OpportunityAnalysisRepository();
    this.contextBuilder = dependencies.contextBuilder ?? new OpportunityAnalysisContextBuilder();
    this.currentUserResolver = dependencies.currentUserResolver ?? defaultCurrentUserResolver;
    this.providerFactory = dependencies.providerFactory ?? (() => new OpenAICompatibleOpportunityAnalysisProvider());
    this.rateLimiter = dependencies.rateLimiter ?? defaultRateLimiter;
    this.now = dependencies.now ?? Date.now;
  }

  async getLatest(idInput: unknown): Promise<OpportunityAnalysisDto | null> {
    const user = await this.requireUser();
    const opportunityId = opportunityIdSchema.safeParse(idInput);
    if (!opportunityId.success) throw new AIAnalysisResourceNotFoundError();
    let context: OpportunityAnalysisContext | null;
    try {
      context = await this.contextBuilder.build(user, opportunityId.data);
    } catch (error) {
      if (error instanceof AIAnalysisProfileIncompleteError || error instanceof AIAnalysisInsufficientDataError) return null;
      throw error;
    }
    if (!context) throw new AIAnalysisResourceNotFoundError();
    return dtoFromRecord(await this.repository.findLatest(user.id, opportunityId.data, context.contextFingerprint), context);
  }

  async generate(idInput: unknown, options: { readonly forceRefresh?: boolean } = {}): Promise<OpportunityAnalysisDto> {
    const user = await this.requireUser();
    const opportunityId = opportunityIdSchema.safeParse(idInput);
    if (!opportunityId.success) throw new AIAnalysisResourceNotFoundError();
    const context = await this.contextBuilder.build(user, opportunityId.data);
    if (!context) throw new AIAnalysisResourceNotFoundError();

    if (!options.forceRefresh) {
      const cached = dtoFromRecord(await this.repository.findLatest(user.id, opportunityId.data, context.contextFingerprint), context);
      if (cached) return cached;
    }

    let provider: OpportunityAnalysisProvider;
    try {
      provider = this.providerFactory();
    } catch (error) {
      if (error instanceof AIAnalysisProviderUnavailableError) throw error;
      throw new AIAnalysisProviderUnavailableError();
    }

    const retryAfter = this.rateLimiter.acquire(user.id, this.now());
    if (retryAfter !== null) throw new AIAnalysisRateLimitedError(retryAfter);

    let generated: OpportunityAnalysis;
    try {
      const raw: unknown = await provider.generate(context);
      const parsed = opportunityAnalysisSchema.safeParse(raw);
      if (!parsed.success) throw new AIAnalysisResponseInvalidError();
      assertOutputIsGrounded(parsed.data, context);
      generated = parsed.data;
    } catch (error) {
      if (error instanceof AIAnalysisResponseInvalidError) throw error;
      if (error instanceof AIAnalysisProviderFailureError) throw error;
      throw new AIAnalysisProviderFailureError();
    }

    const currentContext = await this.contextBuilder.build(user, opportunityId.data);
    if (!currentContext || currentContext.contextFingerprint !== context.contextFingerprint) {
      throw new AIAnalysisContextChangedError();
    }

    const generatedAt = new Date(this.now());
    const saved = await this.repository.create(persistenceValues(context, user.id, generated, provider.provider, provider.model, generatedAt));
    const result = dtoFromRecord(saved, context);
    if (!result) throw new AIAnalysisResponseInvalidError();
    return result;
  }

  private async requireUser(): Promise<SafeUser & { readonly userType: UserType }> {
    const user = await this.currentUserResolver();
    if (!user) throw new AIAnalysisUnauthenticatedError();
    if (user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED || !isUserType(user.userType)) {
      throw new AIAnalysisAccessContextError();
    }
    return user as SafeUser & { readonly userType: UserType };
  }
}
