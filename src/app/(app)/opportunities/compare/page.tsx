import { isBusinessAnalysisFresh, loadBusinessAnalysisContext } from "@/opportunity/business-analysis-service";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/auth/current-user";
import { PrivateComparisonRecovery } from "@/components/opportunities/private-comparison-recovery";
import { PrivateComparison } from "@/components/opportunities/private-comparison";
import { PrivateOpportunityHypothesisRepository } from "@/opportunity/private-hypothesis-repository";
import { privateComparisonIdsSchema } from "@/opportunity/private-comparison";
import { BusinessComparison } from "@/components/opportunities/business-comparison";

export const dynamic = "force-dynamic";
export default async function PrivateComparePage({ searchParams }: { searchParams: Promise<{ ids?: string | readonly string[]; from?: string }> }) {
  const user = await getCurrentUser();
  if (!user || (user.userType !== "ENTREPRENEUR" && user.userType !== "UMKM_EXISTING") || user.onboardingStatus !== "COMPLETED") notFound();
  const { ids, from } = await searchParams;
  const parsed = privateComparisonIdsSchema.safeParse(typeof ids === "string" && ids.length <= 120 ? ids.split(",") : null);
  if (!parsed.success) notFound();
  const repository = new PrivateOpportunityHypothesisRepository();
  if (user.userType === "UMKM_EXISTING") {
    const context = await loadBusinessAnalysisContext({ ...user, userType: "UMKM_EXISTING" });
    const rows = await Promise.all(parsed.data.map(id => repository.findForBusiness(user.id, id)));
    const items = rows.filter((item): item is NonNullable<typeof item> => Boolean(item && isBusinessAnalysisFresh(context, item) && item.hypothesis.businessAnalysis && item.hypothesis.businessAnalysis.opportunity.score !== null && item.hypothesis.businessAnalysis.fit.score !== null));
    const removedIds = parsed.data.filter(id => !items.some(item => item.id === id));
    return (
      <div className="relative isolate min-h-[calc(100dvh-64px)] bg-warm-parchment">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/Cozy%20Coffee%2C%20Croissant%2C%20and%20Blueberries.png')" }}
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-paper-white/86" />
        <div className="relative z-10">
          <PrivateComparisonRecovery ownerId={user.id} removedIds={removedIds} />
          <BusinessComparison items={items} removedCount={removedIds.length} from={from === "saved" ? "saved" : "finder"} />
        </div>
      </div>
    );
  }
  const items = await Promise.all(parsed.data.map(id => repository.findForEntrepreneur(user.id, id)));
  const available = items.filter((item): item is NonNullable<typeof item> => Boolean(item?.hypothesis.analysis && item.hypothesis.analysis.opportunity.score !== null && item.hypothesis.analysis.fit.score !== null));
  const removedIds = parsed.data.filter(id => !available.some(item => item.id === id));
  return (
    <div className="relative isolate min-h-[calc(100dvh-64px)] bg-warm-parchment">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/Cozy%20Coffee%2C%20Croissant%2C%20and%20Blueberries.png')" }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-paper-white/86" />
      <div className="relative z-10">
        <PrivateComparisonRecovery ownerId={user.id} removedIds={removedIds} />
        <PrivateComparison removedCount={removedIds.length} from={from === "finder" ? "finder" : "saved"} items={available} />
      </div>
    </div>
  );
}
