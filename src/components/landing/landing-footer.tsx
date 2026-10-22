import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="w-full bg-midnight-wine py-64 text-paper-white">
      <div className="mx-auto max-w-[1200px] px-16 sm:px-24">
        {/* Brand Header inside Footer */}
        <div className="flex flex-col items-start justify-between gap-16 border-b border-paper-white/15 pb-32 sm:flex-row sm:items-center">
          <div className="flex items-center gap-8">
            <span className="h-8 w-8 rounded-full bg-lilac-mist" aria-hidden="true" />
            <span className="font-w540 text-heading-sm tracking-tight text-paper-white">
              VENTUREX AI
            </span>
          </div>
          <p className="text-body-sm font-w460 text-paper-white/70 max-w-[480px]">
            Future Trend Intelligence & Business Growth Navigator untuk Ekosistem Food & Beverage Indonesia.
          </p>
        </div>

        {/* 4-Column Navigation */}
        <div className="mt-40 grid gap-32 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <h3 className="text-caption font-bold uppercase tracking-wider text-paper-white">
              Solusi Produk
            </h3>
            <ul className="mt-16 space-y-12 text-body-sm font-w460 text-paper-white/70">
              <li>
                <a href="#fitur-utama" className="transition-colors hover:text-paper-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist rounded-sm">
                  Trend Radar
                </a>
              </li>
              <li>
                <a href="#fitur-utama" className="transition-colors hover:text-paper-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist rounded-sm">
                  Opportunity Finder
                </a>
              </li>
              <li>
                <a href="#simulasi-skor" className="transition-colors hover:text-paper-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist rounded-sm">
                  Personal Fit Score Engine
                </a>
              </li>
              <li>
                <a href="#alur-solusi" className="transition-colors hover:text-paper-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist rounded-sm">
                  Startup Roadmap (Calon Pengusaha)
                </a>
              </li>
              <li>
                <a href="#alur-solusi" className="transition-colors hover:text-paper-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist rounded-sm">
                  Growth Roadmap (UMKM Existing)
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-caption font-bold uppercase tracking-wider text-paper-white">
              Persona Pengguna
            </h3>
            <ul className="mt-16 space-y-12 text-body-sm font-w460 text-paper-white/70">
              <li>
                <a href="#alur-solusi" className="transition-colors hover:text-paper-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist rounded-sm">
                  Calon Pengusaha (Discover &rarr; Start)
                </a>
              </li>
              <li>
                <a href="#alur-solusi" className="transition-colors hover:text-paper-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist rounded-sm">
                  UMKM F&B (Discover &rarr; Grow)
                </a>
              </li>
              <li>
                <Link href="/register" className="transition-colors hover:text-paper-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist rounded-sm">
                  Pendaftaran Akun Baru
                </Link>
              </li>
              <li>
                <Link href="/login" className="transition-colors hover:text-paper-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist rounded-sm">
                  Portal Masuk Pengguna
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-caption font-bold uppercase tracking-wider text-paper-white">
              Metodologi & Data
            </h3>
            <ul className="mt-16 space-y-12 text-body-sm font-w460 text-paper-white/70">
              <li>
                <a href="#kualitas-data" className="transition-colors hover:text-paper-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist rounded-sm">
                  Standar Bukti Pasar Terkurasi
                </a>
              </li>
              <li>
                <a href="#kualitas-data" className="transition-colors hover:text-paper-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist rounded-sm">
                  Transparansi Zero-Hallucination
                </a>
              </li>
              <li>
                <a href="#simulasi-skor" className="transition-colors hover:text-paper-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist rounded-sm">
                  Model Evaluasi 4-Pilar
                </a>
              </li>
              <li>
                <span className="text-paper-white/50 cursor-default">
                  Komitmen Dampak SDG 8
                </span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-caption font-bold uppercase tracking-wider text-paper-white">
              Platform & Keamanan
            </h3>
            <ul className="mt-16 space-y-12 text-body-sm font-w460 text-paper-white/70">
              <li>
                <span className="text-paper-white/50 cursor-default">
                  Arsitektur Next.js & PostgreSQL
                </span>
              </li>
              <li>
                <span className="text-paper-white/50 cursor-default">
                  Standar Enkripsi Argon2id
                </span>
              </li>
              <li>
                <span className="text-paper-white/50 cursor-default">
                  Kebijakan Privasi Data Profil
                </span>
              </li>
              <li>
                <span className="text-paper-white/50 cursor-default">
                  Syarat Layanan & Ketentuan
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-48 flex flex-col items-start justify-between gap-12 border-t border-paper-white/15 pt-24 text-caption text-paper-white/60 sm:flex-row sm:items-center">
          <p>
            &copy; {new Date().getFullYear()} VENTUREX AI. Semua hak cipta dilindungi undang-undang.
          </p>
          <p className="flex items-center gap-6">
            <span className="h-8 w-8 rounded-full bg-emerald-400" aria-hidden="true" />
            <span>Mendukung SDG 8: Pertumbuhan Ekonomi Inklusif & Berkelanjutan.</span>
          </p>
        </div>

        {/* Giant Ghost Watermark (Superhuman Style) */}
        <div className="mt-40 select-none text-center overflow-hidden" aria-hidden="true">
          <span className="text-[60px] sm:text-[100px] md:text-[140px] lg:text-[170px] font-bold tracking-widest text-paper-white/[0.05] leading-none block">
            VENTUREX
          </span>
        </div>
      </div>
    </footer>
  );
}
