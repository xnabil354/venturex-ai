import "server-only";

import { getCurrentUser as defaultCurrentUserResolver } from "../auth/current-user";
import {
  ONBOARDING_STATUSES,
  isUserType,
  type SafeUser,
} from "../auth/user-types";
import { OpportunityAccessContextError, OpportunityUnauthenticatedError } from "./service";
import { opportunityIdSchema } from "./domain";
import { projectOpportunityEvidence, type OpportunityEvidenceState } from "./evidence-dto";
import { OpportunityEvidenceRepository, type OpportunityEvidenceRepositoryPort } from "./evidence-repository";

export type OpportunityEvidenceServiceDependencies = {
  readonly repository?: OpportunityEvidenceRepositoryPort;
  readonly currentUserResolver?: () => Promise<SafeUser | null>;
};

export class OpportunityEvidenceService {
  private readonly repository: OpportunityEvidenceRepositoryPort;
  private readonly currentUserResolver: () => Promise<SafeUser | null>;

  constructor(dependencies: OpportunityEvidenceServiceDependencies = {}) {
    this.repository = dependencies.repository ?? new OpportunityEvidenceRepository();
    this.currentUserResolver = dependencies.currentUserResolver ?? defaultCurrentUserResolver;
  }

  async listForOpportunity(idInput: unknown): Promise<OpportunityEvidenceState | null> {
    const user = await this.currentUserResolver();
    if (!user) throw new OpportunityUnauthenticatedError();
    if (
      user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED ||
      !isUserType(user.userType)
    ) {
      throw new OpportunityAccessContextError();
    }

    const parsedId = opportunityIdSchema.safeParse(idInput);
    if (!parsedId.success) return null;

    const records = await this.repository.findForVisibleOpportunity(user.userType, parsedId.data);
    if (!records) return null;
    return projectOpportunityEvidence(records);
  }
}
