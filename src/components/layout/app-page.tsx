import type { ReactNode } from "react";

import { PageContainer } from "@/components/ui";

export type AppPageProps = {
  actions?: ReactNode;
  children: ReactNode;
  description?: string;
  title: string;
};

export function AppPage({
  actions,
  children,
  description,
  title,
}: AppPageProps) {
  return (
    <PageContainer>
      <div className="py-32 sm:py-48 lg:py-64">
        <header className="flex flex-col gap-16 border-b border-soft-mist pb-24 sm:flex-row sm:items-end sm:justify-between sm:gap-24">
          <div className="min-w-0 max-w-[62ch]">
            <h1 className="max-w-[18ch] text-heading-sm font-w460 leading-heading-sm tracking-heading-sm text-ink-charcoal sm:text-heading-lg sm:leading-heading-lg sm:tracking-heading-lg">
              {title}
            </h1>
            {description ? (
              <p className="mt-12 max-w-[58ch] text-body-sm leading-body-sm text-stone-gray">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-8">{actions}</div>
          ) : null}
        </header>
        <div className="pt-24">{children}</div>
      </div>
    </PageContainer>
  );
}
