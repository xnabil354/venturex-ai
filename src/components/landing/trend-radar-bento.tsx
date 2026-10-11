"use client";

import Link from "next/link";
import { useState } from "react";
import { cx } from "@/lib/cx";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  TrendingUpIcon,
  ZapIcon,
} from "./icons";

type SubTabKey = "beverages" | "snacks" | "meals" | "bakery" | "catering";

type CategoryDetail = {
  title: string;
  category: string;
  growth: string;
  momentum: string;
  desc: string;
};

const subTabContent: Record<SubTabKey, CategoryDetail> = {
  beverages: {
    title: "Botanical & Herb Cold Brew",
    category: "Minuman (Beverages)",
    growth: "+42.6% YoY",
    momentum: "Tinggi & Organik",
    desc: "Pergeseran preferensi konsumen urban ke minuman fungsional rendah gula dengan infusi rempah lokal seperti serai, kayu manis, dan jahe merah.",
  },
  snacks: {
    title: "Artisan Root & Tubers Chips",
    category: "Camilan (Snacks)",
    growth: "+31.2% YoY",
    momentum: "Stabil Meningkat",
    desc: "Keripik umbi lokal berkualitas tinggi dengan bumbu gurih alami dan kemasan modern untuk segmen pekerja komuter dan kaum muda.",
  },
  meals: {
    title: "High-Protein Rice Bowl Prep",
    category: "Makanan Utama",
    growth: "+48.9% YoY",
    momentum: "Sangat Kuat",
    desc: "Menu makan siang sehat terukur kalori dengan opsi langganan mingguan untuk pekerja kantor dan komunitas kebugaran.",
  },
  bakery: {
    title: "Sourdough & Spiced Pastry",
    category: "Roti & Dessert",
    growth: "+27.4% YoY",
    momentum: "Tumbuh Konsisten",
    desc: "Kue kering dan roti fermentasi alami dengan daya simpan lebih lama dan harga jual per kemasan yang menguntungkan.",
  },
  catering: {
    title: "Corporate Wellness Bento Box",
    category: "Katering & B2B",
    growth: "+36.5% YoY",
    momentum: "Kontrak Berulang",
    desc: "Penyediaan paket makan siang meeting perusahaan dengan standardisasi kebersihan dan opsi diet fleksibel.",
  },
};

const subTabOptions: readonly (readonly [SubTabKey, string])[] = [
  ["beverages", "Minuman"],
  ["snacks", "Camilan"],
  ["meals", "Makanan Utama"],
  ["bakery", "Roti & Dessert"],
  ["catering", "Katering & B2B"],
] as const;

