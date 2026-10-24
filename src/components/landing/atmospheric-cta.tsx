import Link from "next/link";

export function AtmosphericCta() {
  return (
    <section className="relative overflow-hidden border-t border-white/10 bg-deep-lagoon py-48 text-paper-white shadow-2xl sm:py-64 lg:py-80">
      {/* Decorative Radial Atmospheric Glows in Green & Emerald Tokens */}
      <div
        className="pointer-events-none absolute -top-40 -left-40 h-[400px] w-[400px] rounded-full bg-emerald-400/20 blur-[140px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 h-[450px] w-[450px] rounded-full bg-emerald-300/15 blur-[150px]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1200px] px-16 sm:px-24">
        <div className="flex flex-col items-start justify-between gap-32 lg:flex-row lg:items-center">
          <div className="max-w-[720px]">
            <span className="text-caption font-w540 uppercase tracking-widest text-emerald-300">
              Siap Memulai Keputusan yang Lebih Cerdas?
            </span>
          <h2 className="mt-16 text-heading-sm font-w460 leading-heading-sm tracking-heading-sm text-paper-white sm:text-heading-lg sm:leading-heading-lg sm:tracking-heading-lg lg:text-display lg:leading-display lg:tracking-display text-balance">
              Bangun bisnis kuliner dengan fondasi data pasar yang kuat.
            </h2>
            <p className="mt-16 text-body font-w460 text-paper-white/85 leading-body max-w-[560px]">
              Buat akun, lengkapi profil modal atau usaha Anda, lalu telaah peluang, skor, risiko, dan bukti yang tersedia sebelum mengambil langkah berikutnya.
            </p>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-12 sm:w-auto sm:flex-row lg:flex-col lg:items-stretch">
            <Link
              href="/register"
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-8 rounded-buttons bg-paper-white px-28 text-body font-w540 text-deep-lagoon shadow-md transition-[background-color,transform] hover:bg-emerald-100/90 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-deep-lagoon sm:w-auto"
            >
              <span>Daftar Sekarang &mdash; Gratis</span>
              <span aria-hidden="true">&rarr;</span>
            </Link>

            <Link
              href="/login"
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-small-buttons border border-paper-white/30 bg-paper-white/10 px-20 text-center text-body-sm font-w460 text-paper-white transition-colors hover:bg-paper-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-deep-lagoon sm:w-auto"
            >
              Sudah punya akun? Masuk
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
