import Image from "next/image";
import Link from "next/link";

export function DarkFeatureBand() {
  return (
    <section id="kualitas-data" className="w-full bg-deep-lagoon py-64 lg:py-96 text-paper-white scroll-mt-24">
      <div className="mx-auto max-w-[1200px] px-16 sm:px-24">
        <div className="grid gap-48 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          {/* Left Visual Collage */}
          <div className="relative mx-auto w-full max-w-[480px]">
            {/* Layered translucent geometric cards with culinary craft photography */}
            <div className="relative overflow-hidden rounded-cards border border-paper-white/20 bg-paper-white/10 p-24 backdrop-blur-md">
              <div className="absolute inset-0 -z-10">
                <Image
                  src="/images/culinary-craft.jpg"
                  alt="Komposisi bahan dan minuman artisanal pada kain linen hangat"
                  fill
                  className="object-cover opacity-25 mix-blend-luminosity"
                />
                <div className="absolute inset-0 bg-deep-lagoon/80" />
              </div>
              <div className="flex items-center justify-between border-b border-paper-white/15 pb-16">
                <span className="text-caption font-w540 uppercase tracking-wider text-lilac-mist">
                  Protokol Validasi Bukti
                </span>
                <span className="rounded-pills bg-paper-white/15 px-8 py-2 text-[11px] text-paper-white font-w540">
                  Audit Lolos
                </span>
              </div>

              <div className="mt-16 space-y-12 text-body-sm text-paper-white/90">
                <div className="rounded-small-buttons bg-black/20 p-12 border border-paper-white/10">
                  <span className="text-[11px] text-lilac-mist block">Sumber Validasi 01</span>
                  <p className="mt-2 text-caption">Laporan Tren Bahan Baku Pertanian & Perkebunan Lokal (Kementan / BPS)</p>
                </div>
                <div className="rounded-small-buttons bg-black/20 p-12 border border-paper-white/10">
                  <span className="text-[11px] text-lilac-mist block">Sumber Validasi 02</span>
                  <p className="mt-2 text-caption">Analisis Volume Pencarian & Sentimen Digital F&B Indonesia</p>
                </div>
                <div className="rounded-small-buttons bg-black/20 p-12 border border-paper-white/10">
                  <span className="text-[11px] text-lilac-mist block">Sumber Validasi 03</span>
                  <p className="mt-2 text-caption">Verifikasi Kurator Industri Independen (Human-in-the-Loop)</p>
                </div>
              </div>

              <div className="mt-20 flex items-center justify-between border-t border-paper-white/15 pt-16 text-caption text-paper-white/70">
                <span>Fabrikasi Data: 0%</span>
                <span className="text-lilac-mist font-w540">Tingkat Akurasi Kurasi: 99.4%</span>
              </div>
            </div>

            {/* Overlaid floating accent pill */}
            <div className="absolute -bottom-16 -right-12 hidden sm:block rounded-pills border border-paper-white/30 bg-midnight-wine px-16 py-8 text-caption font-w540 text-paper-white shadow-lg">
              SDG 8 &middot; Perlindungan Modal UMKM
            </div>
          </div>

          {/* Right Narrative Copy */}
          <div>
            <p className="text-caption font-w540 uppercase tracking-widest text-lilac-mist">
              Kualitas & Integritas Data
            </p>

            <h2 className="mt-16 text-heading-lg font-w460 leading-heading-lg tracking-heading-lg text-paper-white lg:text-display lg:leading-display lg:tracking-display text-balance">
              Kecerdasan buatan dengan disiplin data nyata.
            </h2>

            <p className="mt-20 text-body font-w460 text-paper-white/80 leading-body text-balance max-w-[560px]">
              Model kecerdasan buatan umum sering kali memunculkan halusinasi — menciptakan tren fiktif atau proyeksi finansial yang tidak membumi.
              Di VENTUREX, setiap kalkulasi peluang berakar pada katalog bukti yang telah dikurasi oleh analis manusia.
            </p>

            <div className="mt-32 flex flex-wrap items-center gap-16">
              <Link
                href="/register"
                className="inline-flex min-h-[44px] items-center justify-center rounded-small-buttons border border-paper-white bg-paper-white px-20 text-body-sm font-w540 text-deep-lagoon transition-colors hover:bg-lilac-mist"
              >
                Mulai dengan Data Terverifikasi
              </Link>
              <a
                href="#simulasi-skor"
                className="inline-flex min-h-[44px] items-center justify-center rounded-small-buttons border border-paper-white/40 px-20 text-body-sm font-w460 text-paper-white transition-colors hover:border-paper-white"
              >
                Coba Simulasi Fit Score &rarr;
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
