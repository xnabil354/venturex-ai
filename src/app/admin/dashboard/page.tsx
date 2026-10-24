import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/auth/current-admin";
import { getAdminDashboardSummary, type AdminTransaction } from "@/billing/admin";
import { formatRupiah } from "@/billing/catalog";
import { Card, PageContainer } from "@/components/ui";

export const dynamic = "force-dynamic";

const statusLabels = {
  PENDING: "Menunggu pembayaran",
  PAID: "Berhasil dibayar",
  FAILED: "Gagal",
  EXPIRED: "Kedaluwarsa",
} as const;

const statusClasses = {
  PENDING: "border-amber-300 bg-amber-50 text-amber-900",
  PAID: "border-emerald-300 bg-emerald-50 text-emerald-900",
  FAILED: "border-red-300 bg-red-50 text-red-900",
  EXPIRED: "border-soft-mist bg-warm-parchment text-stone-gray",
} as const;

const adminWorkItems = [
  ["Transaksi", "Pantau pembayaran dan status callback.", "/admin/transactions"],
  ["Pricing", "Atur harga serta kredit checkout berikutnya.", "/admin/pricing"],
  ["Tarif kredit", "Atur biaya untuk aksi AI baru.", "/admin/usage"],
] as const;

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

function StatusBadge({ status }: { readonly status: AdminTransaction["status"] }) {
  return (
    <span className={`inline-flex rounded-pills border px-8 py-3 text-caption font-w540 ${statusClasses[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

function DashboardUnavailable() {
  return (
    <Card className="mt-28 max-w-[62ch] border-l-2 border-l-deep-lagoon p-20">
      <h2 className="text-label-bold font-w460">Ringkasan belum dapat dimuat.</h2>
      <p className="mt-8 text-body-sm leading-relaxed text-stone-gray">Data transaksi atau akun sedang tidak tersedia. Muat ulang halaman, atau lanjutkan ke daftar transaksi untuk mencoba kembali.</p>
      <div className="mt-16 flex flex-wrap gap-8">
        <Link className="inline-flex min-h-button items-center rounded-buttons bg-midnight-wine px-16 text-body-sm font-w540 text-paper-white transition-colors hover:bg-[#2d1018] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet" href="/admin/dashboard">Muat ulang</Link>
        <Link className="inline-flex min-h-button items-center rounded-small-buttons border border-soft-mist px-14 text-body-sm font-w540 text-royal-violet transition-colors hover:border-royal-violet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet" href="/admin/transactions">Buka transaksi</Link>
      </div>
    </Card>
  );
}

export default async function AdminDashboardPage() {
  // ASVS 8.3.1: keep the privileged read behind a trusted server-side role check.
  if (!(await getCurrentAdmin())) {
    redirect("/login");
  }

  let summary: Awaited<ReturnType<typeof getAdminDashboardSummary>> | null = null;
  try {
    summary = await getAdminDashboardSummary();
  } catch {
    // An operational overview must not expose storage errors to an operator.
  }

  return (
    <PageContainer className="py-10 sm:py-28 lg:py-36">
      <header className="border-b border-soft-mist pb-24">
        <p className="text-caption font-w540 uppercase tracking-[0.14em] text-royal-violet">Operator · ringkasan</p>
        <h1 className="mt-10 max-w-[18ch] text-heading-sm font-w460 tracking-heading-sm sm:text-heading-lg sm:tracking-heading-lg">Pantau pembayaran dan akses akun.</h1>
        <p className="mt-12 max-w-[62ch] text-body-sm leading-relaxed text-stone-gray">Ringkasan ini membantu operator melihat kondisi pembayaran dan entitlement akun tanpa mengubah transaksi atau saldo pengguna.</p>
      </header>

      {!summary ? <DashboardUnavailable /> : (
        <>
          <section aria-labelledby="payment-overview-title" className="mt-28 grid gap-16 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,.75fr)]">
            <article className="rounded-cards bg-deep-lagoon p-20 text-paper-white sm:p-28">
              <div className="flex flex-wrap items-start justify-between gap-12">
                <div>
                  <p className="text-caption font-w540 uppercase tracking-[0.12em] text-lilac-mist">Pembayaran berhasil</p>
                  <h2 id="payment-overview-title" className="mt-8 text-heading-lg font-w460 tracking-heading-lg">{formatRupiah(summary.paidAmount)}</h2>
                </div>
                <p className="max-w-[21ch] text-caption leading-relaxed text-paper-white/65">Transaksi dibuat {dateFormatter.format(summary.windowStart)}—{dateFormatter.format(summary.windowEnd)}.</p>
              </div>
              <div className="mt-24 grid gap-8 border-t border-white/15 pt-16 sm:grid-cols-2">
                {(["PAID", "PENDING", "FAILED", "EXPIRED"] as const).map((status) => (
                  <div className="flex items-center justify-between gap-12" key={status}>
                    <span className="text-body-sm text-paper-white/80">{statusLabels[status]}</span>
                    <span className="text-label-bold font-w460">{summary.transactionCounts[status]}</span>
                  </div>
                ))}
              </div>
            </article>

            <Card className="p-20 sm:p-24">
              <p className="text-caption font-w540 uppercase tracking-[0.12em] text-royal-violet">Akun & akses</p>
              <p className="mt-8 text-heading-lg font-w460 tracking-heading-lg text-ink-charcoal">{summary.activeUsers}</p>
              <p className="mt-2 text-body-sm text-stone-gray">akun pengguna aktif</p>
              <dl className="mt-18 grid gap-10 border-t border-soft-mist pt-16 text-body-sm">
                <div className="flex items-center justify-between gap-12"><dt className="text-stone-gray">Trial aktif</dt><dd className="font-w540 text-ink-charcoal">{summary.activeTrialUsers}</dd></div>
                <div className="flex items-center justify-between gap-12"><dt className="text-stone-gray">Premium aktif</dt><dd className="font-w540 text-ink-charcoal">{summary.activePremiumUsers}</dd></div>
                <div className="flex items-center justify-between gap-12"><dt className="text-stone-gray">Pro aktif</dt><dd className="font-w540 text-ink-charcoal">{summary.activeProUsers}</dd></div>
              </dl>
            </Card>
          </section>

          <section aria-labelledby="recent-transactions-title" className="mt-24 grid gap-16 xl:grid-cols-[minmax(0,1.25fr)_minmax(17rem,.75fr)]">
            <Card className="overflow-hidden p-0">
              <div className="flex flex-wrap items-end justify-between gap-12 border-b border-soft-mist p-16 sm:p-20">
                <div>
                  <p className="text-caption font-w540 uppercase tracking-[0.12em] text-royal-violet">Pembayaran terbaru</p>
                  <h2 id="recent-transactions-title" className="mt-5 text-label-bold font-w460">Transaksi yang baru dibuat</h2>
                </div>
                <Link className="inline-flex min-h-button items-center text-body-sm font-w540 text-royal-violet underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet" href="/admin/transactions">Lihat semua transaksi</Link>
              </div>
              {summary.recentTransactions.length === 0 ? (
                <p className="p-20 text-body-sm leading-relaxed text-stone-gray">Belum ada transaksi yang dibuat. Riwayat pembayaran akan muncul di sini setelah checkout pertama.</p>
              ) : (
                <ul className="divide-y divide-soft-mist">
                  {summary.recentTransactions.map((transaction) => (
                    <li className="grid gap-10 p-16 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-20" key={transaction.merchantOrderId}>
                      <div className="min-w-0">
                        <p className="truncate font-mono text-caption text-ink-charcoal">{transaction.merchantOrderId}</p>
                        <p className="mt-4 break-words text-body-sm text-ink-charcoal">{transaction.email}</p>
                        <p className="mt-3 text-caption text-stone-gray">{transaction.productCode} · {dateFormatter.format(transaction.createdAt)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-10 sm:justify-end">
                        <p className="text-body-sm font-w540 text-ink-charcoal">{formatRupiah(transaction.amount)}</p>
                        <StatusBadge status={transaction.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <aside className="rounded-cards border border-midnight-wine bg-lilac-mist/35 p-20 sm:p-24">
              <p className="text-caption font-w540 uppercase tracking-[0.12em] text-midnight-wine">Ruang kerja operator</p>
              <h2 className="mt-6 text-heading-sm font-w460 tracking-heading-sm">Tiga pekerjaan yang tersedia.</h2>
              <ul className="mt-16 grid gap-6 border-t border-midnight-wine/15 pt-14">
                {adminWorkItems.map(([title, description, href]) => (
                  <li key={href}>
                    <Link className="block rounded-small-buttons px-10 py-10 transition-colors hover:bg-paper-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet" href={href}>
                      <p className="text-body-sm font-w540 text-midnight-wine">{title}</p>
                      <p className="mt-3 text-caption leading-relaxed text-stone-gray">{description}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          </section>
        </>
      )}
    </PageContainer>
  );
}
