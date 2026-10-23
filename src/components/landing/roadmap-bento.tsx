import Link from "next/link";

export function RoadmapBento() {
  const steps = [
    {
      week: "Tahap awal",
      title: "Pilih peluang untuk divalidasi",
      desc: "Mulai dari peluang yang telah disimpan beserta skor, risiko, dan bukti yang tersedia.",
      status: "Fokus",
    },
    {
      week: "Tahap analisis",
      title: "Telaah asumsi dan kebutuhan",
      desc: "Tinjau konteks peluang, kebutuhan yang belum diketahui, serta batasan data yang perlu Anda lengkapi.",
      status: "Kejelasan",
    },
    {
      week: "Tahap validasi",
      title: "Jalankan eksperimen terarah",
      desc: "Gunakan langkah praktis untuk menguji asumsi peluang sesuai tahap usaha Anda.",
      status: "Pembelajaran",
    },
    {
      week: "Tahap keputusan",
      title: "Tinjau hasil dan tentukan langkah",
      desc: "Gunakan hasil validasi untuk melanjutkan, merevisi, atau menghentikan arah yang diuji.",
      status: "Keputusan",
    },
  ];

  return (
    <section id="alur-roadmap" className="py-64 lg:py-96 bg-paper-white border-t border-soft-mist scroll-mt-24">
      <div className="mx-auto max-w-[1200px] px-16 sm:px-24">
        {/* Section Header */}
        <div className="mx-auto max-w-[1200px] text-center">
          <span className="inline-flex items-center gap-8 rounded-pills bg-warm-parchment px-12 py-4 text-caption font-w540 uppercase tracking-widest text-royal-violet border border-soft-mist">
            <span className="h-6 w-6 rounded-full bg-royal-violet" />
            VENTUREX Action Roadmap
          </span>

          <h2 className="mt-16 text-heading-lg font-w460 leading-heading-lg tracking-heading-lg text-ink-charcoal sm:text-display sm:leading-display sm:tracking-display text-balance">
            Roadmap validasi untuk mengambil langkah berikutnya.
          </h2>

          <p className="mt-16 text-body text-stone-gray text-balance max-w-[620px] mx-auto">
            Setelah menyimpan peluang yang telah dianalisis, Anda dapat membuat panduan langkah bertahap sesuai persona dan konteks usaha.
          </p>

          <div className="mt-28 flex items-center justify-center gap-16">
            <Link
              href="/register"
              className="inline-flex min-h-[44px] items-center justify-center rounded-buttons bg-midnight-wine px-20 text-body-sm font-w460 text-paper-white hover:bg-midnight-wine/90 focus-visible:outline-2 focus-visible:outline-royal-violet focus-visible:outline-offset-2"
            >
              Dapatkan Roadmap Anda
            </Link>
            <a
              href="#simulasi-skor"
              className="inline-flex min-h-[44px] items-center gap-6 px-4 py-8 rounded-sm text-body-sm font-w460 text-royal-violet hover:underline focus-visible:outline-2 focus-visible:outline-royal-violet focus-visible:outline-offset-2"
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
                  Alur validasi bertahap
                </span>
                <h3 className="mt-4 text-label-bold font-w540 text-ink-charcoal">
                  Startup dan Growth Roadmap
                </h3>
              </div>
              <span className="text-caption text-stone-gray hidden sm:inline">
                Tahap dapat berbeda menurut persona dan data yang tersedia
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
              Startup Roadmap: Validasi sebelum memulai
            </h3>
            <p className="mt-8 text-body-sm text-stone-gray">
              Membantu calon pengusaha menguji masalah, pelanggan, dan kelayakan awal dari peluang yang sudah dianalisis.
            </p>
            <ul className="mt-16 space-y-6 text-caption text-ink-charcoal">
              <li className="flex items-center gap-6">
                <span className="h-4 w-4 rounded-full bg-emerald-600" />
                <span>Langkah validasi pelanggan dan masalah</span>
              </li>
              <li className="flex items-center gap-6">
                <span className="h-4 w-4 rounded-full bg-emerald-600" />
                <span>Keputusan lanjut, revisi, atau berhenti</span>
              </li>
            </ul>
          </div>

          {/* Bottom Right Bento: UMKM Existing */}
          <div className="lg:col-span-6 rounded-cards bg-paper-white p-24 sm:p-32 border border-soft-mist shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-royal-violet/30">
            <span className="text-caption font-w540 uppercase tracking-wider text-royal-violet">
              Untuk Bisnis Berjalan
            </span>
            <h3 className="mt-12 text-heading-sm font-w460 tracking-heading-sm text-ink-charcoal">
              Growth Roadmap: Uji peluang untuk bisnis berjalan
            </h3>
            <p className="mt-8 text-body-sm text-stone-gray">
              Membantu UMKM menilai peluang yang relevan dengan produk, pelanggan, harga, dan kanal penjualan yang sudah dimiliki.
            </p>
            <ul className="mt-16 space-y-6 text-caption text-ink-charcoal">
              <li className="flex items-center gap-6">
                <span className="h-4 w-4 rounded-full bg-emerald-600" />
                <span>Langkah eksperimen sesuai konteks bisnis</span>
              </li>
              <li className="flex items-center gap-6">
                <span className="h-4 w-4 rounded-full bg-emerald-600" />
                <span>Evaluasi hasil sebelum mengambil keputusan</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
