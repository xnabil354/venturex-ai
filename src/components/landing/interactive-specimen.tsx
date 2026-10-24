"use client";

import Link from "next/link";
import { useId, useState } from "react";

type CategoryOption = "beverages" | "snacks" | "meals";
type CapitalOption = "low" | "medium" | "high";

type SimulationResult = {
  opportunityName: string;
  categoryName: string;
  opportunityScore: number;
  fitScore: number;
  riskLevel: "Rendah" | "Sedang";
  estimatedCapital: string;
  paybackPeriod: string;
  keyAdvantage: string;
};

const simulationMatrix: Record<`${CategoryOption}_${CapitalOption}`, SimulationResult> = {
  beverages_low: {
    opportunityName: "Micro Botanical Cold-Whisk Bar",
    categoryName: "Minuman (Beverages)",
    opportunityScore: 84,
    fitScore: 88,
    riskLevel: "Rendah",
    estimatedCapital: "Rp8.000.000 – Rp12.000.000",
    paybackPeriod: "2.5 – 3.5 Bulan",
    keyAdvantage: "Format booth dan pre-order untuk menggambarkan skenario modal mikro.",
  },
  beverages_medium: {
    opportunityName: "Artisan Tea & Functional Herb Hub",
    categoryName: "Minuman (Beverages)",
    opportunityScore: 89,
    fitScore: 92,
    riskLevel: "Rendah",
    estimatedCapital: "Rp18.000.000 – Rp25.000.000",
    paybackPeriod: "3.5 – 5.0 Bulan",
    keyAdvantage: "Contoh peluang minuman dengan skenario modal menengah.",
  },
  beverages_high: {
    opportunityName: "Specialty Tea & Beverage Experience Bar",
    categoryName: "Minuman (Beverages)",
    opportunityScore: 91,
    fitScore: 85,
    riskLevel: "Sedang",
    estimatedCapital: "Rp40.000.000 – Rp60.000.000",
    paybackPeriod: "6.0 – 8.0 Bulan",
    keyAdvantage: "Contoh peluang minuman dengan skenario modal ekspansi.",
  },
  snacks_low: {
    opportunityName: "Gourmet Spiced Keripik & Root Chips Stand",
    categoryName: "Camilan (Snacks)",
    opportunityScore: 81,
    fitScore: 86,
    riskLevel: "Rendah",
    estimatedCapital: "Rp6.000.000 – Rp10.000.000",
    paybackPeriod: "2.0 – 3.0 Bulan",
    keyAdvantage: "Contoh peluang camilan untuk skenario modal mikro.",
  },
  snacks_medium: {
    opportunityName: "Fresh Baked Artisan Pastry Pod",
    categoryName: "Camilan & Roti",
    opportunityScore: 87,
    fitScore: 89,
    riskLevel: "Sedang",
    estimatedCapital: "Rp20.000.000 – Rp30.000.000",
    paybackPeriod: "4.0 – 5.5 Bulan",
    keyAdvantage: "Contoh peluang camilan untuk skenario modal menengah.",
  },
  snacks_high: {
    opportunityName: "Healthy & Gluten-Free Snack Production Lab",
    categoryName: "Camilan Khusus Sehat",
    opportunityScore: 90,
    fitScore: 83,
    riskLevel: "Sedang",
    estimatedCapital: "Rp45.000.000 – Rp70.000.000",
    paybackPeriod: "6.5 – 9.0 Bulan",
    keyAdvantage: "Contoh peluang camilan untuk skenario modal ekspansi.",
  },
  meals_low: {
    opportunityName: "Cloud Kitchen Comfort Rice Bowl Mini",
    categoryName: "Makanan Utama",
    opportunityScore: 79,
    fitScore: 84,
    riskLevel: "Rendah",
    estimatedCapital: "Rp9.000.000 – Rp14.000.000",
    paybackPeriod: "2.5 – 4.0 Bulan",
    keyAdvantage: "Contoh peluang makanan utama untuk skenario modal mikro.",
  },
  meals_medium: {
    opportunityName: "High-Protein Clean Meal Prep & Bento",
    categoryName: "Makanan Utama Sehat",
    opportunityScore: 88,
    fitScore: 91,
    riskLevel: "Rendah",
    estimatedCapital: "Rp22.000.000 – Rp32.000.000",
    paybackPeriod: "3.5 – 5.0 Bulan",
    keyAdvantage: "Contoh peluang makanan utama untuk skenario modal menengah.",
  },
  meals_high: {
    opportunityName: "Specialty Noodle & Craft Broth Compact Outlet",
    categoryName: "Makanan Utama",
    opportunityScore: 92,
    fitScore: 84,
    riskLevel: "Sedang",
    estimatedCapital: "Rp50.000.000 – Rp80.000.000",
    paybackPeriod: "7.0 – 10.0 Bulan",
    keyAdvantage: "Contoh peluang makanan utama untuk skenario modal ekspansi.",
  },
};

