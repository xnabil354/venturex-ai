import { redirect } from "next/navigation";

import { getCurrentUser } from "@/auth/current-user";
import { resolveOnboardingDestination } from "@/auth/routing";
import { OnboardingLayout } from "@/components/onboarding/onboarding-layout";
import { UserTypeSelection } from "@/components/onboarding/user-type-selection";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const destination = resolveOnboardingDestination(user);
  if (destination !== "/onboarding") {
    redirect(destination);
  }

  return (
    <OnboardingLayout>
      <UserTypeSelection />
    </OnboardingLayout>
  );
}
