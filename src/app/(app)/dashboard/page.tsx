import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { getCurrentUser } from "@/auth/current-user";
import { resolveOnboardingDestination } from "@/auth/routing";
import { ONBOARDING_STATUSES } from "@/auth/user-types";
import { DashboardQueryService } from "@/dashboard/service";
import { redirect } from "next/navigation";

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
    new DashboardQueryService().get(),
    searchParams,
  ]);

  return <DashboardPage dashboard={dashboard} profileUpdated={query.profileUpdated === "1"} />;
}
