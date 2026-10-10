"use client";

import Link from "next/link";

import { Button, EmptyState, LoadingSkeleton, PageContainer } from "@/components/ui";

const dashboardLinkClasses =
  "inline-flex min-h-button items-center justify-center rounded-buttons bg-midnight-wine px-12 text-body-sm font-w460 text-paper-white transition-[background-color,color,transform] duration-150 ease-out hover:bg-midnight-wine/90 active:translate-y-px";

export function ShellLoadingState() {
  return (
    <PageContainer>
      <div
        aria-busy="true"
        className="grid max-w-[720px] gap-24 py-32 sm:py-48 lg:py-64"
      >
        <div className="grid gap-16">
          <LoadingSkeleton className="h-12 w-32" />
          <LoadingSkeleton className="h-48 w-3/4" />
          <LoadingSkeleton className="h-20 w-full" />
        </div>
        <div className="grid gap-12 border-t border-soft-mist pt-24">
          <LoadingSkeleton className="h-16 w-full" />
          <LoadingSkeleton className="h-16 w-11/12" />
          <LoadingSkeleton className="h-16 w-4/5" />
        </div>
      </div>
    </PageContainer>
  );
}

export function ShellErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <PageContainer>
      <div className="py-32 sm:py-48 lg:py-64">
        <EmptyState
          action={<Button onClick={onRetry}>Try again</Button>}
          description="The page could not load. Try the request again or return to Dashboard."
          title="Something went wrong"
        />
      </div>
    </PageContainer>
  );
}

export function ShellNotFoundState() {
  return (
    <PageContainer>
      <div className="py-32 sm:py-48 lg:py-64">
        <EmptyState
          action={
            <Link className={dashboardLinkClasses} href="/dashboard">
              Return to Dashboard
            </Link>
          }
          description="The page you requested does not exist in this application."
          title="Page not found"
        />
      </div>
    </PageContainer>
  );
}
