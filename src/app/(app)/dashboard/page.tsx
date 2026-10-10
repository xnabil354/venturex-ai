import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardQueryService } from "@/dashboard/service";

type DashboardRoutePageProps = {
  readonly searchParams: Promise<{ readonly profileUpdated?: string }>;
};

export default async function DashboardRoutePage({ searchParams }: DashboardRoutePageProps) {
  const [dashboard, query] = await Promise.all([
    new DashboardQueryService().get(),
    searchParams,
  ]);

  return <DashboardPage dashboard={dashboard} profileUpdated={query.profileUpdated === "1"} />;
}
