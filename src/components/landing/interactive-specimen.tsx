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
    keyAdvantage: "Margin produk tinggi (>60%), perputaran stok bahan cepat, cocok untuk sistem booth mikro atau pre-order.",
  },
  beverages_medium: {
    opportunityName: "Artisan Tea & Functional Herb Hub",
    categoryName: "Minuman (Beverages)",
    opportunityScore: 89,
    fitScore: 92,
    riskLevel: "Rendah",
    estimatedCapital: "Rp18.000.000 – Rp25.000.000",
    paybackPeriod: "3.5 – 5.0 Bulan",
    keyAdvantage: "Pangsa pasar loyal kelas urban, repeat order tinggi melalui aplikasi delivery dan langganan mingguan.",
  },
  beverages_high: {
    opportunityName: "Specialty Tea & Beverage Experience Bar",
    categoryName: "Minuman (Beverages)",
    opportunityScore: 91,
    fitScore: 85,
    riskLevel: "Sedang",
    estimatedCapital: "Rp40.000.000 – Rp60.000.000",
    paybackPeriod: "6.0 – 8.0 Bulan",
    keyAdvantage: "Konsep dine-in bernilai tambah dengan potensi kemitraan dan diferensiasi brand yang kuat.",
  },
  snacks_low: {
    opportunityName: "Gourmet Spiced Keripik & Root Chips Stand",
    categoryName: "Camilan (Snacks)",
    opportunityScore: 81,
    fitScore: 86,
    riskLevel: "Rendah",
    estimatedCapital: "Rp6.000.000 – Rp10.000.000",
    paybackPeriod: "2.0 – 3.0 Bulan",
    keyAdvantage: "Masa simpan produk lama, risiko basi minimal, mudah didistribusikan secara online maupun konsinyasi.",
  },
  snacks_medium: {
    opportunityName: "Fresh Baked Artisan Pastry Pod",
    categoryName: "Camilan & Roti",
    opportunityScore: 87,
    fitScore: 89,
    riskLevel: "Sedang",
    estimatedCapital: "Rp20.000.000 – Rp30.000.000",
    paybackPeriod: "4.0 – 5.5 Bulan",
    keyAdvantage: "Daya tarik aroma langsung meningkatkan impuls beli di area perkantoran atau kampus.",
  },
  snacks_high: {
    opportunityName: "Healthy & Gluten-Free Snack Production Lab",
    categoryName: "Camilan Khusus Sehat",
    opportunityScore: 90,
    fitScore: 83,
    riskLevel: "Sedang",
    estimatedCapital: "Rp45.000.000 – Rp70.000.000",
    paybackPeriod: "6.5 – 9.0 Bulan",
    keyAdvantage: "Peluang distribusi supermarket premium dan reseller B2B dengan harga jual per unit tinggi.",
  },
  meals_low: {
    opportunityName: "Cloud Kitchen Comfort Rice Bowl Mini",
    categoryName: "Makanan Utama",
    opportunityScore: 79,
    fitScore: 84,
    riskLevel: "Rendah",
    estimatedCapital: "Rp9.000.000 – Rp14.000.000",
    paybackPeriod: "2.5 – 4.0 Bulan",
    keyAdvantage: "Kebutuhan harian konsumen kantor, volume transaksi harian stabil saat jam makan siang.",
  },
  meals_medium: {
    opportunityName: "High-Protein Clean Meal Prep & Bento",
    categoryName: "Makanan Utama Sehat",
    opportunityScore: 88,
    fitScore: 91,
    riskLevel: "Rendah",
    estimatedCapital: "Rp22.000.000 – Rp32.000.000",
    paybackPeriod: "3.5 – 5.0 Bulan",
    keyAdvantage: "Model langganan katering harian mengunci arus kas di muka (prepaid cash flow).",
  },
  meals_high: {
    opportunityName: "Specialty Noodle & Craft Broth Compact Outlet",
    categoryName: "Makanan Utama",
    opportunityScore: 92,
    fitScore: 84,
    riskLevel: "Sedang",
    estimatedCapital: "Rp50.000.000 – Rp80.000.000",
    paybackPeriod: "7.0 – 10.0 Bulan",
    keyAdvantage: "Skalabilitas tinggi untuk pembukaan cabang kedua setelah resep dan SOP kaldu distandarisasi.",
  },
};

