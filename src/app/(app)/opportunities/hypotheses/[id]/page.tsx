import { notFound } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/auth/current-user";
import { ONBOARDING_STATUSES } from "@/auth/user-types";
import { PrivateHypothesisScoreDetail } from "@/components/opportunities/private-hypothesis-score-detail";
import { PrivateOpportunityHypothesisRepository } from "@/opportunity/private-hypothesis-repository";
import { isEntrepreneurAnalysisFresh, loadEntrepreneurAnalysisContext } from "@/opportunity/entrepreneur-analysis-service";
import { BusinessHypothesisDetail } from "@/components/opportunities/business-hypothesis-detail";

export const dynamic = "force-dynamic";

export default async function HypothesisScorePage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const user = await getCurrentUser();
  if (user?.userType === "UMKM_EXISTING" && user.onboardingStatus === "COMPLETED") {
    const { isBusinessAnalysisFresh, loadBusinessAnalysisContext } = await import("@/opportunity/business-analysis-service");
    const item = await new PrivateOpportunityHypothesisRepository().findForBusiness(user.id, id);
    if (!item) notFound();
    let fresh = false;
    try { fresh = isBusinessAnalysisFresh(await loadBusinessAnalysisContext({ ...user, userType: "UMKM_EXISTING" }), item); } catch { /* Stored analysis remains readable. */ }
    return <BusinessHypothesisDetail item={item} initialFresh={fresh} />;
  }
  if (!user || user.userType !== "ENTREPRENEUR" || user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED) notFound();
  const item = await new PrivateOpportunityHypothesisRepository().findForEntrepreneur(user.id, id);
  if (!item) notFound();
  if (item.saved) return <PrivateHypothesisScoreDetail item={item} options={{ categories: [], channels: [] }} profile={{ budget: { min: 0, max: 0 }, interestCategoryIds: [], salesChannelIds: [] }} />;
  const context = await loadEntrepreneurAnalysisContext({ ...user, userType: "ENTREPRENEUR" });
  const initialFresh = isEntrepreneurAnalysisFresh(context, item, process.env.AUTH_SECRET);
  return <PrivateHypothesisScoreDetail
    item={item}
    initialFresh={initialFresh}
    options={context.options}
    profile={{ budget: context.profile.budget, interestCategoryIds: context.selections.categoryIds, salesChannelIds: context.selections.channelIds, experienceLevel: context.profile.experienceLevel, timeCommitment: context.profile.timeCommitment }}
  />;
}
