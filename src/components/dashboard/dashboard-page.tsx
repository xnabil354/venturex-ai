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
import { DashboardRadarPreview } from "./dashboard-radar-preview";
import { JourneyReportCard } from "./journey-report-card";

type ModuleDefinition = {
  readonly description: string;
  readonly key: keyof DashboardModules;
  readonly title: string;
};

const entrepreneurModules = [
  {
    description: "Tinjau roadmap tersimpan atau mulai dari peluang yang sesuai.",
    key: "roadmap",
    title: "Startup Roadmap",
  },
] satisfies readonly ModuleDefinition[];

const businessModules = [
  {
    description: "Tinjau roadmap tersimpan atau mulai dari peluang yang sesuai.",
    key: "roadmap",
    title: "Growth Roadmap",
  },
] satisfies readonly ModuleDefinition[];

type DashboardLayoutProps = {
  readonly viewerId?: string;
  readonly dashboard: DashboardDto;
  readonly profileUpdated: boolean;
  readonly modules: readonly ModuleDefinition[];
  readonly profileSummary: ReactNode;
  readonly profileTitle: string;
};

function DashboardLayout({
  dashboard,
  modules,
  profileSummary,
  profileTitle,
  profileUpdated,
  viewerId,
}: DashboardLayoutProps) {
  const explorationSteps = [
    {
      content: viewerId ? (
        <DashboardRadarPreview
          productQuery={dashboard.userType === USER_TYPES.ENTREPRENEUR ? dashboard.profile.preferredProductType ?? "" : dashboard.profile.businessName}
          state={dashboard.modules.trends}
          userId={viewerId}
        />
      ) : (
        <TrendPreviewSection state={dashboard.modules.trends} title="Trend Radar" />
      ),
      key: "trends",
    },
    {
      content: <OpportunityPreviewSection state={dashboard.modules.opportunities} title="Opportunity Finder" />,
      key: "opportunities",
    },
    {
      content: <SavedOpportunityPreviewSection state={dashboard.modules.savedOpportunities} title="Peluang tersimpan" />,
      key: "saved-opportunities",
    },
    ...modules.map((module) => ({
      content: <ModuleStatusCard description={module.description} href="/roadmaps" state={dashboard.modules[module.key]} title={module.title} />,
      key: module.key,
    })),
  ];

  return (
    <div className="relative isolate min-h-[calc(100dvh-64px)] bg-warm-parchment">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[url('/images/culinary-craft.jpg')] bg-cover bg-center"
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-paper-white/85" />
      <PageContainer className="relative z-10">
        <div className="grid gap-24 py-24 sm:gap-32 sm:py-32 lg:gap-48 lg:py-48">
          <DashboardHeader dashboard={dashboard} />
          {profileUpdated ? (
            <StatusNotice aria-live="polite" role="status" tone="success">
              Profil berhasil diperbarui. Informasi di bawah menampilkan data terbaru.
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
            title={profileTitle}
          >
            {profileSummary}
          </ProfileSummary>

          <section aria-labelledby="dashboard-next-steps" className="grid gap-16 sm:gap-20">
            <div className="flex flex-col gap-6 border-b border-soft-mist pb-12 sm:flex-row sm:items-baseline sm:justify-between sm:pb-16">
              <h2 className="text-heading-sm font-w460 leading-heading-sm tracking-heading-sm text-ink-charcoal" id="dashboard-next-steps">
                Lanjutkan eksplorasi
              </h2>
              <p className="max-w-[48ch] text-body-sm leading-relaxed text-stone-gray sm:text-right">
                Mulai dari tren, lanjutkan ide usaha Anda.
              </p>
            </div>

            <ol aria-label="Perjalanan eksplorasi usaha" className="grid gap-16">
              {explorationSteps.map((step, index) => (
                <li key={step.key} className="relative grid min-w-0 grid-cols-[28px_minmax(0,1fr)] gap-10 sm:grid-cols-[40px_minmax(0,1fr)] sm:gap-16">
                  {index < explorationSteps.length - 1 ? <span aria-hidden="true" className="absolute bottom-[-16px] left-[14px] top-28 w-px bg-soft-mist sm:left-20 sm:top-40" /> : null}
                  <span aria-label={`Langkah ${index + 1}`} className="relative flex size-28 items-center justify-center rounded-full border border-midnight-wine/20 bg-warm-parchment text-caption font-w540 text-midnight-wine sm:size-40">{index + 1}</span>
                  <div className="min-w-0">{step.content}</div>
                </li>
              ))}
            </ol>
          </section>
          {viewerId ? <JourneyReportCard /> : null}
        </div>
      </PageContainer>
    </div>
  );
}

function assertNever(value: never): never {
  throw new Error(`Unsupported dashboard user type: ${String(value)}`);
}

export type DashboardPageProps = {
  readonly viewerId?: string;
  readonly dashboard: DashboardDto;
  readonly profileUpdated?: boolean;
};

export function DashboardPage({ dashboard, profileUpdated = false, viewerId }: DashboardPageProps) {
  switch (dashboard.userType) {
    case USER_TYPES.ENTREPRENEUR:
      return (
        <DashboardLayout
          dashboard={dashboard}
          {...(viewerId ? { viewerId } : {})}
          modules={entrepreneurModules}
          profileSummary={<EntrepreneurSummary profile={dashboard.profile} />}
          profileTitle="Profil calon usaha"
          profileUpdated={profileUpdated}
        />
      );
    case USER_TYPES.UMKM_EXISTING:
      return (
        <DashboardLayout
          dashboard={dashboard}
          {...(viewerId ? { viewerId } : {})}
          modules={businessModules}
          profileSummary={<BusinessSummary profile={dashboard.profile} />}
          profileTitle="Profil usaha"
          profileUpdated={profileUpdated}
        />
      );
    default:
      return assertNever(dashboard);
  }
}
