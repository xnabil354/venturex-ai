import Link from "next/link";

export function TestimonialBand() {
  return (
    <section className="w-full bg-lilac-mist/40 py-64 lg:py-80 text-ink-charcoal border-y border-soft-mist/80">
      <div className="mx-auto max-w-[860px] px-16 text-center sm:px-24">
        <p className="text-caption font-w540 uppercase tracking-widest text-royal-violet">
          Kisah Nyata Validasi Keputusan
        </p>

        <blockquote className="mt-20">
          <p className="text-subheading font-w460 leading-subheading text-ink-charcoal sm:text-heading-sm sm:leading-heading-sm text-balance">
            &ldquo;VENTUREX menyelamatkan modal tabungan saya dari membuka gerai minuman yang sudah jenuh.
            Dengan Fit Score 88, saya beralih ke artisan tea & botanical cold-brew pod dan mencapai titik balik modal dalam 3 bulan.&rdquo;
          </p>
        </blockquote>

        <div className="mt-24">
          <strong className="block text-body-sm font-w540 text-ink-charcoal">
            Rian Pratama
          </strong>
          <span className="block text-caption text-stone-gray">
            Founder Botanical Brew Stand &middot; Eks-Karyawan Swasta, Jakarta
          </span>
        </div>

        <div className="mt-20">
          <Link
            href="/register"
            className="inline-flex items-center gap-6 text-body-sm font-w460 text-royal-violet hover:underline"
          >
            <span>Pelajari studi kasus dan mulai analisis Anda</span>
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
