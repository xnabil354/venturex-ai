export function LandingFooter() {
  return (
    <footer className="w-full bg-midnight-wine py-48 text-paper-white sm:py-64">
      <div className="mx-auto max-w-[1200px] px-16 sm:px-24">
        <div className="border-b border-paper-white/15 pb-32">
          <div className="max-w-[400px] xl:max-w-none">
            <div className="flex items-center gap-8">
              <span className="h-8 w-8 rounded-full bg-lilac-mist" aria-hidden="true" />
              <span className="font-w540 text-heading-sm tracking-tight text-paper-white">
                VENTUREX AI
              </span>
            </div>
            <nav aria-label="Solusi Produk" className="mt-32 sm:mt-40">
              <h3 className="text-caption font-bold uppercase tracking-wider text-paper-white">
                Solusi Produk
              </h3>
              <ul className="mt-16 flex flex-col gap-y-10 text-body-sm font-w460 text-paper-white/70 xl:flex-row xl:flex-nowrap xl:gap-x-12 xl:gap-y-0">
                <li>
                  <a href="#fitur-utama" className="inline-flex min-h-[44px] items-center rounded-sm transition-colors hover:text-paper-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist">
                    Trend Radar
                  </a>
                </li>
                <li>
                  <a href="#fitur-utama" className="inline-flex min-h-[44px] items-center rounded-sm transition-colors hover:text-paper-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist">
                    Opportunity Finder
                  </a>
                </li>
                <li>
                  <a href="#simulasi-skor" className="inline-flex min-h-[44px] items-center rounded-sm transition-colors hover:text-paper-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist">
                    Personal Fit Score Engine
                  </a>
                </li>
                <li>
                  <a href="#alur-solusi" className="inline-flex min-h-[44px] items-center rounded-sm transition-colors hover:text-paper-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist">
                    Startup Roadmap (Calon Pengusaha)
                  </a>
                </li>
                <li>
                  <a href="#alur-solusi" className="inline-flex min-h-[44px] items-center rounded-sm transition-colors hover:text-paper-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist">
                    Growth Roadmap (UMKM Existing)
                  </a>
                </li>
              </ul>
            </nav>
          </div>
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
