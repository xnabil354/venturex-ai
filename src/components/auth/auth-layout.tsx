import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { ArrowLeftIcon } from "./auth-icons";

export function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
    return (
        <main className="min-h-screen bg-warm-parchment text-ink-charcoal selection:bg-lilac-mist">
            <div className="grid min-h-screen lg:grid-cols-12">
                {/* Left Form Column */}
                <section className="flex flex-col justify-between px-16 py-24 sm:px-32 sm:py-36 lg:col-span-7 xl:col-span-6 lg:px-48 lg:py-40">
                    {/* Header Bar */}
                    <header className="flex items-center justify-between">
                        <Link
                            className="inline-flex items-center gap-6 text-body-sm font-w460 text-stone-gray transition-colors hover:text-midnight-wine"
                            href="/"
                        >
                            <ArrowLeftIcon className="h-16 w-16" />
                            <span>Kembali ke Beranda</span>
                        </Link>
                    </header>

                    {/* Form Container */}
                    <div className="mx-auto w-full max-w-[460px] py-28 sm:py-40">{children}</div>

                    {/* Centered Editorial Footnote */}
                    <footer className="border-t border-soft-mist/60 pt-16 text-center text-caption text-stone-gray">
                        <p>VENTUREX AI &copy; 2026 &middot; Platform Intelijen Keputusan Bisnis Kuliner Presisi</p>
                    </footer>
                </section>

                {/* Right Editorial Visual Column (Option B: Pure Photography + Editorial Voice, No Fake Widgets) */}
                <aside
                    aria-label="Editorial visual VENTUREX"
                    className="hidden lg:relative lg:flex lg:col-span-5 xl:col-span-6 p-16 xl:p-24 bg-warm-parchment"
                >
                    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden rounded-[24px] border border-soft-mist bg-[#14080e] p-36 xl:p-48 text-paper-white shadow-lg">
                        {/* Background Photography Canvas */}
                        <div className="absolute inset-0 z-0">
                            <Image
                                alt="Pengusaha F&B meracik minuman artisanal dalam pencahayaan golden-hour"
                                className="object-cover object-center"
                                fill
                                priority
                                sizes="(min-width: 1280px) 50vw, (min-width: 1024px) 42vw, 100vw"
                                src="/images/hero-editorial.png"
                            />

                            {/* Quiet Natural Vignette */}
                            <div
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#14080e]/95 via-[#14080e]/40 to-transparent"
                            />
                        </div>

                        {/* Top Subdued Label */}
                        <div className="relative z-10">
                            <span className="text-caption font-w540 uppercase tracking-widest text-paper-white/70">
                                VENTUREX &middot; Kurasi Peluang F&amp;B
                            </span>
                        </div>

                        {/* Bottom Authentic Editorial Statement */}
                        <div className="relative z-10 max-w-[480px] border-t border-white/15 pt-24">
                            <blockquote className="text-[20px] font-w460 leading-snug tracking-tight text-paper-white">
                                &ldquo;Keputusan bisnis kuliner yang presisi lahir dari data pasar riil, bukan tebak-tebakan modal.&rdquo;
                            </blockquote>
                            <p className="mt-12 text-caption font-w460 text-lilac-mist">
                                Memandu langkah pengusaha dari sinyal tren hingga eksekusi tervalidasi.
                            </p>
                        </div>
                    </div>
                </aside>
            </div>
        </main>
    );
}
