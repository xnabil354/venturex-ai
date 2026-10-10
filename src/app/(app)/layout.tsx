import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/auth/current-user";
import { resolveOnboardingDestination } from "@/auth/routing";
import { ONBOARDING_STATUSES } from "@/auth/user-types";
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

  return <AppShell userEmail={user.email}>{children}</AppShell>;
}
