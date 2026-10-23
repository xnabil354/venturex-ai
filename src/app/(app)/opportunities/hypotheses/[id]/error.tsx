"use client";

import { Button, EmptyState, PageContainer } from "@/components/ui";

export default function HypothesisScoreError({ reset }: { readonly error: Error & { readonly digest?: string }; readonly reset: () => void }) {
  return <PageContainer><div className="py-32 sm:py-48"><EmptyState
    action={<Button onClick={reset} variant="secondary">Coba lagi</Button>}
    description="Detail peluang belum dapat dimuat. Hipotesis Anda tetap tersimpan."
    title="Detail belum tersedia"
  /></div></PageContainer>;
}
