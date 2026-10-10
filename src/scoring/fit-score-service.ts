import "server-only";

import {
  OpportunityFitInputContextAccessContextError,
  OpportunityFitInputContextService,
  type OpportunityFitInputContextService as OpportunityFitInputContextServiceInstance,
} from "../opportunity/fit-input-context-service";
import type { OpportunityFitInputContext } from "../opportunity/fit-input-context";
import {
  calculateFitScoreMvp,
  FIT_SCORE_MVP_HEURISTIC_V1,
  type FitScoreMvpPolicy,
  type FitScoreMvpResult,
} from "./fit-score-mvp";

type OpportunityFitInputContextServicePort = Pick<
  OpportunityFitInputContextServiceInstance,
  "getForOpportunity"
>;

type FitScoreCalculator = (
  context: OpportunityFitInputContext,
  policy: FitScoreMvpPolicy,
) => FitScoreMvpResult;

export type FitScoreServiceDependencies = {
  readonly fitInputContextService?: OpportunityFitInputContextServicePort;
  readonly calculator?: FitScoreCalculator;
};

/**
 * Connects the authenticated, eligibility-checked Fit Input Context to the pure
 * MVP scoring engine. It has no persistence dependency and does not catch or
 * reinterpret authorization, repository, or policy errors.
 */
export class FitScoreService {
  private readonly fitInputContextService: OpportunityFitInputContextServicePort;
  private readonly calculator: FitScoreCalculator;

  constructor(dependencies: FitScoreServiceDependencies = {}) {
    this.fitInputContextService =
      dependencies.fitInputContextService ?? new OpportunityFitInputContextService();
    this.calculator = dependencies.calculator ?? calculateFitScoreMvp;
  }

  async calculateForOpportunity(idInput: unknown): Promise<FitScoreMvpResult | null> {
    const context = await this.fitInputContextService.getForOpportunity(idInput);
    if (context === null) return null;
    if (context.profile === null) {
      throw new OpportunityFitInputContextAccessContextError();
    }

    return this.calculator(context, FIT_SCORE_MVP_HEURISTIC_V1);
  }
}
