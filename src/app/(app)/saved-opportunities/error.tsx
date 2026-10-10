"use client";

import { Button, EmptyState, PageContainer } from "@/components/ui";

export default function SavedOpportunitiesError({
  reset,
}: {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}) {
  return (
    <PageContainer>
      <div className="py-32 sm:py-48 lg:py-64">
        <EmptyState
          action={<Button onClick={reset} type="button" variant="secondary">Coba lagi</Button>}
          description="Peluang tersimpan belum dapat dimuat. Silakan coba kembali."
          title="Terjadi kendala"
        />
      </div>
    </PageContainer>
  );
}
