"use client";

import { Button, EmptyState, PageContainer } from "@/components/ui";

export default function OpportunityDetailError({
  reset,
}: {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}) {
  return (
    <PageContainer>
      <div className="py-32 sm:py-48 lg:py-64">
        <EmptyState
          action={<Button onClick={reset} variant="secondary">Coba lagi</Button>}
          description="Detail Opportunity belum dapat dimuat. Silakan coba kembali."
          title="Terjadi kendala"
        />
      </div>
    </PageContainer>
  );
}
