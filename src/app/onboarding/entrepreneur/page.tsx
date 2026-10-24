import { redirect } from "next/navigation";

import { getCurrentUser } from "@/auth/current-user";
import { resolveOnboardingDestination } from "@/auth/routing";
import { EntrepreneurProfileForm } from "@/components/onboarding/entrepreneur-profile-form";
import { OnboardingLayout } from "@/components/onboarding/onboarding-layout";
import { EntrepreneurProfileService } from "@/profile/service";

export default async function EntrepreneurOnboardingPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const destination = resolveOnboardingDestination(user);
  if (destination !== "/onboarding/entrepreneur") {
    redirect(destination);
  }

  const initialValues = await new EntrepreneurProfileService().getForOnboarding(user.id);

  return (
    <OnboardingLayout showBackToSelection>
      <EntrepreneurProfileForm {...(initialValues ? { initialValues } : {})} />
    </OnboardingLayout>
  );
}
