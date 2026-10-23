import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/auth/current-user";
import { resolveOnboardingDestination } from "@/auth/routing";
import { ONBOARDING_STATUSES } from "@/auth/user-types";
import { BillingService } from "@/billing/service";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  if (user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED) {
    redirect(resolveOnboardingDestination(user));
  }

  let availableCredits: number | undefined;
  try {
    availableCredits = (await new BillingService().summaryForUser(user.id)).availableCredits;
  } catch {
    // Credit availability must not prevent access to the rest of the application.
  }

  return (
    <AppShell userEmail={user.email} {...(availableCredits === undefined ? {} : { availableCredits })}>
      {children}
    </AppShell>
  );
}
