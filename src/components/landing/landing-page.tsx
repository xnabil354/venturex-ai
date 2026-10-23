import { AtmosphericCta } from "./atmospheric-cta";
import { HeroSection } from "./hero-section";
import { InteractiveSpecimen } from "./interactive-specimen";
import { LandingFooter } from "./landing-footer";
import { LandingHeader } from "./landing-header";
import { PricingSection } from "./pricing-section";
import { RoadmapBento } from "./roadmap-bento";
import { SuiteTabStrip } from "./suite-tab-strip";
import { TrendRadarBento } from "./trend-radar-bento";
import { TrustMetricsStrip } from "./trust-metrics-strip";
import type { PublicPricingSnapshot } from "@/billing/public-pricing";

export function LandingPage({
  isAuthenticated = false,
  pricing = null,
  userEmail,
}: Readonly<{
  isAuthenticated?: boolean;
  pricing?: PublicPricingSnapshot | null;
  userEmail?: string;
}>) {
  return (
    <div className="min-h-screen bg-warm-parchment text-ink-charcoal antialiased flex flex-col">
      {/* Fixed Transparent Editorial Navigation */}
      <LandingHeader {...(userEmail ? { userEmail } : {})} />

      {/* Main Page Flow (Superhuman Cadence) */}
      <main className="flex-1">
        {/* 1. Hero with Split Dark Wine Ground, Toolkit Switcher, & Window Mockup */}
        <HeroSection />

        {/* 2. 6-Cell Social Proof & Integrity Benchmark Strip */}
        <TrustMetricsStrip />

        {/* 3. Suite Product 1: Trend Radar Bento Grid & Sub-Tabs */}
        <TrendRadarBento />

        {/* 4. Suite Product 2: Dual Persona Interactive Tab Strip (Calon Pengusaha vs UMKM) */}
        <SuiteTabStrip />

        {/* 5. Interactive Specimen / Calculator Simulator */}
        <InteractiveSpecimen />

        {/* 6. Suite Product 3: Collaborative Action Roadmap Bento */}
        <RoadmapBento />

        <PricingSection isAuthenticated={isAuthenticated} pricing={pricing} />

        {/* 7. Atmospheric Green Conversion Call-to-Action */}
        <AtmosphericCta />
      </main>

      {/* 10. 4-Column Midnight Wine Footer with Giant Ghost Watermark */}
      <LandingFooter />
    </div>
  );
}
