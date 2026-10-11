import Link from "next/link";

export function CoreCapabilities() {
  const capabilities = [
    {
      badge: "Katalog Terkurasi",
      code: "TR",
      title: "Trend Radar & Market Signals",
      description:
        "Memantau pergeseran selera konsumen Indonesia secara riil. Setiap tren diverifikasi dengan bukti pasar faktual, indikator momentum, dan analisis siklus hidup produk.",
      bullets: [
        "Pembaruan berkala tanpa tren sintetis/palsu",
        "Klasifikasi 7 kategori dan 6 segmen konsumen",
        "Penilaian tingkat kejenuhan pasar riil",
      ],
      linkText: "Eksplorasi Trend Radar",
      href: "/register",
    },
    {
      badge: "Algoritma Objektif",
      code: "FS",
      title: "Opportunity Fit & Risk Engine",
      description:
        "Tidak semua tren yang viral cocok untuk Anda. Mesin kami menghitung Opportunity Score (potensi pasar) dan Fit Score (kesesuaian modal, keahlian, dan kapasitas Anda).",
      bullets: [
        "Skor personalisasi 0–100 yang transparan",
        "Peringatan risiko operasional & kompetisi",
        "Kalkulasi estimasi kebutuhan modal kerja",
      ],
      linkText: "Uji Skor Kecocokan",
      href: "/register",
    },
    {
      badge: "Panduan Taktis",
      code: "RM",
      title: "Startup & Growth Roadmap",
      description:
        "Dari ide menuju realitas bisnis. Dapatkan rencana aksi bertahap mulai dari perumusan resep, kalkulasi HPP dan penetapan harga, izin edar/halal, hingga strategi peluncuran.",
      bullets: [
        "Milestone mingguan terstruktur",
        "Checklist operasional dapur & legalitas",
        "Metrik evaluasi keberhasilan peluncuran",
      ],
      linkText: "Lihat Contoh Roadmap",
      href: "/register",
    },
  ];

  return (
    <section id="fitur-utama" className="py-64 lg:py-96 bg-warm-parchment scroll-mt-24">
      <div className="mx-auto max-w-[1200px] px-16 sm:px-24">
        <div className="max-w-[760px]">
          <p className="text-caption font-w540 uppercase tracking-wider text-royal-violet">
            Kapabilitas Inti Platform
          </p>
          <h2 className="mt-12 text-heading-lg font-w460 leading-heading-lg tracking-heading-lg text-ink-charcoal text-balance">
            Tiga pilar kecerdasan untuk keputusan bisnis yang matang.
          </h2>
          <p className="mt-16 text-body text-stone-gray text-balance">
            Dibangun dengan filosofi relasional yang ketat, menghubungkan data pasar eksternal dengan realitas kapabilitas internal Anda.
          </p>
        </div>

        {/* 3-Card Grid */}
        <div className="mt-48 grid gap-24 md:grid-cols-3">
          {capabilities.map((item) => (
            <div
              key={item.title}
              className="flex flex-col justify-between rounded-cards border border-soft-mist bg-paper-white p-24 transition-transform duration-200 hover:-translate-y-1"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-32 w-32 items-center justify-center rounded-full bg-lilac-mist text-ink-charcoal text-caption font-bold">
                    {item.code}
                  </span>
                  <span className="rounded-pills border border-soft-mist bg-warm-parchment px-8 py-2 text-[11px] font-w540 text-stone-gray">
                    {item.badge}
                  </span>
                </div>

                <h3 className="mt-20 text-label-bold font-w540 text-ink-charcoal">
                  {item.title}
                </h3>

                <p className="mt-12 text-body-sm text-stone-gray leading-body">
                  {item.description}
                </p>

                <ul className="mt-20 space-y-8 border-t border-soft-mist/60 pt-16 text-caption text-ink-charcoal">
                  {item.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-8">
                      <span className="h-4 w-4 rounded-full bg-royal-violet" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-28 pt-16 border-t border-soft-mist/60">
                <Link
                  href={item.href}
                  className="inline-flex items-center gap-6 text-body-sm font-w460 text-royal-violet transition-[gap] hover:gap-10 hover:underline"
                >
                  <span>{item.linkText}</span>
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
