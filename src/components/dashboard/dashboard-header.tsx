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
  return (
    <header className="grid gap-12 border-b border-soft-mist pb-24">
      <p className="text-caption font-w540 text-royal-violet">Dashboard</p>
      <div className="grid gap-12">
        <h1 className="max-w-[18ch] text-heading-sm font-w460 leading-heading-sm tracking-heading-sm text-ink-charcoal sm:text-heading-lg sm:leading-heading-lg sm:tracking-heading-lg">
          Selamat datang kembali
        </h1>
        <p className="max-w-[58ch] text-body leading-body text-stone-gray">
          {getSubtitle(dashboard)}
        </p>
      </div>
    </header>
  );
}
