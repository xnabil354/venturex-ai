import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { getCurrentUser } from "@/auth/current-user";
import { resolveOnboardingDestination } from "@/auth/routing";
import { ONBOARDING_STATUSES } from "@/auth/user-types";
import { DashboardQueryService } from "@/dashboard/service";
import { redirect } from "next/navigation";
import { loadDashboardExploration } from "@/dashboard/exploration";

export const dynamic = "force-dynamic";

type DashboardRoutePageProps = {
  readonly searchParams: Promise<{ readonly profileUpdated?: string }>;
};

export default async function DashboardRoutePage({ searchParams }: DashboardRoutePageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED) {
    redirect(resolveOnboardingDestination(user));
  }

  const [dashboard, query] = await Promise.all([
    new DashboardQueryService({ currentUserResolver: async () => user }).get(),
    searchParams,
  ]);

  const productQuery = dashboard.userType === "ENTREPRENEUR" ? dashboard.profile.preferredProductType ?? "" : dashboard.profile.businessName;
  const modules = await loadDashboardExploration(user, productQuery);
  return <DashboardPage dashboard={{ ...dashboard, modules }} viewerId={user.id} profileUpdated={query.profileUpdated === "1"} />;
}
