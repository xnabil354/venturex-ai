import { notFound } from "next/navigation";

import { getCurrentUser } from "@/auth/current-user";
import { ONBOARDING_STATUSES, isUserType } from "@/auth/user-types";
import { OpportunityDetail } from "@/components/opportunities/opportunity-detail";
import { OpportunityEvidenceService } from "@/opportunity/evidence-service";
import type { OpportunityEvidenceState } from "@/opportunity/evidence-dto";
import { OpportunityService } from "@/opportunity/service";
import { SavedOpportunityService } from "@/opportunity/saved-service";
import type { OpportunitySaveState } from "@/opportunity/saved-dto";

export default async function OpportunityDetailPage({
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

  const item = await new OpportunityService({
    currentUserResolver: async () => user,
  }).getDetail(id);
  if (!item) notFound();

  let evidence: OpportunityEvidenceState | null;
  try {
    evidence = await new OpportunityEvidenceService({
      currentUserResolver: async () => user,
    }).listForOpportunity(id);
  } catch {
    evidence = { status: "ERROR" };
  }
  if (!evidence) notFound();

  let saveState: OpportunitySaveState | null;
  try {
    saveState = await new SavedOpportunityService({
      currentUserResolver: async () => user,
    }).getSaveState(id);
  } catch {
    saveState = { status: "ERROR" };
  }
  if (!saveState) notFound();

  return <OpportunityDetail evidence={evidence} item={item} saveState={saveState} />;
}
