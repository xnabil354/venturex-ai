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
    <header className="grid gap-12 border-b border-soft-mist pb-20 sm:gap-16 sm:pb-28">
      <div className="grid gap-6 sm:gap-8">
        <h1 className="text-subheading font-w460 leading-subheading tracking-[-0.4px] text-ink-charcoal sm:text-heading-lg sm:leading-heading-lg sm:tracking-heading-lg lg:text-display lg:leading-display lg:tracking-display text-balance">
          Selamat datang kembali
        </h1>
        <p className="max-w-[62ch] text-body font-w460 leading-relaxed text-stone-gray">
          {getSubtitle(dashboard)}
        </p>
      </div>
    </header>
  );
}
