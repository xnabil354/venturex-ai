import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/auth/current-user";
import { resolveOnboardingDestination } from "@/auth/routing";
import { ONBOARDING_STATUSES, USER_TYPES } from "@/auth/user-types";
import { BusinessProfileForm } from "@/components/onboarding/business-profile-form";
import { EntrepreneurProfileForm } from "@/components/onboarding/entrepreneur-profile-form";
import { PageContainer } from "@/components/ui";
import {
  BusinessProfileForbiddenError,
  BusinessProfileNotFoundError,
  BusinessProfileStateError,
} from "@/profile/business-errors";
import { BusinessProfileService } from "@/profile/business-service";
import { EntrepreneurProfileNotFoundError } from "@/profile/errors";
import {
  EntrepreneurProfileService,
  type EntrepreneurProfileEditValues,
} from "@/profile/service";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED) {
    redirect(resolveOnboardingDestination(user));
  }
  if (user.userType === USER_TYPES.ENTREPRENEUR) {
    let initialValues: EntrepreneurProfileEditValues;
    try {
      initialValues = await new EntrepreneurProfileService().getForEdit(user.id);
    } catch (error) {
      if (error instanceof EntrepreneurProfileNotFoundError) {
        notFound();
      }
      throw error;
    }

    return (
      <PageContainer>
        <div className="grid gap-24 py-32 sm:gap-32 sm:py-48 lg:py-64">
          <EntrepreneurProfileForm initialValues={initialValues} mode="edit" />
        </div>
      </PageContainer>
    );
  }

  if (user.userType === USER_TYPES.UMKM_EXISTING) {
    let initialValues: Awaited<ReturnType<BusinessProfileService["getForEdit"]>>;
    try {
      initialValues = await new BusinessProfileService().getForEdit(user.id);
    } catch (error) {
      if (error instanceof BusinessProfileNotFoundError) {
        notFound();
      }
      if (
        error instanceof BusinessProfileForbiddenError ||
        error instanceof BusinessProfileStateError
      ) {
        redirect("/dashboard");
      }
      throw error;
    }

    return (
      <PageContainer>
        <div className="grid gap-24 py-32 sm:gap-32 sm:py-48 lg:py-64">
          <BusinessProfileForm initialValues={initialValues} mode="edit" />
        </div>
      </PageContainer>
    );
  }

  redirect("/dashboard");
}