export function TrendRadarBento() {
  const [activeSubTab, setActiveSubTab] = useState<SubTabKey>("beverages");
  const currentCategory = subTabContent[activeSubTab];

  return (
    <section id="fitur-utama" className="py-64 lg:py-96 scroll-mt-24">
      <div className="mx-auto max-w-[1200px] px-16 sm:px-24">
        {/* Section Header */}
        <div className="mx-auto max-w-[760px] text-center">
          <span className="inline-flex items-center gap-8 rounded-pills bg-paper-white px-12 py-4 text-caption font-w540 uppercase tracking-widest text-royal-violet border border-soft-mist">
            <span className="h-6 w-6 rounded-full bg-royal-violet" />
            VENTUREX Trend Radar
          </span>

          <h2 className="mt-16 text-heading-lg font-w460 leading-heading-lg tracking-heading-lg text-ink-charcoal sm:text-display sm:leading-display sm:tracking-display text-balance">
            Tangkap pergeseran pasar sebelum menjadi jenuh.
          </h2>

          <p className="mt-16 text-body text-stone-gray text-balance max-w-[620px] mx-auto">
            Katalog tren pasar terkurasi yang memisahkan pergeseran organik jangka panjang dari sekadar tren viral sesaat.
          </p>

          <div className="mt-28 flex items-center justify-center gap-16">
            <Link
              href="/register"
              className="inline-flex min-h-[44px] items-center justify-center rounded-buttons bg-midnight-wine px-20 text-body-sm font-w460 text-paper-white hover:bg-midnight-wine/90"
            >
              Jelajahi Katalog Tren
            </Link>
            <a
              href="#kualitas-data"
              className="group inline-flex items-center gap-6 text-body-sm font-w460 text-royal-violet hover:underline"
            >
              <span>Lihat Standar Kurasi</span>
              <ArrowRightIcon className="h-14 w-14 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </div>

        {/* Bento Grid (Superhuman Layout) */}
        <div className="mt-48 grid gap-20 lg:grid-cols-12">
          {/* Top Wide Bento: Deep Lagoon */}
          <div className="lg:col-span-12 rounded-cards bg-deep-lagoon text-paper-white p-24 sm:p-40 border border-paper-white/10 shadow-lg transition-all duration-300 hover:shadow-2xl hover:border-paper-white/20">
            <div className="grid gap-32 lg:grid-cols-2 lg:items-center">
              <div>
                <span className="text-caption font-w540 uppercase tracking-wider text-lilac-mist">
                  Deteksi Tren Berbasis Bukti
                </span>
                <h3 className="mt-12 text-heading-sm font-w460 tracking-heading-sm text-paper-white sm:text-heading-lg sm:leading-heading-lg">
                  Sinyal Pertumbuhan Kuartalan
                </h3>
                <p className="mt-12 text-body-sm font-w460 text-paper-white/80 leading-body">
                  Algoritma kami mengukur volume transaksi riil, frekuensi pencarian digital, dan tren bahan baku untuk menentukan apakah suatu produk sedang berkembang (*Emerging*), berada di puncak (*Peaking*), atau sudah jenuh (*Saturated*).
                </p>
                <div className="mt-20 flex items-center gap-16 text-caption text-lilac-mist">
                  <span className="flex items-center gap-6">
                    <span className="h-6 w-6 rounded-full bg-emerald-400 animate-pulse" />
                    Pembaruan Berkala
                  </span>
                  <span>&middot;</span>
                  <span>Verifikasi Data Faktual</span>
                </div>
              </div>

              {/* Mini Bento UI Preview */}
              <div className="rounded-cards bg-paper-white/10 p-20 border border-paper-white/20 backdrop-blur-md transition-all duration-300 hover:scale-[1.01] hover:border-paper-white/40">
                <div className="flex items-center justify-between border-b border-paper-white/15 pb-12">
                  <span className="text-caption text-lilac-mist">Tren Teratas Minggu Ini</span>
                  <span className="rounded-pills bg-paper-white/20 px-8 py-2 text-[11px] text-paper-white font-w540">
                    Skor Momentum 94/100
                  </span>
                </div>
                <div className="mt-16">
                  <h4 className="text-label-bold font-w540 text-paper-white">
                    Minuman Fungsional Rendah Gula
                  </h4>
                  <p className="mt-4 text-caption text-paper-white/70">
                    Kategori: Minuman Botani & Herbal Lokal
                  </p>
                  <div className="mt-16 grid grid-cols-2 gap-8 text-caption">
                    <div className="rounded-small-buttons bg-black/25 p-8 transition-colors hover:bg-black/40">
                      <span className="text-paper-white/60 block text-[11px]">Pertumbuhan Tahunan</span>
                      <strong className="text-body-sm text-emerald-300 font-w540">+42.6% YoY</strong>
                    </div>
                    <div className="rounded-small-buttons bg-black/25 p-8 transition-colors hover:bg-black/40">
                      <span className="text-paper-white/60 block text-[11px]">Tingkat Kejenuhan</span>
                      <strong className="text-body-sm text-lilac-mist font-w540">Rendah (Peluang Terbuka)</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Left Bento: Midnight Wine */}
          <div className="lg:col-span-6 rounded-cards bg-midnight-wine text-paper-white p-24 sm:p-32 border border-soft-mist/20 shadow-md flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-lilac-mist/30">
            <div>
              <span className="text-caption font-w540 uppercase tracking-wider text-lilac-mist">
                Optimasi Rantai Pasok
              </span>
              <h3 className="mt-12 text-heading-sm font-w460 tracking-heading-sm text-paper-white">
                Analisis Bahan Baku Lokal
              </h3>
              <p className="mt-8 text-body-sm font-w460 text-paper-white/80">
                Temukan peluang menu yang mengandalkan komoditas pertanian lokal yang melimpah untuk menekan *food cost* dan menjaga stabilitas margin usaha.
              </p>
            </div>
            <div className="mt-24 rounded-small-buttons bg-paper-white/10 p-12 border border-paper-white/15 text-caption transition-colors hover:bg-paper-white/15">
              <span className="text-lilac-mist font-w540 block">Studi Kasus Bahan Baku:</span>
              <span className="text-paper-white/80">Rempah lokal menghasilkan margin kotor hingga 65% lebih tinggi dibanding sirup impor sintetis.</span>
            </div>
          </div>

          {/* Bottom Right Bento: Paper White with Soft Mist Border */}
          <div className="lg:col-span-6 rounded-cards bg-paper-white text-ink-charcoal p-24 sm:p-32 border border-soft-mist shadow-sm flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-royal-violet/30">
            <div>
              <span className="text-caption font-w540 uppercase tracking-wider text-royal-violet">
                Pemetaan Konsumen
              </span>
              <h3 className="mt-12 text-heading-sm font-w460 tracking-heading-sm text-ink-charcoal">
                Klasifikasi Segmen Pembeli
              </h3>
              <p className="mt-8 text-body-sm text-stone-gray">
                Ketahui secara pasti apakah tren digemari oleh pekerja kantor yang mengutamakan kecepatan, mahasiswa yang sensitif harga, atau keluarga yang mencari porsi bersama.
              </p>
            </div>
            <div className="mt-24 flex items-center gap-8 flex-wrap">
              <span className="rounded-pills border border-soft-mist bg-warm-parchment px-10 py-4 text-caption font-w540 text-ink-charcoal transition-all duration-200 hover:scale-105 hover:bg-lilac-mist/30 hover:border-royal-violet/40 cursor-default">
                Pekerja Kantor
              </span>
              <span className="rounded-pills border border-soft-mist bg-warm-parchment px-10 py-4 text-caption font-w540 text-ink-charcoal transition-all duration-200 hover:scale-105 hover:bg-lilac-mist/30 hover:border-royal-violet/40 cursor-default">
                Mahasiswa & Pelajar
              </span>
              <span className="rounded-pills border border-soft-mist bg-warm-parchment px-10 py-4 text-caption font-w540 text-ink-charcoal transition-all duration-200 hover:scale-105 hover:bg-lilac-mist/30 hover:border-royal-violet/40 cursor-default">
                Keluarga Urban
              </span>
            </div>
          </div>
        </div>

        {/* Sub-Tab Strip and 3-Card Highlights (Superhuman Style) */}
        <div className="mt-48">
          <div className="flex flex-wrap items-center justify-center gap-8 border-b border-soft-mist pb-16">
            {subTabOptions.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveSubTab(key)}
                className={cx(
                  "rounded-small-buttons px-16 py-8 text-body-sm transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer",
                  activeSubTab === key
                    ? "bg-lilac-mist text-ink-charcoal font-w540 border border-ink-charcoal shadow-xs"
                    : "bg-paper-white text-stone-gray hover:text-ink-charcoal border border-soft-mist hover:border-ink-charcoal/40"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Active Category Display Bar */}
          <div className="mt-16 rounded-cards bg-paper-white p-20 border border-soft-mist flex flex-col sm:flex-row sm:items-center justify-between gap-12 transition-all duration-300 hover:shadow-md hover:border-royal-violet/30 cursor-default">
            <div>
              <span className="text-caption text-royal-violet font-w540 uppercase">{currentCategory.category}</span>
              <h4 className="text-label-bold font-w540 text-ink-charcoal">{currentCategory.title}</h4>
              <p className="mt-2 text-caption text-stone-gray max-w-[600px]">{currentCategory.desc}</p>
            </div>
            <div className="flex items-center gap-16 shrink-0">
              <div className="text-right">
                <span className="text-caption text-stone-gray block">Pertumbuhan</span>
                <span className="text-body font-w540 text-emerald-700">{currentCategory.growth}</span>
              </div>
              <div className="text-right">
                <span className="text-caption text-stone-gray block">Momentum</span>
                <span className="text-body font-w540 text-royal-violet">{currentCategory.momentum}</span>
              </div>
            </div>
          </div>

          {/* 3 Value Pillars */}
          <div className="mt-24 grid gap-16 sm:grid-cols-3">
            <div className="rounded-cards bg-paper-white p-20 border border-soft-mist transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg hover:border-royal-violet/30 cursor-default">
              <div className="flex h-32 w-32 items-center justify-center rounded-small-buttons bg-deep-lagoon/10 text-deep-lagoon transition-transform duration-200 group-hover:scale-110">
                <CheckCircleIcon className="h-18 w-18" />
              </div>
              <h4 className="mt-12 text-body-sm font-w540 text-ink-charcoal">
                Kurasi Bukti Independen
              </h4>
              <p className="mt-4 text-caption text-stone-gray">
                Setiap tren divalidasi oleh analis manusia untuk memastikan reliabilitas sebelum diterbitkan.
              </p>
            </div>

            <div className="rounded-cards bg-paper-white p-20 border border-soft-mist transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg hover:border-royal-violet/30 cursor-default">
              <div className="flex h-32 w-32 items-center justify-center rounded-small-buttons bg-royal-violet/10 text-royal-violet transition-transform duration-200 group-hover:scale-110">
                <ZapIcon className="h-18 w-18" />
              </div>
              <h4 className="mt-12 text-body-sm font-w540 text-ink-charcoal">
                Deteksi Kejenuhan Pasar
              </h4>
              <p className="mt-4 text-caption text-stone-gray">
                Peringatan dini jika suatu kategori mulai dimasuki terlalu banyak pemain dan terjadi perang harga.
              </p>
            </div>

            <div className="rounded-cards bg-paper-white p-20 border border-soft-mist transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg hover:border-royal-violet/30 cursor-default">
              <div className="flex h-32 w-32 items-center justify-center rounded-small-buttons bg-midnight-wine/10 text-midnight-wine transition-transform duration-200 group-hover:scale-110">
                <TrendingUpIcon className="h-18 w-18" />
              </div>
              <h4 className="mt-12 text-body-sm font-w540 text-ink-charcoal">
                Klasifikasi Siklus Hidup
              </h4>
              <p className="mt-4 text-caption text-stone-gray">
                Pahami posisi tren: apakah fase adopsi awal (*Emerging*), puncak popularitas (*Peaking*), atau jenuh.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
