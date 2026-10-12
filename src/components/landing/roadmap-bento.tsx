import Link from "next/link";

export function RoadmapBento() {
  const steps = [
    {
      week: "Minggu 01",
      title: "Validasi Resep & Sensory Test",
      desc: "Uji panel rasa terukur, standarisasi takaran gramasi, dan penentuan shelf-life bahan.",
      status: "Fondasi",
    },
    {
      week: "Minggu 02",
      title: "Kalkulasi HPP & Penetapan Harga",
      desc: "Perhitungan food-cost < 38%, penetapan harga jual kompetitif, dan target margin kotor.",
      status: "Finansial",
    },
    {
      week: "Minggu 03",
      title: "Perizinan & Legalitas Usaha",
      desc: "Pendaftaran NIB, pengajuan izin P-IRT atau sertifikasi Halal self-declare melalui sistem terpadu.",
      status: "Kepatuhan",
    },
    {
      week: "Minggu 04",
      title: "Peluncuran Kanal & Go-to-Market",
      desc: "Setup akun merchant delivery (GrabFood, GoFood), kampanye pre-order, dan pembukaan gerai.",
      status: "Peluncuran",
    },
  ];

  return (
    <section id="alur-roadmap" className="py-64 lg:py-96 bg-paper-white border-t border-soft-mist scroll-mt-24">
      <div className="mx-auto max-w-[1200px] px-16 sm:px-24">
        {/* Section Header */}
        <div className="mx-auto max-w-[760px] text-center">
          <span className="inline-flex items-center gap-8 rounded-pills bg-warm-parchment px-12 py-4 text-caption font-w540 uppercase tracking-widest text-royal-violet border border-soft-mist">
            <span className="h-6 w-6 rounded-full bg-royal-violet" />
            VENTUREX Action Roadmap
          </span>

          <h2 className="mt-16 text-heading-lg font-w460 leading-heading-lg tracking-heading-lg text-ink-charcoal sm:text-display sm:leading-display sm:tracking-display text-balance">
            Panduan eksekusi bertahap dari ide menuju pembukaan gerai.
          </h2>

          <p className="mt-16 text-body text-stone-gray text-balance max-w-[620px] mx-auto">
            Hilangkan kebingungan &ldquo;harus mulai dari mana&rdquo;. Setiap peluang dilengkapi rencana kerja taktis mingguan yang dapat dieksekusi langsung.
          </p>

          <div className="mt-28 flex items-center justify-center gap-16">
            <Link
              href="/register"
              className="inline-flex min-h-[44px] items-center justify-center rounded-buttons bg-midnight-wine px-20 text-body-sm font-w460 text-paper-white hover:bg-midnight-wine/90"
            >
              Dapatkan Roadmap Anda
            </Link>
            <a
              href="#simulasi-skor"
              className="inline-flex items-center gap-6 text-body-sm font-w460 text-royal-violet hover:underline"
            >
              <span>Uji Simulasi Peluang</span>
              <span aria-hidden="true">&rarr;</span>
            </a>
          </div>
        </div>

        {/* Bento Grid (Superhuman Docs Style) */}
        <div className="mt-48 grid gap-20 lg:grid-cols-12">
          {/* Top Wide Bento: Weekly Milestone Stages */}
          <div className="lg:col-span-12 rounded-cards bg-warm-parchment p-24 sm:p-40 border border-soft-mist shadow-sm">
            <div className="flex items-center justify-between border-b border-soft-mist pb-16">
              <div>
                <span className="text-caption font-w540 uppercase tracking-wider text-royal-violet">
                  Alur Kerja 4 Pekan Terarah
                </span>
                <h3 className="mt-4 text-label-bold font-w540 text-ink-charcoal">
                  Milestone Startup & Growth Navigator
                </h3>
              </div>
              <span className="text-caption text-stone-gray hidden sm:inline">
                Terintegrasi dengan SOP F&B Standar
              </span>
            </div>

            <div className="mt-24 grid gap-16 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((s, idx) => (
                <div
                  key={s.week}
                  className="rounded-small-buttons bg-paper-white p-16 border border-soft-mist/80 shadow-xs flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg hover:border-royal-violet/40 cursor-default"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-pills bg-warm-parchment px-8 py-2 text-[11px] font-w540 text-stone-gray">
                        Tahap 0{idx + 1}
                      </span>
                      <span className="text-caption font-w540 text-royal-violet">{s.week}</span>
                    </div>
                    <h4 className="mt-12 text-body-sm font-w540 text-ink-charcoal leading-snug">
                      {s.title}
                    </h4>
                    <p className="mt-8 text-caption text-stone-gray leading-relaxed">
                      {s.desc}
                    </p>
                  </div>
                  <div className="mt-16 pt-8 border-t border-soft-mist/60 text-[11px] text-stone-gray">
                    Fokus: <strong className="font-w540 text-ink-charcoal">{s.status}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Left Bento: Calon Pengusaha */}
          <div className="lg:col-span-6 rounded-cards bg-paper-white p-24 sm:p-32 border border-soft-mist shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-royal-violet/30">
            <span className="text-caption font-w540 uppercase tracking-wider text-royal-violet">
              Untuk Pemula
            </span>
            <h3 className="mt-12 text-heading-sm font-w460 tracking-heading-sm text-ink-charcoal">
              Startup Roadmap: Perlindungan Modal Awal
            </h3>
            <p className="mt-8 text-body-sm text-stone-gray">
              Membimbing Anda dari nol tabungan pribadi menuju transaksi pertama tanpa terjebak sewa tempat mahal atau peralatan yang belum dibutuhkan.
            </p>
            <ul className="mt-16 space-y-6 text-caption text-ink-charcoal">
              <li className="flex items-center gap-6">
                <span className="h-4 w-4 rounded-full bg-emerald-600" />
                <span>Rekomendasi format booth hemat modal</span>
              </li>
              <li className="flex items-center gap-6">
                <span className="h-4 w-4 rounded-full bg-emerald-600" />
                <span>Checklist legalitas dasar NIB & izin edar</span>
              </li>
            </ul>
          </div>

          {/* Bottom Right Bento: UMKM Existing */}
          <div className="lg:col-span-6 rounded-cards bg-paper-white p-24 sm:p-32 border border-soft-mist shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-royal-violet/30">
            <span className="text-caption font-w540 uppercase tracking-wider text-royal-violet">
              Untuk Bisnis Berjalan
            </span>
            <h3 className="mt-12 text-heading-sm font-w460 tracking-heading-sm text-ink-charcoal">
              Growth Roadmap: Inovasi Menu & Ekspansi
            </h3>
            <p className="mt-8 text-body-sm text-stone-gray">
              Membantu pemilik kedai atau dapur yang sudah aktif untuk menguji lini menu komplementer baru tanpa mengganggu operasional harian.
            </p>
            <ul className="mt-16 space-y-6 text-caption text-ink-charcoal">
              <li className="flex items-center gap-6">
                <span className="h-4 w-4 rounded-full bg-emerald-600" />
                <span>Pemanfaatan alat dapur & bahan yang sudah ada</span>
              </li>
              <li className="flex items-center gap-6">
                <span className="h-4 w-4 rounded-full bg-emerald-600" />
                <span>Optimasi basket-size dan bundling menu sore</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