export function InteractiveSpecimen() {
  const [category, setCategory] = useState<CategoryOption>("beverages");
  const [capital, setCapital] = useState<CapitalOption>("medium");
  const categorySelectId = useId();
  const capitalSelectId = useId();

  const currentResult = simulationMatrix[`${category}_${capital}`];

  return (
    <section id="simulasi-skor" className="scroll-mt-24 py-48 sm:py-64 lg:py-96">
      <div className="mx-auto max-w-[1200px] px-16 sm:px-24">
        <div className="max-w-[760px]">
          <p className="text-caption font-w540 uppercase tracking-wider text-royal-violet">
            Simulator Cepat Interaktif
          </p>
          <h2 className="mt-12 text-heading-sm font-w460 leading-heading-sm tracking-heading-sm text-ink-charcoal sm:text-heading-lg sm:leading-heading-lg sm:tracking-heading-lg text-balance">
            Lihat bentuk informasi yang akan Anda telaah.
          </h2>
          <p className="mt-16 text-body text-stone-gray text-balance">
            Pilih kategori dan modal untuk melihat contoh cara VENTUREX menyajikan peluang, skor, risiko, dan kebutuhan modal. Semua nilai pada area ini adalah data dummy.
          </p>
        </div>

        {/* Interactive Box */}
        <div className="mt-32 grid gap-16 sm:mt-40 sm:gap-24 md:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          {/* Controls Column */}
          <div className="rounded-cards border border-soft-mist bg-paper-white p-20 sm:p-24 lg:p-32">
            <h3 className="text-label-bold font-w540 text-ink-charcoal">
              Parameter Eksplorasi
            </h3>
            <p className="mt-4 text-caption text-stone-gray">
              Pilih preferensi bidang usaha dan alokasi modal awal Anda:
            </p>

            {/* Category Select */}
            <div className="mt-24">
              <label htmlFor={categorySelectId} className="block text-body-sm font-w540 text-ink-charcoal">
                1. Kategori Minat F&B
              </label>
              <div className="mt-8 grid grid-cols-3 gap-8">
                {(
                  [
                    ["beverages", "Minuman"],
                    ["snacks", "Camilan"],
                    ["meals", "Makanan"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={category === value}
                    onClick={() => setCategory(value)}
                    className={`inline-flex min-h-[44px] items-center justify-center rounded-small-buttons border px-12 py-10 text-body-sm transition-colors focus-visible:outline-2 focus-visible:outline-royal-violet focus-visible:outline-offset-2 cursor-pointer ${
                      category === value
                        ? "border-midnight-wine bg-midnight-wine text-paper-white font-w540"
                        : "border-soft-mist bg-warm-parchment/60 text-ink-charcoal hover:bg-paper-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <select
                id={categorySelectId}
                aria-label="Kategori Minat F&B"
                className="sr-only"
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryOption)}
              >
                <option value="beverages">Minuman</option>
                <option value="snacks">Camilan</option>
                <option value="meals">Makanan Utama</option>
              </select>
            </div>

            {/* Capital Select */}
            <div className="mt-24">
              <label htmlFor={capitalSelectId} className="block text-body-sm font-w540 text-ink-charcoal">
                2. Estimasi Modal Tersedia
              </label>
              <div className="mt-8 space-y-8">
                {(
                  [
                    ["low", "Mikro: Rp5 – 15 Juta", "Format booth, gerobak modern, atau pre-order"],
                    ["medium", "Menengah: Rp15 – 35 Juta", "Format mini-outlet, delivery hub, cloud kitchen"],
                    ["high", "Ekspansi: > Rp35 Juta", "Format compact dine-in outlet atau lini produk baru"],
                  ] as const
                ).map(([value, title, desc]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={capital === value}
                    onClick={() => setCapital(value)}
                    className={`w-full min-h-[44px] rounded-small-buttons border p-12 text-left transition-colors focus-visible:outline-2 focus-visible:outline-royal-violet focus-visible:outline-offset-2 cursor-pointer ${
                      capital === value
                        ? "border-midnight-wine bg-midnight-wine/5 ring-1 ring-midnight-wine"
                        : "border-soft-mist bg-warm-parchment/40 hover:bg-paper-white"
                    }`}
                  >
                    <span className="block text-body-sm font-w540 text-ink-charcoal">{title}</span>
                    <span className="block text-caption text-stone-gray">{desc}</span>
                  </button>
                ))}
              </div>
              <select
                id={capitalSelectId}
                aria-label="Estimasi Modal Tersedia"
                className="sr-only"
                value={capital}
                onChange={(e) => setCapital(e.target.value as CapitalOption)}
              >
                <option value="low">Mikro (Rp5-15 Jt)</option>
                <option value="medium">Menengah (Rp15-35 Jt)</option>
                <option value="high">Ekspansi (&gt;Rp35 Jt)</option>
              </select>
            </div>

            <p className="mt-24 text-[12px] text-stone-gray border-t border-soft-mist pt-12">
              Data dummy untuk demonstrasi. Hasil analisis akun menggunakan profil dan data yang tersedia; skor bukan jaminan keberhasilan bisnis.
            </p>
          </div>

          {/* Result Card Column */}
          <div className="flex min-w-0 flex-col justify-between rounded-cards border border-soft-mist bg-paper-white p-20 sm:p-24 lg:p-32">
            <div>
              <div className="flex flex-col items-start gap-12 border-b border-soft-mist/80 pb-16 sm:flex-row sm:justify-between">
                <div>
                  <span className="text-caption font-w540 uppercase tracking-wider text-royal-violet">
                    Hasil simulasi · data dummy
                  </span>
                  <h3 className="mt-4 text-heading-sm font-w460 tracking-heading-sm text-ink-charcoal">
                    {currentResult.opportunityName}
                  </h3>
                  <span className="text-caption text-stone-gray">{currentResult.categoryName}</span>
                </div>
                <span className="rounded-pills border border-emerald-300 bg-emerald-50 px-10 py-4 text-caption font-w540 text-emerald-900">
                  Risiko: {currentResult.riskLevel}
                </span>
              </div>

              {/* Score Badges */}
              <div className="mt-20 grid grid-cols-2 gap-12">
                <div className="rounded-small-buttons bg-warm-parchment/60 p-16 border border-soft-mist/70">
                  <span className="text-caption text-stone-gray block">Opportunity Score</span>
                  <div className="mt-4 flex items-baseline gap-4">
                    <span className="text-display font-w460 text-ink-charcoal tabular-nums">
                      {currentResult.opportunityScore}
                    </span>
                    <span className="text-caption text-stone-gray">/ 100</span>
                  </div>
                  <span className="text-[11px] text-stone-gray block mt-2">Contoh daya tarik pasar & tren</span>
                </div>

                <div className="rounded-small-buttons bg-lilac-mist/40 p-16 border border-lilac-mist">
                  <span className="text-caption font-w540 text-royal-violet block">Personal Fit Score</span>
                  <div className="mt-4 flex items-baseline gap-4">
                    <span className="text-display font-w460 text-ink-charcoal tabular-nums">
                      {currentResult.fitScore}
                    </span>
                    <span className="text-caption text-stone-gray">/ 100</span>
                  </div>
                  <span className="text-[11px] text-stone-gray block mt-2">Contoh kecocokan modal & profil</span>
                </div>
              </div>

              {/* Detail Metrics */}
              <div className="mt-20 space-y-10 rounded-small-buttons bg-warm-parchment/40 p-16 text-body-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <span className="text-stone-gray">Alokasi modal (dummy):</span>
                  <span className="font-w540 text-ink-charcoal">{currentResult.estimatedCapital}</span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <span className="text-stone-gray">Balik modal (dummy):</span>
                  <span className="font-w540 text-ink-charcoal">{currentResult.paybackPeriod}</span>
                </div>
                <div className="border-t border-soft-mist/80 pt-8 mt-8">
                  <span className="text-caption font-w540 text-stone-gray block">Catatan simulasi:</span>
                  <p className="mt-2 text-caption text-ink-charcoal leading-relaxed">
                    {currentResult.keyAdvantage} Nilai aktual akan bergantung pada profil, bukti, dan data yang tersedia.
                  </p>
                </div>
              </div>
            </div>

            {/* Direct CTA */}

          </div>
        </div>
      </div>
    </section>
  );
}
