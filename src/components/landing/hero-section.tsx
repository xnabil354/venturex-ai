import Image from "next/image";
import Link from "next/link";
import { FloatingGlassDock, FloatingGlassPill, LiveMarketPulseCard, OpportunityFitMockupCard, TrendSignalMockupCard } from "./floating-mockup-card";
import { ArrowRightIcon, CompassIcon, RouteIcon, ShieldCheckIcon, TargetIcon } from "./icons";

export function HeroSection() {
    return (
        <section className="relative w-full h-[100dvh] min-h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#14080e] text-paper-white flex flex-col justify-center items-center pt-64 pb-64">
            {/* Full-Bleed Editorial Background Canvas (100% Edge-to-Edge) */}
            <div className="absolute inset-0 z-0">
                <Image
                    src="/images/hero-editorial.png"
                    alt="Pengusaha F&B meracik minuman artisanal dalam pencahayaan golden-hour"
                    fill
                    priority
                    sizes="100vw"
                    className="object-cover object-center"
                />

                {/* Layered Vignette Overlays for Crisp Typographic & Glass Contrast */}
                <div
                    className="absolute inset-0 bg-gradient-to-b from-[#14080e]/95 via-[#14080e]/50 to-[#14080e]/90 pointer-events-none"
                    aria-hidden="true"
                />
                <div
                    className="absolute inset-0 bg-radial-[circle_at_50%_50%] from-black/60 via-black/30 to-[#14080e]/85 pointer-events-none"
                    aria-hidden="true"
                />

                {/* Ambient Depth Glows */}
                <div
                    className="pointer-events-none absolute -right-32 top-10 h-[520px] w-[520px] rounded-full bg-royal-violet/20 blur-[160px]"
                    aria-hidden="true"
                />
                <div
                    className="pointer-events-none absolute -left-32 bottom-20 h-[520px] w-[520px] rounded-full bg-midnight-wine/40 blur-[160px]"
                    aria-hidden="true"
                />
            </div>

            {/* Centered Editorial Typography & Superhuman Action Group (Primary Focal Point with Generous Negative Space) */}
            <div className="relative z-30 mx-auto max-w-[640px] xl:max-w-[700px] px-16 sm:px-24 text-center my-auto">
                {/* Monumental Headline */}
                <h1 className="text-[32px] leading-[1.12] sm:text-[44px] sm:leading-[1.08] lg:text-[48px] xl:text-[54px] lg:leading-[1.05] font-w460 tracking-tight text-paper-white text-balance">
                    Future Trend Intelligence & Business Growth Navigator untuk Ekosistem Food & Beverage
                </h1>

                {/* Editorial Subheadline */}
                <p className="mt-14 sm:mt-18 text-body-sm sm:text-body font-w460 text-paper-white/80 max-w-[520px] mx-auto leading-relaxed text-balance">
                    Padukan tren terkurasi dengan profil usaha Anda untuk menilai peluang, kesesuaian, risiko, dan langkah validasi berikutnya.
                </p>

                {/* Superhuman Capsule Pill CTA Group */}
                <div className="mt-20 sm:mt-26 flex flex-col sm:flex-row items-center justify-center gap-14 sm:gap-20">
                    <Link
                        href="/register"
                        className="group inline-flex min-h-[50px] items-center gap-14 rounded-pills bg-paper-white pl-24 pr-8 py-6 text-body font-w540 text-midnight-wine transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_10px_32px_rgba(212,199,255,0.45)] active:scale-[0.98]"
                    >
                        <span>Mulai Analisis Peluang</span>
                        <span className="flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-br from-midnight-wine to-royal-violet text-paper-white transition-transform duration-200 group-hover:translate-x-1 shadow-sm">
                            <ArrowRightIcon className="h-16 w-16" />
                        </span>
                    </Link>

                    <a
                        href="#alur-solusi"
                        className="group inline-flex items-center gap-6 text-body-sm font-w460 text-lilac-mist transition-colors hover:text-paper-white py-8"
                    >
                        <span>Pelajari Alur Solusi</span>
                        <ArrowRightIcon className="h-14 w-14 transition-transform duration-200 group-hover:translate-x-1" />
                    </a>
                </div>
            </div>

            {/* Desktop 3D Spatial Floating Glass Constellation (Intentionally Asymmetrical, Perfectly Level, Organic Offsets) */}
            <div className="hidden lg:block absolute inset-0 z-20 pointer-events-none">
                {/* 1. Left Wing Upper Anchor: Trend Intelligence Signal */}
                <div className="absolute lg:left-[24px] xl:left-[36px] 2xl:left-[55px] top-[13%] xl:top-[14%] pointer-events-auto animate-float-1 z-20">
                    <TrendSignalMockupCard className="shadow-[0_24px_50px_-10px_rgba(0,0,0,0.65)] lg:max-w-[270px] xl:max-w-[295px] 2xl:max-w-[325px]" />
                </div>

                {/* 2. Left Wing Clustered Dock: Appears alongside Card 1 on spacious displays (>= 2xl / 1536px) */}
                <div className="hidden 2xl:block absolute 2xl:left-[395px] top-[18%] xl:top-[20%] pointer-events-auto animate-float-2 z-25">
                    <FloatingGlassDock className="shadow-[0_18px_42px_rgba(0,0,0,0.6)]" />
                </div>

                {/* 3. Left Wing Stepped Anchor: Trend preview */}
                <div className="absolute lg:left-[32px] xl:left-[80px] 2xl:left-[260px] bottom-[20%] xl:bottom-[22%] pointer-events-auto animate-float-3 z-20">
                    <LiveMarketPulseCard className="shadow-[0_20px_44px_-10px_rgba(0,0,0,0.6)] scale-[0.98] lg:max-w-[260px] xl:max-w-[290px]" />
                </div>

                {/* 4. Right Wing Satellite: Dummy trend context pill */}
                <div className="absolute lg:right-[80px] xl:right-[140px] 2xl:right-[220px] top-[22%] xl:top-[23%] pointer-events-auto animate-float-1 z-20">
                    <FloatingGlassPill icon={CompassIcon} text="Rempah serai & jahe" />
                </div>

                {/* 5. Right Wing Mid-Low Anchor: Opportunity Fit Engine */}
                <div className="absolute lg:right-[24px] xl:right-[36px] 2xl:right-[65px] top-[32%] xl:top-[34%] pointer-events-auto animate-float-2 z-20">
                    <OpportunityFitMockupCard className="shadow-[0_26px_56px_-12px_rgba(0,0,0,0.7)] lg:max-w-[270px] xl:max-w-[295px] 2xl:max-w-[330px]" />
                </div>

                {/* 6. Right Wing Indented Satellite: Dummy margin pill */}
                <div className="absolute lg:right-[60px] xl:right-[90px] top-[64%] xl:top-[66%] pointer-events-auto animate-float-3 z-20">
                    <FloatingGlassPill icon={ShieldCheckIcon} text="Margin kotor 65%" />
                </div>

                {/* 7. Right Wing Satellite: Dummy risk pill */}
                <div className="absolute lg:right-[160px] xl:right-[200px] bottom-[19%] xl:bottom-[20%] pointer-events-auto animate-float-1 z-20">
                    <FloatingGlassPill icon={TargetIcon} text="BEP 4,2 bulan · Risiko rendah" />
                </div>

                {/* 8. Center-Bottom Organic Satellite: Dummy roadmap pill */}
                <div className="absolute left-[42%] xl:left-[44%] bottom-[5%] xl:bottom-[6%] pointer-events-auto animate-float-2 z-20">
                    <FloatingGlassPill icon={RouteIcon} text="Roadmap 4 pekan" />
                </div>
            </div>
        </section>
    );
}
