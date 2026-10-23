import Link from "next/link";

type PrototypeView = "command-center" | "review-desk";

type AdminPanelPrototypePageProps = {
  searchParams: Promise<{ view?: string | string[] }>;
};

const navItems = ["Ringkasan", "Akun", "Kualitas data", "Aktivitas"];

function PrototypeMarker() {
  return (
    <p className="inline-flex items-center gap-8 rounded-pills border border-royal-violet/25 bg-lilac-mist/35 px-10 py-4 text-caption font-w540 uppercase tracking-[0.12em] text-midnight-wine">
      <span aria-hidden="true" className="size-6 rounded-full bg-royal-violet" />
      Prototipe visual · bukan fitur MVP
    </p>
  );
}

function AdminSidebar({ active }: { active: string }) {
  return (
    <aside className="hidden min-h-[40rem] w-56 shrink-0 border-r border-white/10 bg-[#14080e] p-20 text-paper-white lg:flex lg:flex-col">
      <div className="flex items-center gap-8 border-b border-white/10 pb-20">
        <span className="text-[21px] font-w540 tracking-tight">VENTUREX</span>
        <span aria-hidden="true" className="size-8 rounded-full bg-lilac-mist" />
      </div>
      <p className="mt-24 text-caption font-w540 uppercase tracking-[0.16em] text-paper-white/45">Operator workspace</p>
      <nav aria-label="Navigasi contoh" className="mt-12">
        <ul className="grid gap-4">
          {navItems.map((item, index) => {
            const isActive = item === active;
            return (
              <li key={item}>
                <span
                  className={`flex min-h-44 items-center gap-10 rounded-small-buttons px-10 text-body-sm ${isActive ? "bg-white/12 font-w540 text-paper-white" : "text-paper-white/60"}`}
                >
                  <span aria-hidden="true" className={`grid size-20 place-items-center rounded-tabs text-caption ${isActive ? "bg-lilac-mist text-midnight-wine" : "bg-white/10 text-paper-white/70"}`}>
                    0{index + 1}
                  </span>
                  {item}
                </span>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mt-auto border-t border-white/10 pt-16">
        <p className="text-caption text-paper-white/55">Mode demonstrasi</p>
        <p className="mt-4 text-body-sm text-paper-white/80">Tidak terhubung ke data akun.</p>
      </div>
    </aside>
  );
}

function CommandCenter() {
  return (
    <section aria-labelledby="command-center-title" className="overflow-hidden rounded-cards border border-soft-mist bg-paper-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-12 border-b border-soft-mist px-20 py-14 sm:px-28">
        <div className="flex items-center gap-10">
          <span className="grid size-32 place-items-center rounded-small-buttons bg-deep-lagoon text-caption font-w540 text-paper-white">CC</span>
          <p className="text-body-sm font-w540 text-ink-charcoal">Command center</p>
        </div>
        <p className="text-caption text-stone-gray">Contoh data · 22 Okt 2026, 09.30 WIB</p>
      </div>
      <div className="flex">
        <AdminSidebar active="Ringkasan" />
        <div className="min-w-0 flex-1 bg-warm-parchment/55 p-16 sm:p-28">
          <div className="grid gap-20 xl:grid-cols-[minmax(0,1fr)_15rem] xl:items-end">
            <div>
              <PrototypeMarker />
              <h2 id="command-center-title" className="mt-14 max-w-[15ch] text-heading-sm font-w460 tracking-heading-sm text-ink-charcoal sm:text-heading-lg">
                Apa yang butuh perhatian hari ini?
              </h2>
              <p className="mt-10 max-w-[62ch] text-body-sm leading-relaxed text-stone-gray">
                Opsi untuk operator yang perlu membaca kesehatan produk terlebih dahulu, lalu masuk ke antrian paling mendesak.
              </p>
            </div>
            <div className="rounded-cards bg-deep-lagoon p-16 text-paper-white">
              <p className="text-caption font-w540 uppercase tracking-[0.12em] text-lilac-mist">Fokus hari ini</p>
              <p className="mt-8 text-label-bold font-w460">6 item menunggu keputusan</p>
              <p className="mt-8 text-caption leading-relaxed text-paper-white/70">Prioritas diurutkan dari dampak pengguna, bukan volume semata.</p>
            </div>
          </div>

          <div className="mt-24 grid gap-12 sm:grid-cols-3">
            {[
              ["Akun perlu ditinjau", "06", "3 lebih sedikit dari kemarin", "bg-lilac-mist/45 text-midnight-wine"],
              ["Sumber perlu diperbarui", "12", "2 sumber mendekati batas tinjau", "bg-paper-white text-ink-charcoal"],
              ["Laporan tersedia", "24", "Semua selesai diproses", "bg-paper-white text-ink-charcoal"],
            ].map(([label, value, note, tone]) => (
              <article key={label} className={`rounded-cards border border-soft-mist p-16 sm:p-20 ${tone}`}>
                <p className="text-caption font-w540 uppercase tracking-[0.1em] text-stone-gray">{label}</p>
                <p className="mt-10 text-heading-sm font-w460 tracking-heading-sm">{value}</p>
                <p className="mt-12 border-t border-ink-charcoal/10 pt-10 text-caption leading-relaxed text-stone-gray">{note}</p>
              </article>
            ))}
          </div>

          <div className="mt-24 grid gap-16 xl:grid-cols-[minmax(0,1.25fr)_minmax(16rem,.75fr)]">
            <article className="rounded-cards border border-soft-mist bg-paper-white p-16 sm:p-20">
              <div className="flex items-end justify-between gap-12 border-b border-soft-mist pb-14">
                <div>
                  <p className="text-caption font-w540 uppercase tracking-[0.1em] text-royal-violet">Antrian prioritas</p>
                  <h3 className="mt-4 text-label-bold font-w460">Tindakan yang memberi konteks</h3>
                </div>
                <span className="text-caption text-stone-gray">3 dari 6</span>
              </div>
              <ul className="divide-y divide-soft-mist">
                {[
                  ["Validasi profil UMKM", "Informasi bisnis belum lengkap", "Tinggi"],
                  ["Tinjau sumber tren", "Satu sumber membutuhkan pembaruan", "Sedang"],
                  ["Cek anomali laporan", "Perubahan aktivitas di luar pola", "Rendah"],
                ].map(([title, detail, priority], index) => (
                  <li key={title} className="flex gap-12 py-14">
                    <span aria-hidden="true" className="grid size-28 shrink-0 place-items-center rounded-full bg-warm-parchment text-caption font-w540 text-midnight-wine">0{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm font-w540 text-ink-charcoal">{title}</p>
                      <p className="mt-4 text-caption text-stone-gray">{detail}</p>
                    </div>
                    <span className="h-fit rounded-pills border border-soft-mist px-8 py-3 text-caption font-w540 text-stone-gray">{priority}</span>
                  </li>
                ))}
              </ul>
            </article>
            <article className="rounded-cards bg-midnight-wine p-20 text-paper-white">
              <p className="text-caption font-w540 uppercase tracking-[0.12em] text-lilac-mist">Ritme operasional</p>
              <div className="mt-24 space-y-18">
                {[
                  ["09.00", "Antrian verifikasi dibuka"],
                  ["10.30", "Pemeriksaan kualitas data"],
                  ["14.00", "Ringkasan operasional"],
                ].map(([time, event]) => (
                  <div key={time} className="grid grid-cols-[3.5rem_1fr] gap-10 border-l border-lilac-mist/40 pl-12">
                    <p className="text-caption font-w540 text-lilac-mist">{time}</p>
                    <p className="text-body-sm leading-relaxed text-paper-white/80">{event}</p>
                  </div>
                ))}
              </div>
              <p className="mt-28 border-t border-white/15 pt-12 text-caption leading-relaxed text-paper-white/60">Tidak menampilkan data transaksi atau kontrol administratif. Ini hanya arah hierarki informasi.</p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReviewDesk() {
  return (
    <section aria-labelledby="review-desk-title" className="overflow-hidden rounded-cards border border-soft-mist bg-paper-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-12 border-b border-soft-mist px-20 py-14 sm:px-28">
        <div className="flex items-center gap-10">
          <span className="grid size-32 place-items-center rounded-small-buttons bg-midnight-wine text-caption font-w540 text-paper-white">RD</span>
          <p className="text-body-sm font-w540 text-ink-charcoal">Review desk</p>
        </div>
        <p className="text-caption text-stone-gray">Contoh data · antrian kerja</p>
      </div>
      <div className="flex">
        <AdminSidebar active="Akun" />
        <div className="min-w-0 flex-1 p-16 sm:p-28">
          <div className="grid gap-20 border-b border-soft-mist pb-22 xl:grid-cols-[minmax(0,1fr)_15rem] xl:items-end">
            <div>
              <PrototypeMarker />
              <h2 id="review-desk-title" className="mt-14 max-w-[18ch] text-heading-sm font-w460 tracking-heading-sm text-ink-charcoal sm:text-heading-lg">
                Satu keputusan dalam satu waktu.
              </h2>
              <p className="mt-10 max-w-[62ch] text-body-sm leading-relaxed text-stone-gray">
                Opsi yang lebih tenang untuk tim kecil: seluruh layar diarahkan pada pekerjaan review, dengan detail yang mudah dipindai.
              </p>
            </div>
            <div className="rounded-cards border border-midnight-wine bg-lilac-mist/35 p-16">
              <p className="text-caption font-w540 uppercase tracking-[0.12em] text-midnight-wine">Antrian aktif</p>
              <p className="mt-4 text-heading-sm font-w460 tracking-heading-sm text-midnight-wine">06 dossier</p>
              <p className="mt-6 text-caption text-stone-gray">Urutkan berdasarkan SLA dan risiko.</p>
            </div>
          </div>

          <div className="mt-20 grid gap-16 xl:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
            <aside aria-label="Daftar dossier" className="rounded-cards border border-soft-mist bg-warm-parchment/60 p-12">
              <div className="flex items-center justify-between gap-12 border-b border-soft-mist px-8 pb-12">
                <p className="text-caption font-w540 uppercase tracking-[0.1em] text-stone-gray">Pilih dossier</p>
                <span className="rounded-pills bg-paper-white px-8 py-3 text-caption text-stone-gray">06</span>
              </div>
              <ul className="mt-8 grid gap-4">
                {[
                  ["Kedai Sore", "Profil bisnis", "Butuh konteks"],
                  ["Rasa Kota", "Sumber tren", "Diprioritaskan"],
                  ["Dapur Timur", "Pemeriksaan data", "Dijadwalkan"],
                  ["Bumi Bites", "Profil bisnis", "Baru"],
                ].map(([name, type, state], index) => (
                  <li key={name}>
                    <div className={`rounded-small-buttons border p-12 ${index === 0 ? "border-midnight-wine bg-paper-white shadow-sm" : "border-transparent"}`}>
                      <div className="flex items-start justify-between gap-8">
                        <p className="text-body-sm font-w540 text-ink-charcoal">{name}</p>
                        {index === 0 ? <span aria-hidden="true" className="mt-4 size-6 rounded-full bg-royal-violet" /> : null}
                      </div>
                      <p className="mt-4 text-caption text-stone-gray">{type}</p>
                      <p className="mt-8 text-caption font-w540 text-royal-violet">{state}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </aside>

            <article className="rounded-cards border border-soft-mist bg-paper-white p-16 sm:p-20">
              <div className="flex flex-wrap items-start justify-between gap-12 border-b border-soft-mist pb-16">
                <div>
                  <p className="text-caption font-w540 uppercase tracking-[0.1em] text-royal-violet">Dossier 01 · Profil bisnis</p>
                  <h3 className="mt-5 text-heading-sm font-w460 tracking-heading-sm">Kedai Sore</h3>
                </div>
                <span className="rounded-pills border border-royal-violet/25 bg-lilac-mist/35 px-10 py-4 text-caption font-w540 text-midnight-wine">Butuh konteks</span>
              </div>
              <div className="mt-16 grid gap-12 sm:grid-cols-2">
                {[
                  ["Jenis usaha", "Kedai minuman"],
                  ["Wilayah", "Jakarta Selatan"],
                  ["Tahap", "Profil diperiksa"],
                  ["Diperbarui", "Hari ini, 08.45 WIB"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-small-buttons bg-warm-parchment/75 p-12">
                    <p className="text-caption text-stone-gray">{label}</p>
                    <p className="mt-5 text-body-sm font-w540 text-ink-charcoal">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-16 border-l-2 border-royal-violet bg-lilac-mist/20 p-14">
                <p className="text-caption font-w540 uppercase tracking-[0.1em] text-midnight-wine">Catatan review</p>
                <p className="mt-6 text-body-sm leading-relaxed text-ink-charcoal">Pastikan jenis produk utama dilengkapi sebelum data ini dipakai dalam analisis berikutnya.</p>
              </div>
              <div className="mt-16 flex flex-wrap items-center gap-8 border-t border-soft-mist pt-16">
                <span className="inline-flex min-h-44 items-center rounded-small-buttons border border-soft-mist px-12 text-body-sm font-w540 text-stone-gray">Kembalikan untuk lengkapi</span>
                <span className="inline-flex min-h-44 items-center rounded-buttons bg-midnight-wine px-16 text-body-sm font-w540 text-paper-white">Tandai siap ditinjau</span>
                <p className="basis-full pt-4 text-caption leading-relaxed text-stone-gray">Tombol ini hanya contoh visual; tidak menjalankan perubahan status.</p>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function AdminPanelPrototypePage({
  searchParams,
}: AdminPanelPrototypePageProps) {
  const { view } = await searchParams;
  const selectedView: PrototypeView = view === "review-desk" ? "review-desk" : "command-center";

  return (
    <div className="pb-112 pt-32 sm:pt-48">
      <div className="mx-auto w-full max-w-[1440px] px-16 sm:px-24 lg:px-32">
        {selectedView === "command-center" ? <CommandCenter /> : <ReviewDesk />}
      </div>

      <nav aria-label="Pilih opsi prototipe" className="fixed inset-x-0 bottom-16 z-40 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-6 rounded-pills border border-white/15 bg-[#14080e]/95 p-6 text-paper-white shadow-xl backdrop-blur-lg">
        <span className="hidden px-8 text-caption text-paper-white/60 sm:inline">Lihat opsi:</span>
        <Link
          aria-current={selectedView === "command-center" ? "page" : undefined}
          className={`inline-flex min-h-40 items-center rounded-pills px-12 text-caption font-w540 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lilac-mist ${selectedView === "command-center" ? "bg-lilac-mist text-midnight-wine" : "text-paper-white/70 hover:bg-white/10 hover:text-paper-white"}`}
          href="/admin-panel-prototype?view=command-center"
        >
          01 · Command Center
        </Link>
        <Link
          aria-current={selectedView === "review-desk" ? "page" : undefined}
          className={`inline-flex min-h-40 items-center rounded-pills px-12 text-caption font-w540 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lilac-mist ${selectedView === "review-desk" ? "bg-lilac-mist text-midnight-wine" : "text-paper-white/70 hover:bg-white/10 hover:text-paper-white"}`}
          href="/admin-panel-prototype?view=review-desk"
        >
          02 · Review Desk
        </Link>
      </nav>
    </div>
  );
}
