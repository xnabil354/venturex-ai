import { useId } from "react";
import Link from "next/link";

import type { DashboardModuleState, DashboardModuleStatus } from "../../dashboard/dto";
import { Badge, Card } from "../ui";
import { ArrowRightIcon, RouteIcon } from "../landing/icons";
import { cx } from "@/lib/cx";

const statusCopy = {
  AVAILABLE: "Tersedia",
  EMPTY: "Belum ada data",
  UNAVAILABLE: "Belum tersedia",
  ERROR: "Tidak dapat dimuat",
} as const satisfies Record<DashboardModuleStatus, string>;

export type ModuleStatusCardProps = {
  readonly description: string;
  readonly state: DashboardModuleState;
  readonly title: string;
  readonly href?: string;
};

export function ModuleStatusCard({ description, state, title, href }: ModuleStatusCardProps) {
  const headingId = useId();
  const isAvailable = state.status === "AVAILABLE";

  return (
    <section aria-labelledby={headingId}>
      <Card
        surface={isAvailable ? "transparent" : "paper"}
        className={cx(
          "grid gap-20 p-20 transition-colors duration-200 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-24 sm:p-28",
          isAvailable
            ? "border-deep-lagoon/50 bg-deep-lagoon text-paper-white"
            : "border-[#ded8cb] text-ink-charcoal hover:border-midnight-wine/35",
        )}
      >
        <div className="flex min-w-0 items-start gap-14">
          <span
            className={cx(
              "flex size-48 shrink-0 items-center justify-center rounded-small-buttons border",
              isAvailable
                ? "border-paper-white/20 bg-paper-white/10 text-lilac-mist"
                : "border-[#ded8cb] bg-warm-parchment text-midnight-wine",
            )}
          >
            <RouteIcon className="size-20" />
          </span>
          <div className="grid min-w-0 gap-6">
            <span
              className={cx(
                "text-caption font-w540 uppercase tracking-widest",
                isAvailable ? "text-lilac-mist" : "text-royal-violet",
              )}
            >
              Rencana usaha
            </span>
            <h2
              className={cx(
                "break-words text-body sm:text-heading-sm font-w460 leading-heading-sm tracking-heading-sm",
                isAvailable ? "text-paper-white" : "text-ink-charcoal",
              )}
              id={headingId}
            >
              {title}
            </h2>
            <p
              className={cx(
                "max-w-[62ch] text-body-sm leading-relaxed",
                isAvailable ? "text-paper-white/80" : "text-stone-gray",
              )}
            >
              {description}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-12 sm:flex-col sm:items-end sm:justify-center sm:pl-0">
          {isAvailable ? (
            <span className="inline-flex min-h-28 items-center rounded-pills border border-paper-white/20 bg-paper-white/10 px-10 text-caption font-w540 text-paper-white">
              {statusCopy[state.status]}
            </span>
          ) : (
            <Badge tone="neutral">{statusCopy[state.status]}</Badge>
          )}
          {href ? (
            <Link
              className={cx(
                "group inline-flex min-h-button items-center justify-center gap-8 rounded-buttons px-14 text-body-sm font-w540 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet",
                isAvailable
                  ? "bg-paper-white text-midnight-wine hover:bg-lilac-mist"
                  : "bg-midnight-wine text-paper-white hover:bg-[#5a2932]",
              )}
              href={href}
            >
              <span>Buka Roadmap</span>
              <ArrowRightIcon className="size-14 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none" />
            </Link>
          ) : null}
        </div>
      </Card>
    </section>
  );
}
