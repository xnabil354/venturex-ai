import { getCurrentUser } from "@/auth/current-user";
import { USER_TYPES } from "@/auth/user-types";
import { Card, PageContainer } from "@/components/ui";
import { RoadmapList } from "@/components/roadmaps/roadmap-list";
import { RoutePlaceholder } from "@/components/layout/route-placeholder";
import type { RoadmapPage } from "@/roadmap/domain";
import { StartupRoadmapService } from "@/roadmap/service";

export default async function RoadmapsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly page?: string | readonly string[] }>;
}) {
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  if (user?.userType !== USER_TYPES.ENTREPRENEUR) {
    return <RoutePlaceholder message="Growth Roadmap untuk UMKM belum tersedia." title="Growth Roadmap" />;
  }
  const requestedPage = Number(Array.isArray(query.page) ? query.page[0] : query.page);
  const pageNumber = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  let page: RoadmapPage | null = null;
  try {
    page = await new StartupRoadmapService({ currentUserResolver: async () => user }).listForCurrentUser({
      page: pageNumber,
      pageSize: 20,
      type: "STARTUP",
    });
  } catch {
    page = null;
  }
  if (page) return <RoadmapList page={page} />;
  return (
    <PageContainer>
      <div className="grid gap-24 py-32 sm:py-48 lg:py-64">
        <header className="grid gap-8">
          <h1 className="text-heading-lg font-w460 text-ink-charcoal sm:text-display">Startup Roadmap</h1>
        </header>
        <Card className="grid gap-8 border-l-2 border-midnight-wine p-20 sm:p-24">
          <h2 className="text-label-bold text-ink-charcoal">Roadmap belum dapat dimuat</h2>
          <p className="text-body-sm leading-body-sm text-stone-gray">Coba muat halaman ini kembali. Data tersimpan tidak diubah.</p>
        </Card>
      </div>
    </PageContainer>
  );
}
