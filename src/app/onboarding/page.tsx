import { redirect } from "next/navigation";

import { getCurrentUser } from "@/auth/current-user";
import { resolveOnboardingDestination } from "@/auth/routing";
import { ONBOARDING_STATUSES } from "@/auth/user-types";
import { OnboardingLayout } from "@/components/onboarding/onboarding-layout";
import { UserTypeSelection } from "@/components/onboarding/user-type-selection";

type OnboardingPageProps = Readonly<{
  searchParams: Promise<{ reselect?: string | string[] }>;
}>;

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const { reselect } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const allowReselection =
    reselect === "1" &&
    user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED;
  const destination = resolveOnboardingDestination(user);
  if (destination !== "/onboarding" && !allowReselection) {
    redirect(destination);
  }

  return (
    <OnboardingLayout>
      <UserTypeSelection
        initialUserType={allowReselection ? user.userType : null}
      />
    </OnboardingLayout>
  );
}
