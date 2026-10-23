import Link from "next/link";

import type { RoadmapDetail } from "@/roadmap/domain";
import { Badge, Card, PageContainer } from "@/components/ui";

const rupiah = new Intl.NumberFormat("id-ID");

export function RoadmapDetailView({ roadmap }: { readonly roadmap: RoadmapDetail }) {
  const context = roadmap.generationContext;
  const label = roadmap.roadmapType === "GROWTH" ? "Growth Roadmap" : "Startup Roadmap";

  return (
    <PageContainer>
      <div className="grid gap-24 py-32 sm:py-48 lg:py-64">
        <Link
          className="inline-flex min-h-button w-fit items-center text-body-sm font-w540 text-royal-violet underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-royal-violet"
          href="/roadmaps"
        >
          Kembali ke Roadmap
        </Link>

        <header className="grid max-w-[76ch] gap-12 border-b border-soft-mist pb-24">
          <Badge className="w-fit" tone="wash">{context.method.replaceAll("_", " ")}</Badge>
          <h1 className="text-heading-lg font-w460 text-ink-charcoal sm:text-display">{label}</h1>
          <p className="text-body text-ink-charcoal">
            Opportunity: <Link className="text-royal-violet underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-royal-violet" href={`/opportunities/${roadmap.opportunity.id}`}>{roadmap.opportunity.name}</Link>
          </p>
          <p className="max-w-[76ch] text-body-sm leading-body-sm text-stone-gray">
            Roadmap ini berisi langkah awal, bukan prediksi.
          </p>
        </header>

        {/* Stepper Timeline Stages */}
        <div className="grid gap-16">
          <div className="border-b border-soft-mist pb-12">
            <h2 className="text-heading-sm font-w460 text-ink-charcoal">
              Tahapan Eksekusi Bertahap
            </h2>
          </div>

          <ol className="relative grid gap-16">
            {roadmap.steps.map((step) => (
              <li key={step.id}>
                <Card className="grid gap-16 p-20 sm:p-28 transition-all duration-300 border-[#ded8cb] bg-[#faf9f6] hover:border-midnight-wine/40 hover:shadow-md">
                  <div className="flex flex-wrap items-baseline justify-between gap-8 border-b border-soft-mist pb-12">
                    <div className="flex items-center gap-10">
                      <span className="flex size-28 items-center justify-center rounded-full border border-midnight-wine bg-midnight-wine text-caption font-w540 text-paper-white shadow-xs">
                        {step.sequence}
                      </span>
                      <h2 className="text-label-bold font-w540 text-ink-charcoal">
                        <span className="mr-8 text-stone-gray">{step.sequence}.</span>
                        {step.stage}
                      </h2>
                    </div>
                    <Badge tone="wash">{step.timeline}</Badge>
                  </div>
                  <div className="grid gap-12 sm:grid-cols-3">
                    <div className="grid gap-4 rounded-small-buttons bg-warm-parchment p-14 border border-[#ded8cb] transition-colors hover:border-midnight-wine/30 sm:col-span-1">
                      <h3 className="text-caption font-w540 uppercase tracking-wider text-midnight-wine">Tindakan</h3>
                      <p className="text-body-sm font-w540 leading-relaxed text-ink-charcoal">{step.action}</p>
                    </div>
                    <div className="grid gap-4 rounded-small-buttons bg-warm-parchment p-14 border border-[#ded8cb] transition-colors hover:border-midnight-wine/30 sm:col-span-1">
                      <h3 className="text-caption font-w540 uppercase tracking-wider text-stone-gray">Tujuan</h3>
                      <p className="text-body-sm leading-relaxed text-stone-gray">{step.objective}</p>
                    </div>
                    <div className="grid gap-4 rounded-small-buttons bg-warm-parchment p-14 border border-[#ded8cb] transition-colors hover:border-midnight-wine/30 sm:col-span-1">
                      <h3 className="text-caption font-w540 uppercase tracking-wider text-stone-gray">Hasil yang diharapkan</h3>
                      <p className="text-body-sm leading-relaxed text-stone-gray">{step.expectedOutput}</p>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        </div>

        {/* Context & Limitations Panel */}
        <Card className="grid max-w-[76ch] gap-16 p-20 sm:p-28 border-[#ded8cb] bg-[#faf9f6]">
          <div className="flex items-center gap-8 border-b border-soft-mist pb-12">
            <h2 className="text-label-bold text-ink-charcoal">Konteks dan keterbatasan</h2>
          </div>
          <RoadmapProfileSnapshot roadmap={roadmap} />
          <p className="text-body-sm text-stone-gray">Mode konteks: {context.contextMode === "LIMITED_CONTEXT" ? "Terbatas" : "Lengkap"}</p>
          {context.unavailableInputs.length > 0 ? (
            <p className="text-body-sm text-stone-gray">Belum tersedia: {context.unavailableInputs.join(", ")}.</p>
          ) : (
            <p className="text-body-sm text-stone-gray">Score dan Risk tercatat tersedia sebagai konteks tambahan, bukan prediksi.</p>
          )}
          <p className="text-body-sm text-stone-gray">
            Sinyal tersimpan — Opportunity Score: {context.availableSignals.opportunityScore ?? "Tidak tersedia"}; Fit Score: {context.availableSignals.fitScore ?? "Tidak tersedia"}; Risk: {context.availableSignals.riskLevel ?? "Tidak tersedia"}.
          </p>
          <div className="grid gap-6 border-t border-soft-mist pt-12">
            <h3 className="text-body-sm font-w540 text-ink-charcoal">Asumsi</h3>
            <ul className="grid gap-4 list-disc pl-20 text-stone-gray">
              {context.assumptions.map((item) => <li className="text-body-sm leading-body-sm" key={item}>{item}</li>)}
            </ul>
          </div>
          <div className="grid gap-6 border-t border-soft-mist pt-12">
            <h3 className="text-body-sm font-w540 text-ink-charcoal">Batasan</h3>
            <ul className="grid gap-4 list-disc pl-20 text-stone-gray">
              {context.limitations.map((item) => <li className="text-body-sm leading-body-sm" key={item}>{item}</li>)}
            </ul>
          </div>
          {context.evidence.length > 0 ? (
            <div className="grid gap-6 border-t border-soft-mist pt-12">
              <h3 className="text-body-sm font-w540 text-ink-charcoal">Sumber yang tercatat</h3>
              <ul className="grid gap-4 list-disc pl-20 text-stone-gray">
                {context.evidence.map((item) => <li className="text-body-sm leading-body-sm" key={item.id}>{item.sourceName}{item.sourceReference ? ` — ${item.sourceReference}` : ""}</li>)}
              </ul>
              <p className="text-caption text-stone-gray">Pencatatan sumber tidak berarti sumber telah diverifikasi.</p>
            </div>
          ) : null}
        </Card>
      </div>
    </PageContainer>
  );
}

function RoadmapProfileSnapshot({ roadmap }: { readonly roadmap: RoadmapDetail }) {
  if (roadmap.roadmapType === "GROWTH") {
    const profile = roadmap.generationContext.profileInputs;
    return (
      <div className="grid gap-6 rounded-small-buttons bg-warm-parchment p-14 border border-[#ded8cb]">
        <p className="text-body-sm text-stone-gray">Profil bisnis yang digunakan: {profile.businessName}; {profile.businessCategory}; {profile.location}.</p>
        <p className="text-body-sm text-stone-gray">Rentang harga rata-rata pada profil: Rp {rupiah.format(profile.averagePriceRange.min)}–Rp {rupiah.format(profile.averagePriceRange.max)}. Rentang ini bukan biaya atau hasil margin.</p>
        <p className="text-body-sm text-stone-gray">Produk aktif: {profile.products.map((product) => `${product.name}${product.listedPrice === null ? " (harga tidak dicantumkan)" : ` (harga tercatat Rp ${rupiah.format(product.listedPrice)})`}`).join(", ")}.</p>
        <p className="text-body-sm text-stone-gray">Segmen pelanggan: {profile.customerSegments.join(", ")}; channel: {profile.salesChannels.join(", ")}.</p>
        {profile.businessDescription ? <p className="text-body-sm text-stone-gray">Deskripsi bisnis: {profile.businessDescription}</p> : null}
      </div>
    );
  }

  const profile = roadmap.generationContext.profileInputs;
  return (
    <div className="grid gap-6 rounded-small-buttons bg-warm-parchment p-14 border border-[#ded8cb]">
      <p className="text-body-sm text-stone-gray">Profil yang digunakan: {profile.location}; {profile.experienceLevel}; {profile.timeCommitment}; anggaran profil Rp {rupiah.format(profile.budgetRange.min)}–Rp {rupiah.format(profile.budgetRange.max)}.</p>
      <p className="text-body-sm text-stone-gray">Segmen: {profile.customerSegments.join(", ")}; channel: {profile.salesChannels.join(", ")}; minat: {profile.interests.join(", ")}.</p>
    </div>
  );
}
