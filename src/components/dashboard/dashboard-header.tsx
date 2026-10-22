import { USER_TYPES } from "../../auth/user-types";
import type { DashboardDto } from "../../dashboard/dto";

function assertNever(value: never): never {
  throw new Error(`Unsupported dashboard user type: ${String(value)}`);
}

function getSubtitle(dashboard: DashboardDto): string {
  switch (dashboard.userType) {
    case USER_TYPES.ENTREPRENEUR:
      return "Profil calon pengusaha Anda";
    case USER_TYPES.UMKM_EXISTING:
      return `Gambaran usaha ${dashboard.profile.businessName}`;
    default:
      return assertNever(dashboard);
  }
}

export type DashboardHeaderProps = {
  readonly dashboard: DashboardDto;
};

export function DashboardHeader({ dashboard }: DashboardHeaderProps) {
  return (
    <header className="grid gap-16 border-b border-soft-mist pb-28">
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
