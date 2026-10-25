import type { ReactNode } from "react";

import { AppHeaderNavigation } from "@/components/layout/app-header-navigation";
import { BillingProvider } from "@/components/billing/billing-state";
import type { BillingSummary } from "@/billing/service";

type AppShellProps = {
  children: ReactNode;
  userEmail?: string;
  initialBillingSummary?: BillingSummary | null;
  redirectOnExpiredPlan?: boolean;
};

export function AppShell({ children, userEmail, initialBillingSummary = null, redirectOnExpiredPlan = false }: AppShellProps) {
  const content = (
    <div className="min-h-screen bg-warm-parchment">
      <a
        className="fixed left-16 top-12 z-50 -translate-y-[calc(100%+1rem)] bg-midnight-wine px-12 py-8 text-body-sm font-w540 text-paper-white transition-transform focus:translate-y-0"
        href="#main-content"
      >
        Skip to content
      </a>
      <AppHeaderNavigation
        {...(userEmail ? { userEmail } : {})}
        {...(initialBillingSummary ? { availableCredits: initialBillingSummary.availableCredits } : {})}
      />
      <main className="min-w-0" id="main-content">
        {children}
      </main>
    </div>
  );
  return userEmail ? <BillingProvider initialSummary={initialBillingSummary} redirectOnExpiredPlan={redirectOnExpiredPlan}>{content}</BillingProvider> : content;
}
