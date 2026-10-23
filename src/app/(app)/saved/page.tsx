import { notFound } from "next/navigation";

import { getCurrentUser } from "@/auth/current-user";
import { ONBOARDING_STATUSES, isUserType } from "@/auth/user-types";
import { PrivateOpportunityFinder } from "@/components/opportunities/private-opportunity-finder";
import { PrivateOpportunityHypothesisRepository } from "@/opportunity/private-hypothesis-repository";
import { parsePrivateListPage } from "@/opportunity/private-list-page";

export const dynamic = "force-dynamic";

export default async function SavedPage({ searchParams = Promise.resolve({}) }: { searchParams?: Promise<{ page?: string | readonly string[] }> }) {
  const page = parsePrivateListPage((await searchParams).page);
  let hasMore = false;
  const user = await getCurrentUser();
  if (!user || user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED || !isUserType(user.userType)) {
    notFound();
  }

  let items = [] as Awaited<ReturnType<PrivateOpportunityHypothesisRepository["listForUser"]>>;
  let initialLoadFailed = false;
  try {
    const repository = new PrivateOpportunityHypothesisRepository();
    if (user.userType === "ENTREPRENEUR") {
      const result = await repository.listPageForUser(user.id, page, true);
      items = result.items; hasMore = result.hasMore;
    } else { const result = await repository.listBusinessPage(user.id, page, true); items = result.items; hasMore = result.hasMore; }
  } catch {
    initialLoadFailed = true;
  }

  return <PrivateOpportunityFinder comparisonOwnerId={user.id} key={`saved-${page}`} pagination={{ page, hasMore }} initialItems={items} initialLoadFailed={initialLoadFailed} showScoreDetails businessMode={user.userType === "UMKM_EXISTING"} view="saved" />;
}
