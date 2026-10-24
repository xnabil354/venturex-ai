import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/auth/current-admin";
import { AdminHeaderNavigation } from "@/components/admin/admin-header-navigation";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  return (
    <div className="min-h-screen bg-warm-parchment text-ink-charcoal">
      <a className="fixed left-16 top-12 z-[60] -translate-y-[calc(100%+1rem)] bg-midnight-wine px-12 py-8 text-body-sm font-w540 text-paper-white transition-transform focus:translate-y-0" href="#admin-content">Lewati navigasi</a>
      <AdminHeaderNavigation adminEmail={admin.email} />
      <main id="admin-content">{children}</main>
    </div>
  );
}
