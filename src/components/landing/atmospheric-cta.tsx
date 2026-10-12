import Link from "next/link";

export function AtmosphericCta() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-r from-royal-violet/90 via-midnight-wine to-deep-lagoon py-64 lg:py-80 text-paper-white shadow-2xl">
      {/* Decorative Radial Atmospheric Glows */}
      <div
        className="pointer-events-none absolute -top-40 -left-40 h-[400px] w-[400px] rounded-full bg-cyan-400/20 blur-[130px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 h-[450px] w-[450px] rounded-full bg-lilac-mist/25 blur-[140px]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1200px] px-16 sm:px-24">
        <div className="flex flex-col items-start justify-between gap-32 lg:flex-row lg:items-center">
          <div className="max-w-[720px]">
            <span className="text-caption font-w540 uppercase tracking-widest text-lilac-mist">
              Siap Memulai Keputusan yang Lebih Cerdas?
            </span>
            <h2 className="mt-16 text-heading-lg font-w460 leading-heading-lg tracking-heading-lg text-paper-white sm:text-display sm:leading-display sm:tracking-display text-balance">
              Bangun bisnis kuliner dengan fondasi data pasar yang kuat.
            </h2>
            <p className="mt-16 text-body font-w460 text-paper-white/85 leading-body max-w-[560px]">
              Daftar dalam 2 menit, isi profil modal atau usaha Anda, dan biarkan sistem memetakan peluang terbaik dengan risiko terukur.
            </p>
          </div>

          <div className="flex flex-col gap-12 sm:flex-row lg:flex-col lg:items-stretch shrink-0">
            <Link
              href="/register"
              className="inline-flex min-h-[48px] items-center justify-center gap-8 rounded-buttons bg-paper-white px-28 text-body font-w540 text-midnight-wine transition-[background-color,transform] hover:bg-lilac-mist active:translate-y-px shadow-md"
            >
              <span>Daftar Sekarang &mdash; Gratis</span>
              <span aria-hidden="true">&rarr;</span>
            </Link>

            <Link
              href="/login"
              className="inline-flex min-h-[44px] items-center justify-center rounded-small-buttons border border-paper-white/30 bg-paper-white/10 px-20 text-body-sm font-w460 text-paper-white transition-colors hover:bg-paper-white/20 text-center"
            >
              Sudah punya akun? Masuk
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
