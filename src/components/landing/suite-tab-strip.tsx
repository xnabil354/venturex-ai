"use client";

import Link from "next/link";
import { useState } from "react";
import { cx } from "@/lib/cx";

export function SuiteTabStrip() {
  const [activeTab, setActiveTab] = useState<"entrepreneur" | "umkm">("entrepreneur");

  return (
    <section id="alur-solusi" className="scroll-mt-24 py-48 sm:py-64 lg:py-96">
      <div className="mx-auto max-w-[1200px] px-16 sm:px-24">
        {/* Section Heading */}
        <div className="max-w-[760px]">
          <p className="text-caption font-w540 uppercase tracking-wider text-royal-violet">
            Dua Jalur Solusi Terarah
          </p>
          <h2 className="mt-12 text-heading-sm font-w460 leading-heading-sm tracking-heading-sm text-ink-charcoal sm:text-heading-lg sm:leading-heading-lg sm:tracking-heading-lg text-balance">
            Dirancang khusus untuk tahap bisnis Anda saat ini.
          </h2>
          <p className="mt-16 text-body text-stone-gray text-balance">
            Baik baru ingin memulai maupun sudah menjalankan usaha, VENTUREX menyesuaikan informasi dan penilaian dengan konteks profil Anda.
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
                "flex min-h-[44px] items-center justify-start gap-12 rounded-[6px] px-16 py-14 text-left transition-[background-color,color] duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-royal-violet focus-visible:outline-offset-2 sm:justify-center sm:px-24 sm:py-16",
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
                "flex min-h-[44px] items-center justify-start gap-12 rounded-[6px] px-16 py-14 text-left transition-[background-color,color] duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-royal-violet focus-visible:outline-offset-2 sm:justify-center sm:px-24 sm:py-16",
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
              className="rounded-cards border border-soft-mist bg-paper-white p-20 sm:p-32 lg:p-40"
            >
              <div className="grid gap-28 lg:grid-cols-2 lg:items-center lg:gap-40">
                <div>
                  <span className="inline-flex rounded-pills bg-warm-parchment px-12 py-4 text-caption font-w540 text-royal-violet">
                    Jalur A &middot; Memulai dari Nol
                  </span>
                  <h3 className="mt-16 text-heading-sm font-w460 tracking-heading-sm text-ink-charcoal">
                    Validasi ide usaha sebelum modal tabungan Anda terpakai.
                  </h3>
                  <p className="mt-16 text-body text-stone-gray leading-body">
                    Mulai dengan memahami peluang, kebutuhan data, dan kesesuaian awal sebelum memutuskan eksperimen bisnis.
                  </p>

                  <ul className="mt-24 space-y-16 text-body-sm text-ink-charcoal">
                    <li className="flex items-start gap-12">
                      <span className="mt-2 flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-lilac-mist text-ink-charcoal text-[12px] font-bold">1</span>
                      <div>
                        <strong className="font-w540">Lengkapi profil:</strong> Masukkan modal, minat kategori, lokasi, kanal, dan konteks yang tersedia untuk personalisasi.
                      </div>
                    </li>
                    <li className="flex items-start gap-12">
                      <span className="mt-2 flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-lilac-mist text-ink-charcoal text-[12px] font-bold">2</span>
                      <div>
                        <strong className="font-w540">Tinjau skor dan risiko:</strong> Fit Score serta indikator risiko membantu membaca kesesuaian berdasarkan data yang tersedia, bukan menjamin hasil bisnis.
                      </div>
                    </li>
                    <li className="flex items-start gap-12">
                      <span className="mt-2 flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-lilac-mist text-ink-charcoal text-[12px] font-bold">3</span>
                      <div>
                        <strong className="font-w540">Buat Startup Roadmap:</strong> Susun langkah validasi dari peluang yang telah disimpan dan dianalisis.
                      </div>
                    </li>
                  </ul>

                  <div className="mt-32">
                    <Link
                      href="/register"
                      className="inline-flex min-h-[44px] w-full items-center justify-center gap-8 rounded-buttons bg-midnight-wine px-24 text-body-sm font-w460 text-paper-white transition-colors hover:bg-midnight-wine/90 sm:w-auto"
                    >
                      <span>Mulai Sebagai Calon Pengusaha</span>
                      <span aria-hidden="true">&rarr;</span>
                    </Link>
                  </div>
                </div>

                {/* Visual Specimen Card */}
                <div className="rounded-cards border border-soft-mist bg-warm-parchment/60 p-24 transition-all duration-300 hover:shadow-lg hover:border-royal-violet/30 cursor-default">
                  <div className="flex items-center justify-between border-b border-soft-mist pb-12">
                    <span className="text-caption font-w540 text-stone-gray uppercase">Contoh profil · data dummy</span>
                    <span className="text-caption font-w540 text-royal-violet">Demonstrasi</span>
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
                      <span className="text-caption text-stone-gray">Hasil simulasi:</span>
                      <span className="text-caption font-w540 text-royal-violet">Fit Score 88/100 · dummy</span>
                    </div>
                    <p className="mt-4 text-label-bold font-w540 text-ink-charcoal">
                      Artisan Matcha Cold-Whisk Bar
                    </p>
                    <p className="mt-4 text-caption text-stone-gray">
                      Contoh estimasi balik modal 3–4 bulan. Hasil aktual bergantung pada profil, bukti, dan data yang tersedia.
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
              className="rounded-cards border border-soft-mist bg-paper-white p-20 sm:p-32 lg:p-40"
            >
              <div className="grid gap-28 lg:grid-cols-2 lg:items-center lg:gap-40">
                <div>
                  <span className="inline-flex rounded-pills bg-warm-parchment px-12 py-4 text-caption font-w540 text-royal-violet">
                    Jalur B &middot; Mengembangkan Bisnis Aktif
                  </span>
                  <h3 className="mt-16 text-heading-sm font-w460 tracking-heading-sm text-ink-charcoal">
                    Inovasi menu dan diversifikasi produk dengan risiko terukur.
                  </h3>
                  <p className="mt-16 text-body text-stone-gray leading-body">
                    Untuk bisnis yang sudah berjalan, gunakan konteks produk, pelanggan, harga, dan kanal saat ini untuk mengevaluasi peluang berikutnya.
                  </p>

                  <ul className="mt-24 space-y-16 text-body-sm text-ink-charcoal">
                    <li className="flex items-start gap-12">
                      <span className="mt-2 flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-lilac-mist text-ink-charcoal text-[12px] font-bold">1</span>
                      <div>
                        <strong className="font-w540">Lengkapi profil usaha:</strong> Catat kategori produk, pelanggan, harga, kanal, dan konteks operasional yang relevan.
                      </div>
                    </li>
                    <li className="flex items-start gap-12">
                      <span className="mt-2 flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-lilac-mist text-ink-charcoal text-[12px] font-bold">2</span>
                      <div>
                        <strong className="font-w540">Tinjau peluang yang relevan:</strong> Bandingkan peluang dengan profil bisnis dan bukti yang tersedia.
                      </div>
                    </li>
                    <li className="flex items-start gap-12">
                      <span className="mt-2 flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-lilac-mist text-ink-charcoal text-[12px] font-bold">3</span>
                      <div>
                        <strong className="font-w540">Buat Growth Roadmap:</strong> Susun langkah validasi untuk peluang yang telah disimpan dan dianalisis.
                      </div>
                    </li>
                  </ul>

                  <div className="mt-32">
                    <Link
                      href="/register"
                      className="inline-flex min-h-[44px] w-full items-center justify-center gap-8 rounded-buttons bg-midnight-wine px-24 text-body-sm font-w460 text-paper-white transition-colors hover:bg-midnight-wine/90 sm:w-auto"
                    >
                      <span>Mulai Sebagai UMKM Existing</span>
                      <span aria-hidden="true">&rarr;</span>
                    </Link>
                  </div>
                </div>

                {/* Visual Specimen Card for UMKM */}
                <div className="rounded-cards border border-soft-mist bg-warm-parchment/60 p-24 transition-all duration-300 hover:shadow-lg hover:border-royal-violet/30 cursor-default">
                  <div className="flex items-center justify-between border-b border-soft-mist pb-12">
                    <span className="text-caption font-w540 text-stone-gray uppercase">Contoh profil · data dummy</span>
                    <span className="text-caption font-w540 text-royal-violet">Demonstrasi</span>
                  </div>
                  <div className="mt-16 space-y-12 text-body-sm">
                    <div className="flex justify-between">
                      <span className="text-stone-gray">Nama Usaha:</span>
                      <span className="font-w540 text-ink-charcoal">Kopi & Toast Sudut Kota</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-gray">Omzet rata-rata:</span>
                      <span className="font-w540 text-ink-charcoal">Rp25–50 juta / bulan</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-gray">Kanal Aktif:</span>
                      <span className="font-w540 text-ink-charcoal">Dine-in (60%) + Delivery (40%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-gray">Tujuan Pertumbuhan:</span>
                      <span className="font-w540 text-ink-charcoal">Tambah menu sore non-kopi</span>
                    </div>
                  </div>
                  <div className="mt-20 rounded-small-buttons bg-paper-white p-16 border border-soft-mist">
                    <div className="flex items-center justify-between">
                      <span className="text-caption text-stone-gray">Hasil simulasi:</span>
                      <span className="text-caption font-w540 text-royal-violet">Fit Score 91/100 · dummy</span>
                    </div>
                    <p className="mt-4 text-label-bold font-w540 text-ink-charcoal">
                      Artisan Savory Pastry & Herb Refreshers
                    </p>
                    <p className="mt-4 text-caption text-stone-gray">
                      Contoh skenario peningkatan basket size 35%. Hasil aktual bergantung pada profil, bukti, dan data yang tersedia.
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
