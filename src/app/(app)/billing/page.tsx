import { getCurrentUser } from "@/auth/current-user";
import { formatRupiah } from "@/billing/catalog";
import { BillingService } from "@/billing/service";
import { BillingCheckoutButton } from "@/components/billing/billing-checkout-button";
import { BillingSurface } from "@/components/billing/billing-surface";
import { Card } from "@/components/ui";
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
  const hasCatalog = plans.length > 0 || topups.length > 0;
  const formatDate = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value));

  return (
    <BillingSurface>
      <div className="py-24 sm:py-40">
        <section className="overflow-hidden rounded-cards border border-midnight-wine bg-midnight-wine text-paper-white">
          <div className="grid gap-24 p-20 sm:p-28 lg:grid-cols-[minmax(0,1.15fr)_minmax(24rem,0.85fr)] lg:items-end lg:gap-32 lg:p-32">
            <div className="max-w-[48rem]">
              <p className="text-caption font-w540 uppercase tracking-[0.14em] text-lilac-mist">Paket & kredit</p>
              <h1 className="mt-8 text-heading-lg font-w460 tracking-heading-lg">Kendalikan akses AI Anda.</h1>
              <p className="mt-12 max-w-[58ch] text-body leading-relaxed text-paper-white/75">Pilih paket untuk mengaktifkan AI selama 30 hari, lalu tambah kredit kapan pun dibutuhkan.</p>
            </div>
            {summary ? (
              <div className="grid gap-8 sm:grid-cols-3 lg:grid-cols-1">
                <div className="rounded-small-buttons border border-white/15 bg-white/10 p-14">
                  <p className="text-caption uppercase tracking-[0.12em] text-lilac-mist">Status AI</p>
                  <p className="mt-5 text-label-bold">{summary.canUseAi ? "Aktif" : "Terkunci"}</p>
                </div>
                <div className="rounded-small-buttons border border-white/15 bg-white/10 p-14">
                  <p className="text-caption uppercase tracking-[0.12em] text-lilac-mist">Paket saat ini</p>
                  <p className="mt-5 text-label-bold">{summary.plan}</p>
                  {summary.planEndsAt ? <p className="mt-4 text-caption text-paper-white/70">Berakhir {formatDate(summary.planEndsAt)}</p> : null}
                </div>
                <div className="rounded-small-buttons border border-white/15 bg-white/10 p-14">
                  <p className="text-caption uppercase tracking-[0.12em] text-lilac-mist">Kredit tersedia</p>
                  <p className="mt-5 text-label-bold">{summary.availableCredits} kredit</p>
                  <p className="mt-4 text-caption text-paper-white/70">{summary.topupCredits} top up · {summary.expiringCredits} periodik</p>
                </div>
              </div>
            ) : <p className="text-body-sm leading-relaxed text-paper-white/80">Status kredit belum tersedia. Anda tetap dapat melihat katalog paket di bawah.</p>}
          </div>
          {summary?.scheduledPlan && summary.scheduledStartsAt ? (
            <div className="border-t border-white/15 bg-black/10 px-20 py-12 text-body-sm text-paper-white/80 sm:px-28 lg:px-32">
              Paket {summary.scheduledPlan} dijadwalkan mulai {formatDate(summary.scheduledStartsAt)}.
            </div>
          ) : null}
        </section>

        {offers && hasCatalog ? (
          <>
            {plans.length > 0 ? (
              <section className="mt-36" aria-labelledby="plan-title">
                <div className="max-w-[54rem]">
                  <p className="text-caption font-w540 uppercase tracking-[0.14em] text-royal-violet">Akses 30 hari</p>
                  <h2 id="plan-title" className="mt-6 text-heading-sm font-w460 tracking-heading-sm text-ink-charcoal">Pilih paket yang sesuai ritme kerja Anda.</h2>
                  <p className="mt-8 text-body-sm leading-relaxed text-stone-gray">Premium dan Pro memberi masa akses yang sama; perbedaannya hanya pada jatah kredit AI.</p>
                </div>
                <div className="mt-16 grid gap-16 lg:grid-cols-2">
                  {plans.map((product) => {
                    const isPro = product.plan === "PRO";
                    return (
                      <Card key={product.code} surface={isPro ? "transparent" : "paper"} className={isPro ? "flex flex-col border-deep-lagoon bg-deep-lagoon p-20 text-paper-white sm:p-24" : "flex flex-col p-20 sm:p-24"}>
                        <p className={isPro ? "text-caption font-w540 uppercase tracking-[0.12em] text-lilac-mist" : "text-caption font-w540 uppercase tracking-[0.12em] text-royal-violet"}>{product.plan}</p>
                        <h3 className="mt-6 text-heading-sm font-w460 tracking-heading-sm">{product.name}</h3>
                        <div className={isPro ? "mt-16 border-y border-white/15 py-14" : "mt-16 border-y border-soft-mist py-14"}>
                          <p className="text-heading-sm font-w460 tracking-heading-sm">{formatRupiah(product.amount)}</p>
                          <p className={isPro ? "mt-4 text-body-sm text-paper-white/70" : "mt-4 text-body-sm text-stone-gray"}>untuk 30 hari akses</p>
                        </div>
                        <div className="mt-16 flex-1">
                          <p className={isPro ? "text-label-bold text-paper-white" : "text-label-bold text-ink-charcoal"}>{product.credits} kredit AI</p>
                          <p className={isPro ? "mt-6 text-body-sm leading-relaxed text-paper-white/75" : "mt-6 text-body-sm leading-relaxed text-stone-gray"}>Kredit paket berlaku selama periode paket aktif.</p>
                        </div>
                        <div className="mt-20">
                          <BillingCheckoutButton productCode={product.code} variant={isPro ? "inverse" : "primary"}>Pilih {product.plan}</BillingCheckoutButton>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {topups.length > 0 ? (
              <section className="mt-36" aria-labelledby="topup-title">
                <div className="max-w-[54rem]">
                  <p className="text-caption font-w540 uppercase tracking-[0.14em] text-royal-violet">Kredit tambahan</p>
                  <h2 id="topup-title" className="mt-6 text-heading-sm font-w460 tracking-heading-sm text-ink-charcoal">Top up saat jatah Anda perlu ditambah.</h2>
                  <p className="mt-8 text-body-sm leading-relaxed text-stone-gray">Kredit top up tidak kedaluwarsa, tetapi penggunaan AI tetap membutuhkan paket aktif atau sisa trial.</p>
                </div>
                <div className="mt-16 grid gap-12 sm:grid-cols-2 xl:grid-cols-3">
                  {topups.map((product) => (
                    <Card key={product.code} className="flex flex-col p-20">
                      <p className="text-label-bold text-ink-charcoal">{product.name}</p>
                      <p className="mt-10 text-heading-sm font-w460 tracking-heading-sm text-ink-charcoal">{formatRupiah(product.amount)}</p>
                      <p className="mt-8 flex-1 text-body-sm leading-relaxed text-stone-gray">{product.credits} kredit tambahan · tidak kedaluwarsa.</p>
                      <div className="mt-20"><BillingCheckoutButton productCode={product.code}>Beli kredit</BillingCheckoutButton></div>
                    </Card>
                  ))}
                </div>
              </section>
            ) : null}

            {usage?.length ? (
              <section className="mt-36 border-t border-soft-mist pt-24" aria-labelledby="usage-title">
                <div className="max-w-[54rem]">
                  <p className="text-caption font-w540 uppercase tracking-[0.14em] text-royal-violet">Biaya penggunaan</p>
                  <h2 id="usage-title" className="mt-6 text-heading-sm font-w460 tracking-heading-sm text-ink-charcoal">Tarif aksi AI</h2>
                </div>
                <dl className="mt-16 grid gap-8 sm:grid-cols-2">
                  {usage.map((item) => (
                    <div key={item.usage} className="flex items-center justify-between gap-16 rounded-small-buttons border border-soft-mist bg-paper-white px-14 py-12">
                      <dt className="text-body-sm text-stone-gray">{item.usage === "OPPORTUNITY_HYPOTHESIS" ? "Buat hipotesis" : "Analisis mendalam"}</dt>
                      <dd className="shrink-0 text-body-sm font-w540 tabular-nums text-ink-charcoal">{item.credits} kredit</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}
          </>
        ) : (
          <Card className="mt-36 max-w-[62ch] p-20 sm:p-24">
            <p className="text-label-bold text-ink-charcoal">Katalog pembayaran belum tersedia.</p>
            <p className="mt-8 text-body-sm leading-relaxed text-stone-gray">Coba muat ulang beberapa saat lagi untuk melihat paket dan kredit yang tersedia.</p>
          </Card>
        )}

        <p className="mt-28 max-w-[70ch] text-caption leading-relaxed text-stone-gray">Pembayaran berjalan melalui halaman hosted Duitku sandbox. Setelah pembayaran selesai, status paket dan kredit berubah setelah callback tervalidasi di server.</p>
      </div>
    </BillingSurface>
  );
}
