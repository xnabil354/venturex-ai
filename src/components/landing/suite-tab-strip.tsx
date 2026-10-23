"use client";

import Link from "next/link";
import { useState } from "react";
import { cx } from "@/lib/cx";

export function SuiteTabStrip() {
  const [activeTab, setActiveTab] = useState<"entrepreneur" | "umkm">("entrepreneur");

  return (
    <section id="alur-solusi" className="py-64 lg:py-96 scroll-mt-24">
      <div className="mx-auto max-w-[1200px] px-16 sm:px-24">
        {/* Section Heading */}
        <div className="max-w-[760px]">
          <p className="text-caption font-w540 uppercase tracking-wider text-royal-violet">
            Dua Jalur Solusi Terarah
          </p>
          <h2 className="mt-12 text-heading-lg font-w460 leading-heading-lg tracking-heading-lg text-ink-charcoal text-balance">
            Dirancang khusus untuk tahap bisnis Anda saat ini.
          </h2>
          <p className="mt-16 text-body text-stone-gray text-balance">
            Apakah Anda baru ingin melangkah atau sudah memiliki gerai yang berjalan,
            VENTUREX menyesuaikan algoritma evaluasi dengan konteks spesifik Anda.
          </p>
        </div>

        {/* Suite Tab Bar */}
        <div className="mt-32">
          <div
            role="tablist"
            aria-label="Pilih Profil Pengguna"
            className="grid grid-cols-1 sm:grid-cols-2 rounded-tabs border border-soft-mist bg-paper-white p-4 shadow-none"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "entrepreneur"}
              id="tab-entrepreneur"
              aria-controls="panel-entrepreneur"
              onClick={() => setActiveTab("entrepreneur")}
              className={cx(
                "flex items-center justify-center gap-12 rounded-[6px] px-24 py-16 text-left transition-[background-color,color] duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-royal-violet focus-visible:outline-offset-2",
                activeTab === "entrepreneur"
                  ? "bg-lilac-mist text-ink-charcoal font-w540"
                  : "bg-paper-white text-stone-gray hover:text-ink-charcoal font-w460"
              )}
            >
              <span className="flex h-24 w-24 items-center justify-center rounded-full border border-ink-charcoal text-[12px]">
                A
              </span>
              <div>
                <span className="block text-body-sm font-w540">Calon Pengusaha F&B</span>
                <span className="block text-caption text-stone-gray">Discover &rarr; Analyze &rarr; Start</span>
              </div>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "umkm"}
              id="tab-umkm"
              aria-controls="panel-umkm"
              onClick={() => setActiveTab("umkm")}
              className={cx(
                "flex items-center justify-center gap-12 rounded-[6px] px-24 py-16 text-left transition-[background-color,color] duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-royal-violet focus-visible:outline-offset-2",
                activeTab === "umkm"
                  ? "bg-lilac-mist text-ink-charcoal font-w540"
                  : "bg-paper-white text-stone-gray hover:text-ink-charcoal font-w460"
              )}
            >
              <span className="flex h-24 w-24 items-center justify-center rounded-full border border-ink-charcoal text-[12px]">
                B
              </span>
              <div>
                <span className="block text-body-sm font-w540">UMKM F&B Existing</span>
                <span className="block text-caption text-stone-gray">Discover &rarr; Analyze &rarr; Grow</span>
              </div>
            </button>
          </div>
        </div>

        {/* Tab Panels */}
        <div className="mt-24">
          {activeTab === "entrepreneur" ? (
            <div
              id="panel-entrepreneur"
              role="tabpanel"
              aria-labelledby="tab-entrepreneur"
              className="rounded-cards border border-soft-mist bg-paper-white p-24 sm:p-40"
            >
              <div className="grid gap-40 lg:grid-cols-2 lg:items-center">
                <div>
                  <span className="inline-flex rounded-pills bg-warm-parchment px-12 py-4 text-caption font-w540 text-royal-violet">
                    Jalur A &middot; Memulai dari Nol
                  </span>
                  <h3 className="mt-16 text-heading-sm font-w460 tracking-heading-sm text-ink-charcoal">
                    Validasi ide usaha sebelum modal tabungan Anda terpakai.
                  </h3>
                  <p className="mt-16 text-body text-stone-gray leading-body">
                    Banyak calon pengusaha tergiur tren viral dan kehilangan modal karena tidak memperhitungkan kesiapan modal operasional, target konsumen, dan risiko nyata.
                  </p>

                  <ul className="mt-24 space-y-16 text-body-sm text-ink-charcoal">
                    <li className="flex items-start gap-12">
                      <span className="mt-2 flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-lilac-mist text-ink-charcoal text-[12px] font-bold">1</span>
                      <div>
                        <strong className="font-w540">Input Profil Mandiri:</strong> Tentukan modal yang Anda miliki (misal Rp5-20 Juta), minat kategori, lokasi kota, dan estimasi waktu operasional.
                      </div>
                    </li>
                    <li className="flex items-start gap-12">
                      <span className="mt-2 flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-lilac-mist text-ink-charcoal text-[12px] font-bold">2</span>
                      <div>
                        <strong className="font-w540">Pencocokan Personal Fit Score:</strong> Algoritma mengevaluasi apakah peluang cocok secara finansial dan praktis untuk pemula.
                      </div>
                    </li>
                    <li className="flex items-start gap-12">
                      <span className="mt-2 flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-lilac-mist text-ink-charcoal text-[12px] font-bold">3</span>
                      <div>
                        <strong className="font-w540">Startup Roadmap Eksekusi:</strong> Dapatkan panduan tahap demi tahap mulai dari validasi resep, perizinan P-IRT/Halal, hingga pembukaan perdana.
                      </div>
                    </li>
                  </ul>

                  <div className="mt-32">
                    <Link
                      href="/register"
                      className="inline-flex min-h-[44px] items-center justify-center gap-8 rounded-buttons bg-midnight-wine px-24 text-body-sm font-w460 text-paper-white transition-colors hover:bg-midnight-wine/90"
                    >
                      <span>Mulai Sebagai Calon Pengusaha</span>
                      <span aria-hidden="true">&rarr;</span>
                    </Link>
                  </div>
                </div>

                {/* Visual Specimen Card */}
                <div className="rounded-cards border border-soft-mist bg-warm-parchment/60 p-24 transition-all duration-300 hover:shadow-lg hover:border-royal-violet/30 cursor-default">
                  <div className="flex items-center justify-between border-b border-soft-mist pb-12">
                    <span className="text-caption font-w540 text-stone-gray uppercase">Simulasi Profil A</span>
                    <span className="text-caption font-w540 text-emerald-800">Status: Siap Dianalisis</span>
                  </div>
                  <div className="mt-16 space-y-12 text-body-sm">
                    <div className="flex justify-between">
                      <span className="text-stone-gray">Kategori Minat:</span>
                      <span className="font-w540 text-ink-charcoal">Minuman (Matcha & Tea Infusion)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-gray">Kesiapan Modal:</span>
                      <span className="font-w540 text-ink-charcoal">Rp10.000.000</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-gray">Target Pembeli:</span>
                      <span className="font-w540 text-ink-charcoal">Mahasiswa & Pekerja Kantor</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-gray">Kanal Penjualan:</span>
                      <span className="font-w540 text-ink-charcoal">Booth Offline + Pre-Order Online</span>
                    </div>
                  </div>
                  <div className="mt-20 rounded-small-buttons bg-paper-white p-16 border border-soft-mist">
                    <div className="flex items-center justify-between">
                      <span className="text-caption text-stone-gray">Rekomendasi Utama:</span>
                      <span className="text-caption font-w540 text-royal-violet">Fit Score 88/100</span>
                    </div>
                    <p className="mt-4 text-label-bold font-w540 text-ink-charcoal">
                      Artisan Matcha Cold-Whisk Bar
                    </p>
                    <p className="mt-4 text-caption text-stone-gray">
                      Estimasi payback period 3-4 bulan dengan modal kerja yang aman.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              id="panel-umkm"
              role="tabpanel"
              aria-labelledby="tab-umkm"
              className="rounded-cards border border-soft-mist bg-paper-white p-24 sm:p-40"
            >
              <div className="grid gap-40 lg:grid-cols-2 lg:items-center">
                <div>
                  <span className="inline-flex rounded-pills bg-warm-parchment px-12 py-4 text-caption font-w540 text-royal-violet">
                    Jalur B &middot; Mengembangkan Bisnis Aktif
                  </span>
                  <h3 className="mt-16 text-heading-sm font-w460 tracking-heading-sm text-ink-charcoal">
                    Inovasi menu dan diversifikasi produk dengan risiko terukur.
                  </h3>
                  <p className="mt-16 text-body text-stone-gray leading-body">
                    Bagi pelaku usaha kuliner yang sudah berjalan, meluncurkan menu baru atau membuka lini cabang membutuhkan keselarasan dengan kapasitas dapur dan saluran penjualan saat ini.
                  </p>

                  <ul className="mt-24 space-y-16 text-body-sm text-ink-charcoal">
                    <li className="flex items-start gap-12">
                      <span className="mt-2 flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-lilac-mist text-ink-charcoal text-[12px] font-bold">1</span>
                      <div>
                        <strong className="font-w540">Audit Bisnis Existing:</strong> Catat menu terlaris, rata-rata omzet bulanan, dan kapasitas produksi dapur Anda saat ini.
                      </div>
                    </li>
                    <li className="flex items-start gap-12">
                      <span className="mt-2 flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-lilac-mist text-ink-charcoal text-[12px] font-bold">2</span>
                      <div>
                        <strong className="font-w540">Discovery Peluang Komplementer:</strong> Temukan peluang menu baru yang memanfaatkan bahan baku serupa untuk menekan food waste dan memaksimalkan margin.
                      </div>
                    </li>
                    <li className="flex items-start gap-12">
                      <span className="mt-2 flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-lilac-mist text-ink-charcoal text-[12px] font-bold">3</span>
                      <div>
                        <strong className="font-w540">Growth Roadmap:</strong> Panduan pengujian menu (A/B testing rasa), kampanye platform pesan antar, dan optimasi supply chain.
                      </div>
                    </li>
                  </ul>

                  <div className="mt-32">
                    <Link
                      href="/register"
                      className="inline-flex min-h-[44px] items-center justify-center gap-8 rounded-buttons bg-midnight-wine px-24 text-body-sm font-w460 text-paper-white transition-colors hover:bg-midnight-wine/90"
                    >
                      <span>Mulai Sebagai UMKM Existing</span>
                      <span aria-hidden="true">&rarr;</span>
                    </Link>
                  </div>
                </div>

                {/* Visual Specimen Card for UMKM */}
                <div className="rounded-cards border border-soft-mist bg-warm-parchment/60 p-24 transition-all duration-300 hover:shadow-lg hover:border-royal-violet/30 cursor-default">
                  <div className="flex items-center justify-between border-b border-soft-mist pb-12">
                    <span className="text-caption font-w540 text-stone-gray uppercase">Simulasi Profil B</span>
                    <span className="text-caption font-w540 text-emerald-800">Status: Usaha Aktif</span>
                  </div>
                  <div className="mt-16 space-y-12 text-body-sm">
                    <div className="flex justify-between">
                      <span className="text-stone-gray">Nama Usaha:</span>
                      <span className="font-w540 text-ink-charcoal">Kopi & Toast Sudut Kota</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-gray">Omzet Rata-rata:</span>
                      <span className="font-w540 text-ink-charcoal">Rp25 - 50 Juta / Bulan</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-gray">Kanal Aktif:</span>
                      <span className="font-w540 text-ink-charcoal">Dine-in (60%) + Grab/GoFood (40%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-gray">Tujuan Pertumbuhan:</span>
                      <span className="font-w540 text-ink-charcoal">Tambah Menu Sore Non-Kopi</span>
                    </div>
                  </div>
                  <div className="mt-20 rounded-small-buttons bg-paper-white p-16 border border-soft-mist">
                    <div className="flex items-center justify-between">
                      <span className="text-caption text-stone-gray">Peluang Inovasi Menu:</span>
                      <span className="text-caption font-w540 text-royal-violet">Fit Score 91/100</span>
                    </div>
                    <p className="mt-4 text-label-bold font-w540 text-ink-charcoal">
                      Artisan Savory Pastry & Herb Refreshers
                    </p>
                    <p className="mt-4 text-caption text-stone-gray">
                      Memanfaatkan oven yang sudah ada untuk menaikkan basket size rata-rata 35%.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
