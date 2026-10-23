import Link from "next/link";
import { ArrowRightIcon } from "./icons";

export function TrendRadarBento() {

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
            Jelajahi tren F&amp;B yang diterbitkan bersama ringkasan, periode pengamatan, sumber bukti, dan relevansi bisnisnya.
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
                  Tren dengan konteks yang dapat ditelusuri
                </h3>
                <p className="mt-12 text-body-sm font-w460 text-paper-white/80 leading-body">
                  Setiap tren yang diterbitkan memiliki arah tren, periode pengamatan, sumber pendukung, dan penjelasan relevansinya. Gunakan informasi ini sebagai bahan eksplorasi, bukan kepastian hasil pasar.
                </p>
                <div className="mt-20 flex items-center gap-16 text-caption text-lilac-mist">
                  <span className="flex items-center gap-6">
                    <span className="h-6 w-6 rounded-full bg-emerald-400 animate-pulse" />
                    Bukti yang dicatat
                  </span>
                  <span>&middot;</span>
                  <span>Batasan data terlihat</span>
                </div>
              </div>

              {/* Mini Bento UI Preview */}
              <div className="rounded-cards bg-paper-white/10 p-20 border border-paper-white/20 backdrop-blur-md transition-all duration-300 hover:scale-[1.01] hover:border-paper-white/40">
                <div className="flex items-center justify-between border-b border-paper-white/15 pb-12">
                  <span className="text-caption text-lilac-mist">Contoh tampilan detail tren</span>
                  <span className="rounded-pills bg-paper-white/20 px-8 py-2 text-[11px] text-paper-white font-w540">
                    Ilustrasi
                  </span>
                </div>
                <div className="mt-16">
                  <h4 className="text-label-bold font-w540 text-paper-white">
                    Ringkasan tren F&amp;B
                  </h4>
                  <p className="mt-4 text-caption text-paper-white/70">
                    Arah, periode, sumber, dan relevansi bisnis
                  </p>
                  <div className="mt-16 grid grid-cols-2 gap-8 text-caption">
                    <div className="rounded-small-buttons bg-black/25 p-8 transition-colors hover:bg-black/40">
                      <span className="text-paper-white/60 block text-[11px]">Arah tren</span>
                      <strong className="text-body-sm text-paper-white font-w540">Naik, stabil, atau turun</strong>
                    </div>
                    <div className="rounded-small-buttons bg-black/25 p-8 transition-colors hover:bg-black/40">
                      <span className="text-paper-white/60 block text-[11px]">Bukti pendukung</span>
                      <strong className="text-body-sm text-lilac-mist font-w540">Sumber dan catatan</strong>
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
                Peluang dalam Katalog
              </span>
              <h3 className="mt-12 text-heading-sm font-w460 tracking-heading-sm text-paper-white">
                Eksplorasi Peluang Menu
              </h3>
              <p className="mt-8 text-body-sm font-w460 text-paper-white/80">
                Tinjau peluang menu dalam katalog untuk melihat keterkaitannya dengan tren, konteks pengguna, dan bukti yang tersedia.
              </p>
            </div>
            <div className="mt-24 rounded-small-buttons bg-paper-white/10 p-12 border border-paper-white/15 text-caption transition-colors hover:bg-paper-white/15">
              <span className="text-lilac-mist font-w540 block">Catatan penting:</span>
              <span className="text-paper-white/80">Biaya, margin, dan kelayakan operasional perlu divalidasi dengan data usaha Anda sendiri.</span>
            </div>
          </div>

          {/* Bottom Right Bento: Paper White with Soft Mist Border */}
          <div className="lg:col-span-6 rounded-cards bg-paper-white text-ink-charcoal p-24 sm:p-32 border border-soft-mist shadow-sm flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-royal-violet/30">
            <div>
              <span className="text-caption font-w540 uppercase tracking-wider text-royal-violet">
                Pemetaan Konsumen
              </span>
              <h3 className="mt-12 text-heading-sm font-w460 tracking-heading-sm text-ink-charcoal">
                Konteks Pengguna yang Dipersonalisasi
              </h3>
              <p className="mt-8 text-body-sm text-stone-gray">
                Profil membantu menyaring informasi dan menilai kesesuaian peluang dengan kategori, modal, pelanggan, dan kanal yang Anda pilih.
              </p>
            </div>
            <div className="mt-24 flex items-center gap-8 flex-wrap">
              <span className="rounded-pills border border-soft-mist bg-warm-parchment px-10 py-4 text-caption font-w540 text-ink-charcoal transition-all duration-200 hover:scale-105 hover:bg-lilac-mist/30 hover:border-royal-violet/40 cursor-default">
                Kategori usaha
              </span>
              <span className="rounded-pills border border-soft-mist bg-warm-parchment px-10 py-4 text-caption font-w540 text-ink-charcoal transition-all duration-200 hover:scale-105 hover:bg-lilac-mist/30 hover:border-royal-violet/40 cursor-default">
                Modal dan harga
              </span>
              <span className="rounded-pills border border-soft-mist bg-warm-parchment px-10 py-4 text-caption font-w540 text-ink-charcoal transition-all duration-200 hover:scale-105 hover:bg-lilac-mist/30 hover:border-royal-violet/40 cursor-default">
                Pelanggan dan kanal
              </span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
