"use client";

import { Button, EmptyState, PageContainer } from "@/components/ui";

export default function Error({ reset }: { readonly reset: () => void }) {
  return (
    <PageContainer>
      <div className="py-32 sm:py-48 lg:py-64">
        <EmptyState
          action={<Button onClick={reset}>Coba lagi</Button>}
          description="Data profil Dashboard tidak dapat dimuat. Coba lagi atau muat ulang halaman."
          title="Dashboard belum dapat dimuat"
        />
      </div>
    </PageContainer>
  );
}
