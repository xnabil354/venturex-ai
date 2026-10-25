import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/auth/current-user";
import { getCurrentAdmin } from "@/auth/current-admin";
import { resolveOnboardingDestination } from "@/auth/routing";
import { ONBOARDING_STATUSES } from "@/auth/user-types";
import { BillingService } from "@/billing/service";
import { AppShell } from "@/components/layout/app-shell";

export default async function BillingLayout({ children }: Readonly<{ children: ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) {
    if (await getCurrentAdmin()) redirect("/admin/dashboard");
    redirect("/login");
  }
  if (user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED) {
    redirect(resolveOnboardingDestination(user));
  }

  let initialBillingSummary: Awaited<ReturnType<BillingService["summaryForUser"]>> | null = null;
  try {
    initialBillingSummary = await new BillingService().summaryForUser(user.id);
  } catch {
    // Billing remains reachable when the summary is temporarily unavailable.
  }

  return <AppShell userEmail={user.email} initialBillingSummary={initialBillingSummary}>{children}</AppShell>;
}
