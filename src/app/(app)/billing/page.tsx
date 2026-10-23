import { getCurrentUser } from "@/auth/current-user";
import { formatRupiah } from "@/billing/catalog";
import { BillingService } from "@/billing/service";
import { BillingCheckoutButton } from "@/components/billing/billing-checkout-button";
import { Card, PageContainer } from "@/components/ui";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const billing = new BillingService();
  let summary: Awaited<ReturnType<BillingService["summaryForUser"]>> | null = null;
  let offers: Awaited<ReturnType<BillingService["listProductOffers"]>> | null = null;
  let usage: Awaited<ReturnType<BillingService["listUsageCosts"]>> | null = null;
  try { [summary, offers, usage] = await Promise.all([billing.summaryForUser(user.id), billing.listProductOffers(), billing.listUsageCosts()]); } catch { /* The page remains useful if billing storage is temporarily unavailable. */ }
  const plans = offers?.filter((product) => product.kind === "PLAN") ?? [];
  const topups = offers?.filter((product) => product.kind === "TOPUP") ?? [];
  return <PageContainer className="py-32 sm:py-48">
    <div className="max-w-[50rem]">
      <p className="text-caption font-w540 uppercase tracking-[0.14em] text-royal-violet">Paket & kredit</p>
      <h1 className="mt-10 text-heading-lg font-w460 tracking-heading-lg text-ink-charcoal">Gunakan AI dengan batas yang jelas.</h1>
      <p className="mt-12 max-w-[62ch] text-body leading-relaxed text-stone-gray">Pembayaran berjalan di Duitku sandbox. Kredit plan berlaku sepanjang periode plan; kredit top up tidak kedaluwarsa.</p>
    </div>
    <Card className="mt-28 bg-deep-lagoon text-paper-white border-none p-20 sm:p-24">
      {summary ? <div className="grid gap-16 sm:grid-cols-3">
        <div><p className="text-caption uppercase tracking-[0.12em] text-lilac-mist">Status AI</p><p className="mt-5 text-label-bold">{summary.canUseAi ? "Aktif" : "Terkunci"}</p></div>
        <div><p className="text-caption uppercase tracking-[0.12em] text-lilac-mist">Paket</p><p className="mt-5 text-label-bold">{summary.plan}</p>{summary.planEndsAt ? <p className="mt-4 text-caption text-paper-white/70">Berakhir {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(summary.planEndsAt))}</p> : null}</div>
        <div><p className="text-caption uppercase tracking-[0.12em] text-lilac-mist">Kredit tersedia</p><p className="mt-5 text-label-bold">{summary.availableCredits} kredit</p><p className="mt-4 text-caption text-paper-white/70">{summary.topupCredits} top up · {summary.expiringCredits} periodik</p></div>
      </div> : <p className="text-body-sm text-paper-white/85">Status kredit sedang tidak tersedia. Anda tetap dapat melihat katalog paket di bawah.</p>}
    </Card>
    {offers ? <><section className="mt-36" aria-labelledby="plan-title"><h2 id="plan-title" className="text-heading-sm font-w460 tracking-heading-sm">Paket 30 hari</h2><div className="mt-16 grid gap-16 lg:grid-cols-2">{plans.map((product) => <Card key={product.code} className="flex flex-col p-20"><p className="text-caption font-w540 uppercase tracking-[0.12em] text-royal-violet">{product.plan}</p><h3 className="mt-6 text-label-bold">{product.name}</h3><p className="mt-12 text-heading-sm font-w460">{formatRupiah(product.amount)}</p><p className="mt-8 flex-1 text-body-sm leading-relaxed text-stone-gray">{product.credits} kredit AI untuk 30 hari. Premium dan Pro hanya berbeda pada jatah kredit.</p><div className="mt-20"><BillingCheckoutButton productCode={product.code}>Pilih {product.plan}</BillingCheckoutButton></div></Card>)}</div></section><section className="mt-36" aria-labelledby="topup-title"><h2 id="topup-title" className="text-heading-sm font-w460 tracking-heading-sm">Top up kredit</h2><p className="mt-8 text-body-sm text-stone-gray">Top up dapat dibeli oleh semua pengguna, tetapi AI tetap mensyaratkan paket aktif atau trial yang tersisa.</p><div className="mt-16 grid gap-16 md:grid-cols-3">{topups.map((product) => <Card key={product.code} className="flex flex-col p-20"><h3 className="text-label-bold">{product.name}</h3><p className="mt-8 text-heading-sm font-w460">{formatRupiah(product.amount)}</p><p className="mt-8 flex-1 text-body-sm text-stone-gray">Tidak kedaluwarsa.</p><div className="mt-20"><BillingCheckoutButton productCode={product.code}>Beli kredit</BillingCheckoutButton></div></Card>)}</div></section><section className="mt-36 border-t border-soft-mist pt-24"><h2 className="text-label-bold">Tarif aksi AI</h2><dl className="mt-12 grid gap-8 text-body-sm text-stone-gray sm:grid-cols-3">{usage?.map((item) => <div key={item.usage}><dt>{item.usage === "OPPORTUNITY_HYPOTHESIS" ? "Buat hipotesis" : "Analisis mendalam"}</dt><dd className="mt-2 font-w540 text-ink-charcoal">{item.credits} kredit</dd></div>)}</dl></section></> : <Card className="mt-36"><p className="text-body-sm text-stone-gray">Katalog pembayaran sedang belum tersedia. Coba muat ulang beberapa saat lagi.</p></Card>}
  </PageContainer>;
}
