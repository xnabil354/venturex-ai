import { redirect } from "next/navigation";

import { getCurrentUser } from "@/auth/current-user";
import { resolveOnboardingDestination } from "@/auth/routing";
import { BusinessProfileForm } from "@/components/onboarding/business-profile-form";
import { OnboardingLayout } from "@/components/onboarding/onboarding-layout";
import { BusinessProfileService } from "@/profile/business-service";

export default async function BusinessOnboardingPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const destination = resolveOnboardingDestination(user);
  if (destination !== "/onboarding/business") {
    redirect(destination);
  }

  const initialValues = await new BusinessProfileService().getForOnboarding(user.id);

  return (
    <OnboardingLayout showBackToSelection>
      <BusinessProfileForm {...(initialValues ? { initialValues } : {})} />
    </OnboardingLayout>
  );
}
