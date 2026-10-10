import type { ReactNode } from "react";

import { AppHeaderNavigation } from "@/components/layout/app-header-navigation";

type AppShellProps = {
  children: ReactNode;
  userEmail?: string;
};

export function AppShell({ children, userEmail }: AppShellProps) {
  return (
    <div className="min-h-screen bg-warm-parchment">
      <a
        className="fixed left-16 top-12 z-50 -translate-y-[calc(100%+1rem)] bg-midnight-wine px-12 py-8 text-body-sm font-w540 text-paper-white transition-transform focus:translate-y-0"
        href="#main-content"
      >
        Skip to content
      </a>
      <AppHeaderNavigation {...(userEmail ? { userEmail } : {})} />
      <main className="min-w-0" id="main-content">
        {children}
      </main>
    </div>
  );
}
