import { getCurrentUser } from "@/auth/current-user";
import { USER_TYPES } from "@/auth/user-types";
import { Card, PageContainer } from "@/components/ui";
import { RoadmapList } from "@/components/roadmaps/roadmap-list";
import type { RoadmapPage } from "@/roadmap/domain";
import { StartupRoadmapService } from "@/roadmap/service";
import { notFound } from "next/navigation";
import { ONBOARDING_STATUSES } from "@/auth/user-types";

export default async function RoadmapsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly page?: string | readonly string[] }>;
}) {
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  if (!user || user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED || !user.userType) notFound();
  if (user.userType !== USER_TYPES.ENTREPRENEUR && user.userType !== USER_TYPES.UMKM_EXISTING) notFound();
  const roadmapType = user.userType === USER_TYPES.ENTREPRENEUR ? "STARTUP" : "GROWTH";
  const roadmapLabel = roadmapType === "STARTUP" ? "Startup Roadmap" : "Growth Roadmap";
  const requestedPage = Number(Array.isArray(query.page) ? query.page[0] : query.page);
  const pageNumber = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  let page: RoadmapPage | null = null;
  try {
    page = await new StartupRoadmapService({ currentUserResolver: async () => user }).listForCurrentUser({
      page: pageNumber,
      pageSize: 20,
      type: roadmapType,
    });
  } catch {
    page = null;
  }
  if (page) return <RoadmapList page={page} roadmapType={roadmapType} />;
  return (
    <PageContainer>
      <div className="grid gap-24 py-32 sm:py-48 lg:py-64">
        <header className="grid gap-8">
          <h1 className="text-heading-lg font-w460 text-ink-charcoal sm:text-display">{roadmapLabel}</h1>
        </header>
        <Card className="grid gap-8 border-l-2 border-midnight-wine p-20 sm:p-24">
          <h2 className="text-label-bold text-ink-charcoal">{roadmapLabel} belum dapat dimuat</h2>
          <p className="text-body-sm leading-body-sm text-stone-gray">Coba muat halaman ini kembali. Data tersimpan tidak diubah.</p>
        </Card>
      </div>
    </PageContainer>
  );
}
