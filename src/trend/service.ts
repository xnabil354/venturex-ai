import "server-only";

import { z } from "zod";

import { getCurrentUser } from "../auth/current-user";
import {
  ONBOARDING_STATUSES,
  isUserType,
  type SafeUser,
} from "../auth/user-types";
import { toTrendDto, type TrendDto } from "./dto";
import {
  assertTrendTransition,
  createDraftTrendSchema,
  InvalidTrendTransitionError,
  TrendNotFoundError,
  TrendRequirementNotMetError,
  trendIdSchema,
  TREND_LIFECYCLE_STATES,
  type TrendId,
  type TrendLifecycleState,
  type TrendRecord,
} from "./domain";
import { TrendRepository, type TrendRepositoryPort } from "./repository";

const archiveReasonSchema = z.string().trim().min(1).max(1000);

export class TrendService {
  constructor(
    private readonly repository: TrendRepositoryPort = new TrendRepository(),
    private readonly currentUserResolver: () => Promise<SafeUser | null> = getCurrentUser,
  ) {}

  async createDraftTrend(input: unknown): Promise<TrendDto> {
    const draft = createDraftTrendSchema.parse(input);
    return toTrendDto(await this.repository.createDraft(draft));
  }

  async validateTrend(id: unknown): Promise<TrendDto> {
    const trend = await this.requireTrend(id);
    const nextState = TREND_LIFECYCLE_STATES[1];
    assertTrendTransition(trend.lifecycleState, nextState);
    this.ensureReviewRequirements(trend);
    return this.transition(trend, nextState, null);
  }

  async publishTrend(id: unknown): Promise<TrendDto> {
    const trend = await this.requireTrend(id);
    const nextState = TREND_LIFECYCLE_STATES[2];
    assertTrendTransition(trend.lifecycleState, nextState);
    this.ensureReviewRequirements(trend);
    return this.transition(trend, nextState, null);
  }

  async archiveTrend(id: unknown, reason: unknown): Promise<TrendDto> {
    const trend = await this.requireTrend(id);
    const nextState = TREND_LIFECYCLE_STATES[3];
    assertTrendTransition(trend.lifecycleState, nextState);
    return this.transition(trend, nextState, archiveReasonSchema.parse(reason));
  }

  async getPublishedTrends(): Promise<readonly TrendDto[]> {
    const user = await this.currentUserResolver();
    const userType = user?.userType;
    if (!userType) return [];
    const trends = await this.repository.listPublished();
    return trends
      .filter((trend) => trend.affectedUserTypes.includes(userType))
      .map(toTrendDto);
  }

  async getPublishedTrend(id: unknown): Promise<TrendDto | null> {
    const parsedId = trendIdSchema.safeParse(id);
    if (!parsedId.success) return null;

    const user = await this.currentUserResolver();
    if (
      !user ||
      user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED ||
      !isUserType(user.userType)
    ) {
      return null;
    }

    const trend = await this.repository.findById(parsedId.data);
    if (
      !trend ||
      trend.lifecycleState !== "PUBLISHED" ||
      !trend.affectedUserTypes.includes(user.userType)
    ) {
      return null;
    }

    return toTrendDto(trend);
  }

  private async requireTrend(id: unknown): Promise<TrendRecord> {
    const trendId: TrendId = trendIdSchema.parse(id);
    const trend = await this.repository.findById(trendId);
    if (!trend) throw new TrendNotFoundError(trendId);
    return trend;
  }

  private ensureReviewRequirements(trend: TrendRecord): void {
    if (trend.evidence.length === 0) throw new TrendRequirementNotMetError("evidence");
    if (!trend.businessRelevanceExplanation?.trim()) {
      throw new TrendRequirementNotMetError("business relevance explanation");
    }
    if (trend.affectedUserTypes.length === 0) {
      throw new TrendRequirementNotMetError("affected user type");
    }
  }

  private async transition(
    trend: TrendRecord,
    nextState: TrendLifecycleState,
    archivedReason: string | null,
  ): Promise<TrendDto> {
    const updatedTrend = await this.repository.transition(
      trend.id,
      trend.lifecycleState,
      nextState,
      archivedReason,
    );
    if (!updatedTrend) {
      throw new InvalidTrendTransitionError(trend.lifecycleState, nextState);
    }
    return toTrendDto(updatedTrend);
  }
}
