import { notFound } from "next/navigation";

import { getCurrentUser } from "@/auth/current-user";
import { ONBOARDING_STATUSES, isUserType } from "@/auth/user-types";
import { SavedOpportunitiesList } from "@/components/opportunities/saved-opportunities-list";
import { SavedOpportunityService } from "@/opportunity/saved-service";
import type { SavedOpportunityListResult } from "@/opportunity/saved-dto";

export default async function SavedPage() {
  const user = await getCurrentUser();
  if (
    !user ||
    user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED ||
    !isUserType(user.userType)
  ) {
    notFound();
  }

  let result: SavedOpportunityListResult;
  try {
    result = await new SavedOpportunityService({
      currentUserResolver: async () => user,
    }).listForCurrentUser();
  } catch {
    result = { status: "ERROR" };
  }

  return <SavedOpportunitiesList result={result} />;
}
