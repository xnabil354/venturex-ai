export function TrustMetricsStrip() {
  const metrics = [
    {
      label: "Tren terkurasi",
      value: "Dengan sumber",
      detail: "Setiap tren memuat bukti dan konteks",
    },
    {
      label: "Jalur pengguna",
      value: "2 Persona",
      detail: "Calon pengusaha dan UMKM aktif",
    },
    {
      label: "Fit Score",
      value: "0–100",
      detail: "Indikator kesesuaian berbasis profil",
    },
    {
      label: "Opportunity Score",
      value: "0–100",
      detail: "Indikator peluang dari data tersedia",
    },
    {
      label: "Batasan jelas",
      value: "Bukan jaminan",
      detail: "Skor mendukung, bukan menggantikan keputusan",
    },
    {
      label: "Misi Berkelanjutan",
      value: "SDG 8",
      detail: "Pertumbuhan ekonomi produktif",
    },
  ];

  return (
    <section id="kualitas-data" className="border-y border-soft-mist bg-paper-white py-32 scroll-mt-24" aria-label="Standar Validasi Data">
      <div className="mx-auto max-w-[1200px] px-16 sm:px-24">
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-soft-mist">
          {metrics.map((item) => (
            <div
              key={item.label}
              className="group px-12 py-16 text-center first:pt-0 sm:first:pt-16 last:pb-0 sm:last:pb-16 transition-all duration-200 hover:-translate-y-1 hover:bg-warm-parchment/70 hover:shadow-xs rounded-cards cursor-default"
            >
              <span className="block text-heading-sm font-w460 tracking-heading-sm text-ink-charcoal tabular-nums">
                {item.value}
              </span>
              <span className="mt-4 block text-body-sm font-w540 text-ink-charcoal">
                {item.label}
              </span>
              <span className="mt-2 block text-caption text-stone-gray">
                {item.detail}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
