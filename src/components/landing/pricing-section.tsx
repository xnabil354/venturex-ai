import Link from "next/link";

const plans = [
  { label: "Free trial", price: "Rp0", credits: "5 kredit sekali setelah onboarding", note: "Akses AI selama kredit trial tersedia." },
  { label: "Premium", price: "Rp84.000", credits: "25 kredit · 30 hari", note: "Untuk ritme eksplorasi yang konsisten." },
  { label: "Pro", price: "Rp146.000", credits: "50 kredit · 30 hari", note: "Jatah kredit lebih besar, tanpa fitur eksklusif tambahan." },
];

export function PricingSection() {
  return <section className="border-y border-soft-mist bg-paper-white py-64 sm:py-88"><div className="mx-auto w-full max-w-content px-16 sm:px-24"><div className="max-w-[42rem]"><p className="text-caption font-w540 uppercase tracking-[0.14em] text-royal-violet">Harga yang dapat diprediksi</p><h2 className="mt-10 text-heading-lg font-w460 tracking-heading-lg text-ink-charcoal">Bayar untuk kredit, bukan janji samar.</h2><p className="mt-12 text-body leading-relaxed text-stone-gray">Setiap insight Trend memakai 1 kredit, hipotesis peluang 2 kredit, dan analisis detail 3 kredit.</p></div><div className="mt-28 grid gap-16 lg:grid-cols-3">{plans.map((plan, index) => <article className={`flex min-h-[17rem] flex-col rounded-cards border p-20 ${index === 1 ? "border-midnight-wine bg-lilac-mist/25" : "border-soft-mist bg-warm-parchment/40"}`} key={plan.label}><p className="text-caption font-w540 uppercase tracking-[0.12em] text-royal-violet">{plan.label}</p><p className="mt-10 text-heading-sm font-w460 tracking-heading-sm">{plan.price}</p><p className="mt-12 text-body-sm font-w540 text-ink-charcoal">{plan.credits}</p><p className="mt-8 flex-1 text-body-sm leading-relaxed text-stone-gray">{plan.note}</p></article>)}</div><div className="mt-20 flex flex-wrap items-center justify-between gap-12 border-t border-soft-mist pt-18"><p className="text-caption leading-relaxed text-stone-gray">Top up: 10 kredit Rp20.000 · 30 kredit Rp50.000 · 100 kredit Rp150.000. Tidak ada auto-debit.</p><Link className="inline-flex min-h-button items-center rounded-buttons bg-midnight-wine px-16 text-body-sm font-w540 text-paper-white" href="/register">Mulai dengan trial</Link></div></div></section>;
}
