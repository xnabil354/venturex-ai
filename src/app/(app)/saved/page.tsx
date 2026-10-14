import { notFound } from "next/navigation";

import { getCurrentUser } from "@/auth/current-user";
import { ONBOARDING_STATUSES, isUserType } from "@/auth/user-types";
import { PrivateOpportunityFinder } from "@/components/opportunities/private-opportunity-finder";
import { PrivateOpportunityHypothesisRepository } from "@/opportunity/private-hypothesis-repository";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const user = await getCurrentUser();
  if (!user || user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED || !isUserType(user.userType)) {
    notFound();
  }

  let items = [] as Awaited<ReturnType<PrivateOpportunityHypothesisRepository["listForUser"]>>;
  let initialLoadFailed = false;
  try {
    items = await new PrivateOpportunityHypothesisRepository().listForUser(user.id, true);
  } catch {
    initialLoadFailed = true;
  }

  return <PrivateOpportunityFinder initialItems={items} initialLoadFailed={initialLoadFailed} view="saved" />;
}
