import { USER_TYPES } from "../../auth/user-types";
import type { DashboardDto } from "../../dashboard/dto";

function assertNever(value: never): never {
  throw new Error(`Unsupported dashboard user type: ${String(value)}`);
}

function getSubtitle(dashboard: DashboardDto): string {
  switch (dashboard.userType) {
    case USER_TYPES.ENTREPRENEUR:
      return "Ringkasan profil calon pengusaha Anda";
    case USER_TYPES.UMKM_EXISTING:
      return `Ringkasan bisnis ${dashboard.profile.businessName}`;
    default:
      return assertNever(dashboard);
  }
}

export type DashboardHeaderProps = {
  readonly dashboard: DashboardDto;
};

export function DashboardHeader({ dashboard }: DashboardHeaderProps) {
  const isEntrepreneur = dashboard.userType === USER_TYPES.ENTREPRENEUR;

  return (
    <header className="grid gap-16 border-b border-soft-mist pb-28">
      <div className="flex flex-wrap items-center gap-8 text-caption font-w540 uppercase tracking-wider text-stone-gray">
        <span className="text-royal-violet font-w540">Dashboard</span>
        <span aria-hidden="true" className="text-stone-gray/40">&bull;</span>
        <span className="rounded-pills border border-soft-mist bg-paper-white px-10 py-3 text-ink-charcoal shadow-2xs">
          {isEntrepreneur ? "Jalur Calon Pengusaha" : "Jalur UMKM Berjalan"}
        </span>
      </div>

      <div className="grid gap-8">
        <h1 className="text-heading-lg font-w460 leading-heading-lg tracking-heading-lg text-ink-charcoal sm:text-display sm:leading-display text-balance">
          Selamat datang kembali
        </h1>
        <p className="max-w-[62ch] text-body font-w460 leading-relaxed text-stone-gray">
          {getSubtitle(dashboard)}
        </p>
      </div>
    </header>
  );
}
