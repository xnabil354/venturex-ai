import Link from "next/link";

import type { RoadmapDetail } from "@/roadmap/domain";
import { Card } from "@/components/ui";
import { RoadmapSurface } from "./roadmap-surface";

const rupiah = new Intl.NumberFormat("id-ID");

export function RoadmapDetailView({ roadmap }: { readonly roadmap: RoadmapDetail }) {
  const context = roadmap.generationContext;
  const label = roadmap.roadmapType === "GROWTH" ? "Growth Roadmap" : "Startup Roadmap";

  return (
    <RoadmapSurface>
      <div className="grid gap-24 py-24 sm:gap-32 sm:py-48 lg:py-64">
        <Link className="inline-flex min-h-button w-fit items-center text-body-sm font-w540 text-royal-violet underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-royal-violet" href="/roadmaps">Kembali ke roadmap</Link>

        <header className="grid max-w-[76ch] gap-12 rounded-cards bg-midnight-wine p-20 text-paper-white sm:p-28">
          <h1 className="text-heading-sm font-w460 sm:text-heading-lg">{label}</h1>
          <p className="text-body leading-relaxed text-paper-white">
            Peluang: <Link className="text-lilac-mist underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-paper-white" href={`/opportunities/${roadmap.opportunity.id}`}>{roadmap.opportunity.name}</Link>
          </p>
          <p className="max-w-[66ch] text-body-sm leading-relaxed text-paper-white/80">Roadmap ini berisi langkah awal berdasarkan konteks tersimpan, bukan prediksi atau jaminan hasil.</p>
        </header>

        <section className="grid gap-16" aria-labelledby="roadmap-steps-title">
          <div className="grid gap-6 border-b border-soft-mist pb-12">
            <h2 id="roadmap-steps-title" className="text-heading-sm font-w460">Tahapan pelaksanaan</h2>
            <p className="text-body-sm leading-relaxed text-stone-gray">Kerjakan satu tahap, catat hasilnya, lalu gunakan pembelajaran tersebut untuk menentukan langkah berikutnya.</p>
          </div>
          <ol className="grid gap-12 sm:gap-16">
            {roadmap.steps.map((step) => (
              <li key={step.id}>
                <Card className="grid gap-16 p-16 transition-colors duration-200 hover:border-royal-violet/40 sm:p-20 md:p-24">
                  <div className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-x-10 gap-y-4 border-b border-soft-mist pb-12 sm:grid-cols-[28px_minmax(0,1fr)_auto]">
                    <span className="flex size-28 shrink-0 items-center justify-center rounded-full bg-midnight-wine text-caption font-w540 text-paper-white">{step.sequence}</span>
                    <h3 className="min-w-0 flex-1 text-label-bold font-w540">{step.stage}</h3>
                    <p className="col-start-2 min-w-0 wrap-anywhere text-caption font-w540 text-royal-violet sm:col-start-3 sm:text-right">{step.timeline}</p>
                  </div>
                  <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
                    <div className="grid gap-4 rounded-small-buttons bg-lilac-mist/35 p-14 md:col-span-2 lg:col-span-1">
                      <h4 className="text-caption font-w540 text-midnight-wine">Tindakan</h4>
                      <p className="wrap-anywhere text-body-sm font-w540 leading-relaxed">{step.action}</p>
                    </div>
                    <div className="grid gap-4 rounded-small-buttons bg-warm-parchment p-14">
                      <h4 className="text-caption font-w540 text-ink-charcoal">Tujuan</h4>
                      <p className="wrap-anywhere text-body-sm leading-relaxed text-stone-gray">{step.objective}</p>
                    </div>
                    <div className="grid gap-4 rounded-small-buttons bg-warm-parchment p-14">
                      <h4 className="text-caption font-w540 text-ink-charcoal">Hasil yang diharapkan</h4>
                      <p className="wrap-anywhere text-body-sm leading-relaxed text-stone-gray">{step.expectedOutput}</p>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <Card className="grid max-w-[76ch] gap-16 p-16 sm:p-20 md:p-24">
          <div className="border-b border-soft-mist pb-12">
            <h2 className="text-label-bold font-w540">Konteks dan keterbatasan</h2>
          </div>
          <RoadmapProfileSnapshot roadmap={roadmap} />
          <div className="grid gap-6 text-body-sm leading-relaxed text-stone-gray">
            <p>Mode konteks: {context.contextMode === "LIMITED_CONTEXT" ? "Terbatas" : "Lengkap"}</p>
            <p>{context.unavailableInputs.length > 0 ? `Belum tersedia: ${context.unavailableInputs.join(", ")}.` : "Score dan Risk tercatat tersedia sebagai konteks tambahan, bukan prediksi."}</p>
            <p>Sinyal tersimpan — Opportunity Score: {context.availableSignals.opportunityScore ?? "Tidak tersedia"}; Fit Score: {context.availableSignals.fitScore ?? "Tidak tersedia"}; Risk: {context.availableSignals.riskLevel ?? "Tidak tersedia"}.</p>
          </div>
          <RoadmapContextList title="Asumsi" items={context.assumptions} />
          <RoadmapContextList title="Batasan" items={context.limitations} />
          {context.evidence.length > 0 ? <div className="grid gap-6 border-t border-soft-mist pt-12"><h3 className="text-body-sm font-w540">Sumber yang tercatat</h3><ul className="grid list-disc gap-4 pl-20 text-body-sm leading-relaxed text-stone-gray">{context.evidence.map((item) => <li key={item.id}>{item.sourceName}{item.sourceReference ? ` — ${item.sourceReference}` : ""}</li>)}</ul><p className="text-caption text-stone-gray">Pencatatan sumber tidak berarti sumber telah diverifikasi.</p></div> : null}
        </Card>
      </div>
    </RoadmapSurface>
  );
}

function RoadmapContextList({ title, items }: { readonly title: string; readonly items: readonly string[] }) {
  return <div className="grid gap-6 border-t border-soft-mist pt-12"><h3 className="text-body-sm font-w540">{title}</h3><ul className="grid list-disc gap-4 pl-20 text-body-sm leading-relaxed text-stone-gray">{items.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}

function RoadmapProfileSnapshot({ roadmap }: { readonly roadmap: RoadmapDetail }) {
  if (roadmap.roadmapType === "GROWTH") {
    const profile = roadmap.generationContext.profileInputs;
    return <div className="grid gap-6 rounded-small-buttons bg-warm-parchment p-14 text-body-sm leading-relaxed text-stone-gray"><p>Profil bisnis yang digunakan: {profile.businessName}; {profile.businessCategory}; {profile.location}.</p><p>Rentang harga rata-rata pada profil: Rp {rupiah.format(profile.averagePriceRange.min)}–Rp {rupiah.format(profile.averagePriceRange.max)}. Rentang ini bukan biaya atau hasil margin.</p><p>Produk aktif: {profile.products.map((product) => `${product.name}${product.listedPrice === null ? " (harga tidak dicantumkan)" : ` (harga tercatat Rp ${rupiah.format(product.listedPrice)})`}`).join(", ")}.</p><p>Segmen pelanggan: {profile.customerSegments.join(", ")}; channel: {profile.salesChannels.join(", ")}.</p>{profile.businessDescription ? <p>Deskripsi bisnis: {profile.businessDescription}</p> : null}</div>;
  }

  const profile = roadmap.generationContext.profileInputs;
  return <div className="grid gap-6 rounded-small-buttons bg-warm-parchment p-14 text-body-sm leading-relaxed text-stone-gray"><p>Profil yang digunakan: {profile.location}; {profile.experienceLevel}; {profile.timeCommitment}; anggaran profil Rp {rupiah.format(profile.budgetRange.min)}–Rp {rupiah.format(profile.budgetRange.max)}.</p><p>Segmen: {profile.customerSegments.join(", ")}; channel: {profile.salesChannels.join(", ")}; minat: {profile.interests.join(", ")}.</p></div>;
}
