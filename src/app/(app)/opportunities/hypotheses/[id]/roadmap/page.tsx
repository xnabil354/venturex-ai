import { notFound } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/auth/current-user";
import { PrivateStartupView } from "@/components/roadmaps/private-startup-view";
import { PrivateOpportunityHypothesisRepository } from "@/opportunity/private-hypothesis-repository";
import { PrivateGrowthView } from "@/components/roadmaps/private-growth-view";

export const dynamic = "force-dynamic";
export default async function PrivateStartupPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || (user.userType !== "ENTREPRENEUR" && user.userType !== "UMKM_EXISTING") || user.onboardingStatus !== "COMPLETED") notFound();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  if (user.userType === "UMKM_EXISTING") {
    const item = await new PrivateOpportunityHypothesisRepository().findForBusiness(user.id, id);
    if (!item?.hypothesis.growthRoadmap) notFound();
    return <PrivateGrowthView item={item} />;
  }
  const item = await new PrivateOpportunityHypothesisRepository().findForEntrepreneur(user.id, id);
  if (!item?.saved || !item.hypothesis.startupRoadmap) notFound();
  return <PrivateStartupView item={item} />;
}
