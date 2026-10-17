import type { ReactNode } from "react";
import Link from "next/link";

import { USER_TYPES } from "../../auth/user-types";
import type { DashboardDto, DashboardModules } from "../../dashboard/dto";
import { PageContainer, StatusNotice } from "../ui";

import { BusinessSummary } from "./business-summary";
import { DashboardHeader } from "./dashboard-header";
import { EntrepreneurSummary } from "./entrepreneur-summary";
import { ModuleStatusCard } from "./module-status-card";
import { OpportunityPreviewSection } from "./opportunity-preview-section";
import { ProfileSummary } from "./profile-summary";
import { SavedOpportunityPreviewSection } from "./saved-opportunity-preview-section";
import { TrendPreviewSection } from "./trend-preview-section";

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
          <StatusNotice aria-live="polite" role="status" tone="success">
            Profil berhasil diperbarui. Ringkasan ini menampilkan data terbaru.
          </StatusNotice>
        ) : null}
        <ProfileSummary
          action={
            dashboard.userType === USER_TYPES.ENTREPRENEUR ||
            dashboard.userType === USER_TYPES.UMKM_EXISTING ? (
            <Link
              className="inline-flex min-h-button items-center rounded-small-buttons border border-soft-mist bg-paper-white px-14 py-6 text-body-sm font-w540 text-royal-violet transition-colors hover:border-royal-violet hover:bg-lilac-mist/20 focus-visible:outline-2 focus-visible:outline-royal-violet"
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

        <section aria-labelledby="dashboard-next-steps" className="grid gap-20">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-baseline sm:justify-between border-b border-soft-mist pb-16">
            <h2 className="text-heading-sm font-w460 leading-heading-sm tracking-heading-sm text-ink-charcoal" id="dashboard-next-steps">
              Lanjutkan eksplorasi
            </h2>
            <p className="max-w-[48ch] text-body-sm leading-relaxed text-stone-gray">
              Mulai dari sinyal terbaru, susun hipotesis, lalu simpan dan uji pilihan yang paling relevan.
            </p>
          </div>

          {/* Featured Milestone Card: Roadmap (Flagship Bento Card) */}
          <div className="grid gap-16">
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

          {/* 2-Column Bento Grid: Trend Radar & Opportunity Finder */}
          <div className="grid gap-16 lg:grid-cols-2">
            <TrendPreviewSection state={dashboard.modules.trends} title="Trend Radar" />
            <OpportunityPreviewSection state={dashboard.modules.opportunities} title="Opportunity Finder" />
          </div>

          {/* Bottom Bento Card: Saved Opportunities */}
          <SavedOpportunityPreviewSection state={dashboard.modules.savedOpportunities} title="Peluang tersimpan" />
        </section>
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
