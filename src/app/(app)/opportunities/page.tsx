import { notFound } from "next/navigation";

import { getCurrentUser } from "@/auth/current-user";
import { ONBOARDING_STATUSES, isUserType } from "@/auth/user-types";
import { OpportunityFinder } from "@/components/opportunities/opportunity-finder";
import { OpportunityService, type OpportunityFinderResult } from "@/opportunity/service";
import { OpportunityScoreService, type OpportunityScoreDisplayState } from "@/scoring/opportunity-score-service";
import { RiskAssessmentService, type RiskAssessmentDisplayState } from "@/scoring/risk-assessment-service";

type OpportunitiesPageProps = {
  readonly searchParams: Promise<{
    readonly page?: string | readonly string[];
    readonly category?: string | readonly string[];
  }>;
};

export default async function OpportunitiesPage({ searchParams }: OpportunitiesPageProps) {
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  if (
    !user ||
    user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED ||
    !isUserType(user.userType)
  ) {
    notFound();
  }

  const page = typeof query.page === "string" ? query.page : 1;
  let result: OpportunityFinderResult;
  try {
    result = await new OpportunityService({
      currentUserResolver: async () => user,
    }).list(page, query.category);
  } catch {
    result = { status: "ERROR" };
  }

  let scoreByOpportunityId: Readonly<Record<string, OpportunityScoreDisplayState>> = {};
  let riskByOpportunityId: Readonly<Record<string, RiskAssessmentDisplayState>> = {};
  if (result.status === "AVAILABLE") {
    const ids = result.items.map(({ id }) => id);
    const loadScores = async (): Promise<Readonly<Record<string, OpportunityScoreDisplayState>>> => {
      try {
        return await new OpportunityScoreService({
          currentUserResolver: async () => user,
        }).calculateForOpportunities(ids);
      } catch {
        return Object.fromEntries(ids.map((id) => [id, { status: "ERROR" as const }]));
      }
    };
    const loadRisks = async (): Promise<Readonly<Record<string, RiskAssessmentDisplayState>>> => {
      try {
        return await new RiskAssessmentService({
          currentUserResolver: async () => user,
        }).assessForOpportunities(ids);
      } catch {
        return Object.fromEntries(ids.map((id) => [id, { status: "ERROR" as const }]));
      }
    };
    [scoreByOpportunityId, riskByOpportunityId] = await Promise.all([loadScores(), loadRisks()]);
  }

  return <OpportunityFinder result={result} riskByOpportunityId={riskByOpportunityId} scoreByOpportunityId={scoreByOpportunityId} />;
}
