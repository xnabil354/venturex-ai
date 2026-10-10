import type { ReactNode } from "react";
import Link from "next/link";

import { USER_TYPES } from "../../auth/user-types";
import type { DashboardDto, DashboardModules } from "../../dashboard/dto";
import { PageContainer } from "../ui";

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
    description: "Data peluang belum tersedia di aplikasi.",
    key: "opportunities",
    title: "Jelajahi Peluang",
  },
  {
    description: "Data tren belum tersedia di aplikasi.",
    key: "trends",
    title: "Trend Radar",
  },
  {
    description: "Penyimpanan peluang belum tersedia di aplikasi.",
    key: "savedOpportunities",
    title: "Peluang tersimpan",
  },
  {
    description: "Startup Roadmap belum tersedia di aplikasi.",
    key: "roadmap",
    title: "Startup Roadmap",
  },
] satisfies readonly ModuleDefinition[];

const businessModules = [
  {
    description: "Data tren relevan belum tersedia di aplikasi.",
    key: "trends",
    title: "Trend relevan",
  },
  {
    description: "Data peluang pertumbuhan belum tersedia di aplikasi.",
    key: "opportunities",
    title: "Jelajahi Peluang",
  },
  {
    description: "Penyimpanan peluang belum tersedia di aplikasi.",
    key: "savedOpportunities",
    title: "Peluang tersimpan",
  },
  {
    description: "Growth Roadmap belum tersedia di aplikasi.",
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
        <div className="grid gap-24">
          {modules.map((module) => (
            module.key === "opportunities" ? (
              <OpportunityPreviewSection
                key={module.key}
                state={dashboard.modules.opportunities}
                title={module.title}
              />
            ) : module.key === "trends" ? (
              <TrendPreviewSection
                key={module.key}
                state={dashboard.modules.trends}
                title={module.title}
              />
            ) : module.key === "savedOpportunities" ? (
              <SavedOpportunityPreviewSection
                key={module.key}
                state={dashboard.modules.savedOpportunities}
                title={module.title}
              />
            ) : (
              <ModuleStatusCard
                description={module.description}
                key={module.key}
                state={dashboard.modules[module.key]}
                title={module.title}
              />
            )
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
