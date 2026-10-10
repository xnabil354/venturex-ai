import Link from "next/link";

import { EmptyState, PageContainer } from "@/components/ui";

export default function OpportunityDetailNotFound() {
  return (
    <PageContainer>
      <div className="py-32 sm:py-48 lg:py-64">
        <EmptyState
          action={(
            <Link
              className="inline-flex min-h-button items-center text-body-sm font-w540 text-royal-violet transition-colors hover:text-midnight-wine hover:underline"
              href="/opportunities"
            >
              Kembali ke Opportunity Finder
            </Link>
          )}
          description="Opportunity ini tidak tersedia atau tidak dapat diakses."
          title="Opportunity tidak ditemukan"
        />
      </div>
    </PageContainer>
  );
}
