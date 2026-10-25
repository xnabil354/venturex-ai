"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import type { BillingSummary } from "@/billing/service";
import { useBillingState } from "@/components/billing/billing-state";
import { StatusNotice } from "@/components/ui/status-notice";

export function BillingPaymentStatus({ initialSummary, showNotice }: { readonly initialSummary: BillingSummary | null; readonly showNotice: boolean }) {
  const router = useRouter();
  const billing = useBillingState();
  const current = billing?.snapshot;
  const lastSnapshot = useRef(current);

  useEffect(() => {
    if (current === lastSnapshot.current) return;
    lastSnapshot.current = current;
    if (!current || !initialSummary) return;
    if (current.plan !== initialSummary.plan
      || current.planEndsAt !== initialSummary.planEndsAt
      || current.trialEndsAt !== initialSummary.trialEndsAt
      || current.accessDaysRemaining !== initialSummary.accessDaysRemaining
      || current.scheduledPlan !== initialSummary.scheduledPlan
      || current.scheduledStartsAt !== initialSummary.scheduledStartsAt
      || current.canUseAi !== initialSummary.canUseAi
      || current.availableCredits !== initialSummary.availableCredits
      || current.requiresRenewal !== initialSummary.requiresRenewal) router.refresh();
  }, [current, initialSummary, router]);

  if (!showNotice) return null;

  return <StatusNotice role="status" tone="info">
    <span>Status pembayaran sedang diverifikasi. Paket dan kredit akan diperbarui otomatis setelah pembayaran dikonfirmasi. Jika belum berubah setelah beberapa saat, perbarui status.</span>{" "}
    <button className="ml-8 min-h-44 font-w540 text-royal-violet underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet" onClick={() => { void billing?.refresh().catch(() => {}).finally(() => router.refresh()); }} type="button">Perbarui status</button>
  </StatusNotice>;
}
