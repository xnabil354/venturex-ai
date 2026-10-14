import type { ReactNode } from "react";
import Link from "next/link";

import { USER_TYPES } from "../../auth/user-types";
import type { DashboardDto, DashboardModules } from "../../dashboard/dto";
import { PageContainer } from "../ui";

import { BusinessSummary } from "./business-summary";
import { DashboardHeader } from "./dashboard-header";
import { EntrepreneurSummary } from "./entrepreneur-summary";
import { ModuleStatusCard } from "./module-status-card";
import { ProfileSummary } from "./profile-summary";

type ModuleDefinition = {
  readonly description: string;
  readonly key: keyof DashboardModules;
  readonly title: string;
};

const entrepreneurModules = [
  {
    description: "Lihat roadmap yang tersimpan atau mulai dari Opportunity yang eligible.",
    key: "roadmap",
    title: "Startup Roadmap",
  },
] satisfies readonly ModuleDefinition[];

const businessModules = [
  {
    description: "Lihat Growth Roadmap tersimpan atau mulai dari Opportunity yang memenuhi syarat.",
    key: "roadmap",
    title: "Growth Roadmap",
  },
] satisfies readonly ModuleDefinition[];

type DashboardLayoutProps = {
  readonly dashboard: DashboardDto;
  readonly profileUpdated: boolean;
  readonly modules: readonly ModuleDefinition[];
  readonly profileStatus: string | null;
  readonly profileSummary: ReactNode;
  readonly profileTitle: string;
};

function DashboardLayout({
  dashboard,
  modules,
  profileStatus,
  profileSummary,
  profileTitle,
  profileUpdated,
}: DashboardLayoutProps) {
  return (
    <PageContainer>
      <div className="grid gap-32 py-32 sm:gap-48 sm:py-48 lg:py-64">
        <DashboardHeader dashboard={dashboard} />
        {profileUpdated ? (
          <p
            aria-live="polite"
            className="border-l-2 border-royal-violet bg-paper-white px-16 py-12 text-body-sm text-ink-charcoal"
            role="status"
          >
            Profil berhasil diperbarui. Ringkasan ini menampilkan data terbaru.
          </p>
        ) : null}
        <ProfileSummary
          action={
            dashboard.userType === USER_TYPES.ENTREPRENEUR ||
            dashboard.userType === USER_TYPES.UMKM_EXISTING ? (
            <Link
              className="text-body-sm font-w540 text-royal-violet underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet"
              href="/profile"
            >
              Edit profil
            </Link>
            ) : null
          }
          statusLabel={profileStatus}
          title={profileTitle}
        >
          {profileSummary}
        </ProfileSummary>
        <section aria-label="Sumber data dan hipotesis" className="grid gap-12 border-y border-soft-mist py-20 sm:grid-cols-2">
          <div className="grid content-start gap-8">
            <h2 className="text-heading-sm font-w460 text-ink-charcoal">Sinyal pencarian terbaru</h2>
            <p className="text-body-sm leading-body-sm text-stone-gray">Muat observasi Google Trends Indonesia saat Anda membutuhkannya. Tidak ada katalog historis yang dipakai sebagai pengganti.</p>
            <Link className="inline-flex min-h-button w-fit items-center text-body-sm font-w540 text-royal-violet underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet" href="/trends">Buka Trend Radar</Link>
          </div>
          <div className="grid content-start gap-8">
            <h2 className="text-heading-sm font-w460 text-ink-charcoal">Hipotesis peluang pribadi</h2>
            <p className="text-body-sm leading-body-sm text-stone-gray">Buat ide dari sinyal live yang tersedia. Setiap ide tetap hipotesis dan perlu diuji secara langsung.</p>
            <Link className="inline-flex min-h-button w-fit items-center text-body-sm font-w540 text-royal-violet underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet" href="/opportunities">Buka Opportunity Finder</Link>
          </div>
        </section>
        <div className="grid gap-24">
          {modules.map((module) => (
            <ModuleStatusCard
              description={module.description}
              key={module.key}
              state={dashboard.modules[module.key]}
              title={module.title}
              href="/roadmaps"
            />
          ))}
        </div>
      </div>
    </PageContainer>
  );
}

function assertNever(value: never): never {
  throw new Error(`Unsupported dashboard user type: ${String(value)}`);
}

export type DashboardPageProps = {
  readonly dashboard: DashboardDto;
  readonly profileUpdated?: boolean;
};

export function DashboardPage({ dashboard, profileUpdated = false }: DashboardPageProps) {
  switch (dashboard.userType) {
    case USER_TYPES.ENTREPRENEUR:
      return (
        <DashboardLayout
          dashboard={dashboard}
          modules={entrepreneurModules}
          profileStatus="Profil siap"
          profileSummary={<EntrepreneurSummary profile={dashboard.profile} />}
          profileTitle="Ringkasan profil"
          profileUpdated={profileUpdated}
        />
      );
    case USER_TYPES.UMKM_EXISTING:
      return (
        <DashboardLayout
          dashboard={dashboard}
          modules={businessModules}
          profileStatus={null}
          profileSummary={<BusinessSummary profile={dashboard.profile} />}
          profileTitle="Ringkasan bisnis"
          profileUpdated={profileUpdated}
        />
      );
    default:
      return assertNever(dashboard);
  }
}
