import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/auth/current-admin";
import { LogoutButton } from "@/components/auth/logout-button";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  return <div className="min-h-screen bg-warm-parchment text-ink-charcoal"><a className="fixed left-16 top-12 z-50 -translate-y-[calc(100%+1rem)] bg-midnight-wine px-12 py-8 text-body-sm font-w540 text-paper-white transition-transform focus:translate-y-0" href="#admin-content">Lewati navigasi</a><header className="border-b border-white/10 bg-[#14080e] text-paper-white"><div className="mx-auto flex min-h-72 w-full max-w-content flex-wrap items-center justify-between gap-12 px-16 py-12 sm:px-24"><div><Link className="text-heading-sm font-w460 tracking-heading-sm" href="/admin/transactions">VENTUREX <span className="text-lilac-mist">/ Operator</span></Link><p className="mt-2 text-caption text-paper-white/60">{admin.email}</p></div><nav aria-label="Navigasi admin" className="order-3 flex w-full gap-8 border-t border-white/10 pt-10 sm:order-none sm:w-auto sm:border-0 sm:pt-0"><Link className="min-h-button rounded-small-buttons px-10 py-8 text-body-sm font-w540 text-paper-white/75 hover:bg-white/10 hover:text-lilac-mist focus-visible:outline-2 focus-visible:outline-lilac-mist" href="/admin/transactions">Transaksi</Link><Link className="min-h-button rounded-small-buttons px-10 py-8 text-body-sm font-w540 text-paper-white/75 hover:bg-white/10 hover:text-lilac-mist focus-visible:outline-2 focus-visible:outline-lilac-mist" href="/admin/pricing">Pricing</Link><Link className="min-h-button rounded-small-buttons px-10 py-8 text-body-sm font-w540 text-paper-white/75 hover:bg-white/10 hover:text-lilac-mist focus-visible:outline-2 focus-visible:outline-lilac-mist" href="/admin/usage">Tarif kredit</Link></nav><LogoutButton className="border border-white/15 px-10 text-paper-white hover:bg-white/10 hover:text-lilac-mist" /></div></header><main id="admin-content">{children}</main></div>;
}
