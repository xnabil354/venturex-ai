import { redirect } from "next/navigation";

import { getCurrentUser } from "@/auth/current-user";
import { resolveOnboardingDestination } from "@/auth/routing";
import { EntrepreneurProfileForm } from "@/components/onboarding/entrepreneur-profile-form";
import { OnboardingLayout } from "@/components/onboarding/onboarding-layout";

export default async function EntrepreneurOnboardingPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const destination = resolveOnboardingDestination(user);
  if (destination !== "/onboarding/entrepreneur") {
    redirect(destination);
  }

  return (
    <OnboardingLayout showBackToSelection>
      <EntrepreneurProfileForm />
    </OnboardingLayout>
  );
}
