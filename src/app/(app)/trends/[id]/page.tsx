import { notFound } from "next/navigation";

import { getCurrentUser } from "@/auth/current-user";
import { ONBOARDING_STATUSES, isUserType } from "@/auth/user-types";
import { TrendDetail } from "@/components/trends/trend-detail";
import type { TrendDetailRelatedOpportunities } from "@/components/trends/trend-detail";
import { OpportunityService } from "@/opportunity/service";
import { projectTrendList } from "@/trend/list-projection";
import { TrendService } from "@/trend/service";

export default async function TrendDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const [user, { id }] = await Promise.all([getCurrentUser(), params]);
  if (
    !user ||
    user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED ||
    !isUserType(user.userType)
  ) {
    notFound();
  }

  const trend = await new TrendService(undefined, async () => user).getPublishedTrend(id);
  if (!trend) notFound();

  const [item] = projectTrendList([trend], user.userType);
  if (!item) notFound();

  let relatedOpportunities: TrendDetailRelatedOpportunities;
  try {
    relatedOpportunities = await new OpportunityService({
      currentUserResolver: async () => user,
    }).listForTrend(trend.id);
  } catch {
    relatedOpportunities = { status: "ERROR", items: [] };
  }

  return <TrendDetail item={item} relatedOpportunities={relatedOpportunities} />;
}
