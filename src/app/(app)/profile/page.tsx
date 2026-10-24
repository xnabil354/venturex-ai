import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/auth/current-user";
import { resolveOnboardingDestination } from "@/auth/routing";
import { ONBOARDING_STATUSES, USER_TYPES, type UserType } from "@/auth/user-types";
import { BusinessProfileForm } from "@/components/onboarding/business-profile-form";
import { EntrepreneurProfileForm } from "@/components/onboarding/entrepreneur-profile-form";
import { ProfileSurface } from "@/components/profile/profile-surface";
import { UserTypeSwitcher } from "@/components/profile/user-type-switcher";
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
      <ProfileLayout
        description="Perbarui konteks usaha yang dipakai VENTUREX untuk menyusun peluang, analisis, dan langkah berikutnya."
        title="Profil entrepreneur"
        userType={user.userType}
      >
        <EntrepreneurProfileForm initialValues={initialValues} mode="edit" />
      </ProfileLayout>
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
      <ProfileLayout
        description="Tinjau identitas, produk, dan cara Anda melayani pelanggan agar konteks usaha tetap akurat."
        title={initialValues.businessName || "Profil bisnis"}
        userType={user.userType}
      >
        <BusinessProfileForm initialValues={initialValues} mode="edit" />
      </ProfileLayout>
    );
  }

  redirect("/dashboard");
}

function ProfileLayout({
  children,
  description,
  title,
  userType,
}: {
  readonly children: React.ReactNode;
  readonly description: string;
  readonly title: string;
  readonly userType: UserType;
}) {
  return (
    <ProfileSurface>
      <div className="py-24 sm:py-40">
        <header className="grid gap-20 rounded-cards border border-midnight-wine bg-midnight-wine p-20 text-paper-white sm:grid-cols-[minmax(0,1fr)_minmax(15rem,0.45fr)] sm:items-end sm:gap-32 sm:p-28">
          <div className="max-w-[46rem]">
            <p className="text-caption font-w540 uppercase tracking-[0.14em] text-lilac-mist">Ruang kerja Anda</p>
            <h1 className="mt-8 text-heading-lg font-w460 tracking-heading-lg">{title}</h1>
            <p className="mt-12 max-w-[58ch] text-body leading-relaxed text-paper-white/75">{description}</p>
          </div>
          <div className="rounded-small-buttons border border-white/15 bg-white/10 p-14">
            <p className="text-caption font-w540 uppercase tracking-[0.12em] text-lilac-mist">Pembaruan profil</p>
            <p className="mt-5 text-body-sm leading-relaxed text-paper-white/80">Lengkapi setiap bagian, lalu simpan perubahan pada langkah terakhir.</p>
            <UserTypeSwitcher currentUserType={userType} />
          </div>
        </header>
        <div className="mt-24">{children}</div>
      </div>
    </ProfileSurface>
  );
}