export function InteractiveSpecimen() {
  const [category, setCategory] = useState<CategoryOption>("beverages");
  const [capital, setCapital] = useState<CapitalOption>("medium");
  const categorySelectId = useId();
  const capitalSelectId = useId();

  const currentResult = simulationMatrix[`${category}_${capital}`];

  return (
    <section id="simulasi-skor" className="py-64 lg:py-96 scroll-mt-24">
      <div className="mx-auto max-w-[1200px] px-16 sm:px-24">
        <div className="max-w-[760px]">
          <p className="text-caption font-w540 uppercase tracking-wider text-royal-violet">
            Simulator Cepat Interaktif
          </p>
          <h2 className="mt-12 text-heading-lg font-w460 leading-heading-lg tracking-heading-lg text-ink-charcoal text-balance">
            Uji potensi kecocokan peluang Anda sekarang.
          </h2>
          <p className="mt-16 text-body text-stone-gray text-balance">
            Coba simulasi interaktif di bawah ini untuk melihat bagaimana algoritma VENTUREX memproses keselarasan antara kategori produk dan ketersediaan modal Anda.
          </p>
        </div>

        {/* Interactive Box */}
        <div className="mt-40 grid gap-24 lg:grid-cols-[1fr_1.2fr]">
          {/* Controls Column */}
          <div className="rounded-cards border border-soft-mist bg-paper-white p-24 sm:p-32">
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
              * Ini adalah kalkulasi simulasi interaktif. Saat mendaftar akun, Anda dapat memasukkan data yang lebih detail dan akurat.
            </p>
          </div>

          {/* Result Card Column */}
          <div className="flex flex-col justify-between rounded-cards border border-soft-mist bg-paper-white p-24 sm:p-32">
            <div>
              <div className="flex items-center justify-between border-b border-soft-mist/80 pb-16">
                <div>
                  <span className="text-caption font-w540 uppercase tracking-wider text-royal-violet">
                    Hasil Rekomendasi Simulator
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
                  <span className="text-[11px] text-stone-gray block mt-2">Daya tarik pasar & tren</span>
                </div>

                <div className="rounded-small-buttons bg-lilac-mist/40 p-16 border border-lilac-mist">
                  <span className="text-caption font-w540 text-royal-violet block">Personal Fit Score</span>
                  <div className="mt-4 flex items-baseline gap-4">
                    <span className="text-display font-w460 text-ink-charcoal tabular-nums">
                      {currentResult.fitScore}
                    </span>
                    <span className="text-caption text-stone-gray">/ 100</span>
                  </div>
                  <span className="text-[11px] text-stone-gray block mt-2">Kecocokan modal & profil</span>
                </div>
              </div>

              {/* Detail Metrics */}
              <div className="mt-20 space-y-10 rounded-small-buttons bg-warm-parchment/40 p-16 text-body-sm">
                <div className="flex justify-between">
                  <span className="text-stone-gray">Alokasi Modal Estimasi:</span>
                  <span className="font-w540 text-ink-charcoal">{currentResult.estimatedCapital}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-gray">Proyeksi Balik Modal:</span>
                  <span className="font-w540 text-ink-charcoal">{currentResult.paybackPeriod}</span>
                </div>
                <div className="border-t border-soft-mist/80 pt-8 mt-8">
                  <span className="text-caption font-w540 text-stone-gray block">Keunggulan Strategis:</span>
                  <p className="mt-2 text-caption text-ink-charcoal leading-relaxed">
                    {currentResult.keyAdvantage}
                  </p>
                </div>
              </div>
            </div>

            {/* Direct CTA */}
            <div className="mt-28 pt-20 border-t border-soft-mist">
              <Link
                href="/register"
                className="flex min-h-[48px] w-full items-center justify-center gap-8 rounded-buttons bg-midnight-wine px-20 text-body font-w460 text-paper-white transition-[background-color,transform] hover:bg-midnight-wine/90 active:translate-y-px"
              >
                <span>Buka Detail Analisis & Dapatkan Roadmap Lengkap</span>
                <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
