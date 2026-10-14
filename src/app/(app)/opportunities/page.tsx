import { notFound } from "next/navigation";

import { getCurrentUser } from "@/auth/current-user";
import { ONBOARDING_STATUSES, isUserType } from "@/auth/user-types";
import { PrivateOpportunityFinder } from "@/components/opportunities/private-opportunity-finder";
import { getLiveTrendSignalsService } from "@/trend/live-signals";
import { PrivateOpportunityHypothesisRepository } from "@/opportunity/private-hypothesis-repository";
import { isPublicHttpTransport, readLocalProfileNineRouterConfig } from "@/ai-analysis/ninerouter";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const user = await getCurrentUser();
  if (!user || user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED || !isUserType(user.userType)) {
    notFound();
  }

  const snapshot = getLiveTrendSignalsService().latestForUser(user.id);
  let initialItems = [] as Awaited<ReturnType<PrivateOpportunityHypothesisRepository["listForUser"]>>;
  let initialLoadFailed = false;
  try {
    initialItems = await new PrivateOpportunityHypothesisRepository().listForUser(user.id);
  } catch {
    initialLoadFailed = true;
  }

  const providerConfig = readLocalProfileNineRouterConfig();
  const providerAvailable = process.env.AI_ANALYSIS_TRENDS_USER_INFERENCE_ENABLED === "true"
    && process.env.NINEROUTER_BRIGHTDATA_PROCESSING_CONFIRMED === "true"
    && providerConfig !== null;

  const sourceOptions = snapshot
    ? snapshot.signals.map((signal) => ({ snapshotId: snapshot.snapshotId, signal }))
    : [];

  return (
    <PrivateOpportunityFinder
      initialItems={initialItems}
      initialLoadFailed={initialLoadFailed}
      providerAvailable={providerAvailable}
      publicHttpTransport={isPublicHttpTransport(providerConfig?.baseURL)}
      sourceOptions={sourceOptions}
    />
  );
}
