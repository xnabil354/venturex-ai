import Link from "next/link";

import { formatRupiah } from "@/billing/catalog";
import type { PublicPricingSnapshot } from "@/billing/public-pricing";
import { CheckCircleIcon } from "./icons";

type PricingSectionProps = Readonly<{
  isAuthenticated?: boolean;
  pricing: PublicPricingSnapshot | null;
}>;

export function PricingSection({ isAuthenticated = false, pricing }: PricingSectionProps) {
  const billingHref = isAuthenticated ? "/billing" : "/login";

  if (!pricing) {
    return (
      <section aria-labelledby="pricing-title" className="border-y border-soft-mist bg-paper-white py-24 sm:py-36" id="pricing">
        <div className="mx-auto w-full max-w-[1120px] px-16 sm:px-24">
          <div className="max-w-[42rem]">
            <h2 id="pricing-title" className="text-heading-lg font-w460 tracking-heading-lg text-ink-charcoal">Mulai dari trial, lanjut saat ritme riset Anda terbentuk.</h2>
            <p className="mt-12 text-body leading-relaxed text-stone-gray">Katalog paket sedang diperbarui. Anda tetap dapat membuat akun dan mencoba 5 kredit setelah onboarding.</p>
            <Link className="mt-20 inline-flex min-h-button items-center justify-center rounded-buttons bg-midnight-wine px-20 text-body-sm font-w540 text-paper-white transition-colors hover:bg-midnight-wine/90" href={billingHref}>{isAuthenticated ? "Buka Billing" : "Masuk untuk mulai"}</Link>
          </div>
        </div>
      </section>
    );
  }

  const plans = [
    {
      name: "Coba Gratis Selama 1 Bulan",
      price: "",
      pricePeriod: null,
      features: [
        "5 kredit",
        "Akses Trend Radar dan peluang terkurasi",
        "Fit Score, risiko, dan roadmap validasi",
        "Aksi AI selama kredit trial masih tersedia",
      ],
      action: "Pilih",
      featured: false,
    },
    {
      name: "Premium",
      price: formatRupiah(pricing.premium.amount),
      pricePeriod: "/ 30 hari",
      features: [
        `${pricing.premium.credits} kredit untuk 30 hari`,
        "Akses aksi AI selama paket aktif",
        "Termasuk seluruh fitur inti VENTUREX",
      ],
      action: "Berlangganan",
      featured: true,
    },
    {
      name: "Pro",
      price: formatRupiah(pricing.pro.amount),
      pricePeriod: "/ 30 hari",
      features: [
        `${pricing.pro.credits} kredit untuk 30 hari`,
        "Akses aksi AI selama paket aktif",
        "Fitur inti yang sama dengan jatah kredit lebih besar",
      ],
      action: "Berlangganan",
      featured: false,
    },
  ];

  return (
    <section aria-labelledby="pricing-title" className="border-y border-soft-mist bg-paper-white py-24 sm:py-36" id="pricing">
      <div className="mx-auto w-full max-w-[1120px] px-16 sm:px-24">
        <div className="max-w-[72rem] text-center py-15">
          <h2 id="pricing-title" className="text-heading-sm font-w460 tracking-heading-sm text-ink-charcoal sm:text-heading-lg sm:tracking-heading-lg">Pilihan paket untuk setiap tahap usaha.</h2>
          <p className="mt-12 text-body leading-relaxed text-stone-gray ">Dari eksplorasi awal hingga pengembangan peluang, pilih jatah kredit yang sesuai.</p>
        </div>

        <div className="mt-20 grid gap-16 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <article className={`relative flex min-w-0 flex-col rounded-cards border p-20 sm:p-24 lg:min-h-[22rem] lg:p-32 ${plan.featured ? "border-midnight-wine bg-lilac-mist/35" : "border-soft-mist bg-paper-white"}`} key={plan.name}>
              {plan.featured ? <p className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 rounded-pills bg-midnight-wine px-12 py-4 text-caption font-w540 uppercase tracking-[0.1em] text-paper-white shadow-xs">Popular</p> : null}
              <div>
                <h3 className="text-label-bold font-w540 text-ink-charcoal">{plan.name}</h3>
                <p className="mt-10 text-heading-sm font-w460 tracking-heading-sm text-ink-charcoal">{plan.price}{plan.pricePeriod ? <span className="ml-6 whitespace-nowrap text-body-sm font-w460 tracking-normal text-stone-gray">{plan.pricePeriod}</span> : null}</p>
                <ul className="mt-16 grid gap-8 border-t border-soft-mist/80 pt-14 text-body-sm leading-relaxed text-stone-gray">
                  {plan.features.map((feature) => <li className="flex gap-8" key={feature}><CheckCircleIcon className="mt-2 size-16 shrink-0 text-royal-violet" />{feature}</li>)}
                </ul>
              </div>
              <div className="mt-auto pt-20">
                <Link className={`inline-flex min-h-button w-full items-center justify-center rounded-buttons px-16 text-body-sm font-w540 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet ${plan.featured ? "bg-midnight-wine text-paper-white hover:bg-midnight-wine/90" : "border border-ink-charcoal bg-paper-white text-ink-charcoal hover:bg-lilac-mist/45"}`} href={billingHref}>{plan.action}</Link>
              </div>
            </article>
          ))}
        </div>

        <aside className="mt-16 grid gap-10 border-t border-soft-mist pt-16 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] md:items-start">
          <h3 className="text-body font-w540 text-ink-charcoal">Butuh kredit tambahan nanti?</h3>
          <p className="text-body-sm leading-relaxed text-stone-gray md:text-right">Top up pay-as-you-go tersedia di halaman Billing setelah akun aktif. Kredit top up tidak kedaluwarsa, tetapi aksi AI tetap memerlukan paket aktif atau kredit trial yang tersisa.</p>
        </aside>
      </div>
    </section>
  );
}
