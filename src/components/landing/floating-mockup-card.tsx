import {
  CompassIcon,
  RouteIcon,
  ShieldCheckIcon,
  TargetIcon,
  TrendingUpIcon,
  ZapIcon,
} from "./icons";

export function TrendSignalMockupCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`glass-panel glass-panel-hover w-full max-w-full sm:max-w-[340px] rounded-cards p-16 sm:p-20 text-paper-white cursor-pointer select-none ${className}`}
    >
      <div className="flex items-center justify-between gap-8 border-b border-paper-white/15 pb-12">
        <div className="flex items-center gap-8">
          <span className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-lilac-mist/20 text-lilac-mist border border-lilac-mist/30 shadow-xs">
            <CompassIcon className="h-16 w-16" />
          </span>
          <span className="text-[11px] font-w540 uppercase tracking-widest text-lilac-mist">
            Trend Intelligence
          </span>
        </div>
        <span className="inline-flex items-center gap-6 rounded-pills bg-emerald-500/15 border border-emerald-400/30 px-8 py-2 text-[11px] font-w540 text-emerald-300">
          <span className="h-6 w-6 rounded-full bg-emerald-400 animate-pulse" />
          Emerging
        </span>
      </div>

      <div className="mt-12">
        <span className="text-[11px] text-paper-white/60 block">Kategori: Minuman (Beverages)</span>
        <h4 className="mt-4 text-body font-w540 text-paper-white">
          Botanical &amp; Herb Cold Brew
        </h4>
        <p className="mt-6 text-caption text-paper-white/80 leading-relaxed">
          Pergeseran preferensi konsumen urban ke minuman fungsional rendah gula dengan infusi rempah lokal.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-2 gap-8 rounded-small-buttons bg-white/[0.06] p-10 border border-white/10 text-caption">
        <div>
          <span className="text-[10px] text-paper-white/60 block">Momentum Pasar</span>
          <span className="text-body-sm font-w540 text-emerald-300">+42.6% YoY</span>
        </div>
        <div>
          <span className="text-[10px] text-paper-white/60 block">Validasi Bukti</span>
          <span className="text-body-sm font-w540 text-paper-white">8 Sumber Riil</span>
        </div>
      </div>

      <div className="mt-12 flex items-center gap-8 rounded-pills bg-lilac-mist/10 px-10 py-6 border border-lilac-mist/20 text-[11px] text-lilac-mist">
        <ZapIcon className="h-12 w-12 shrink-0 text-lilac-mist" />
        <span className="truncate">Saran AI: Validasi batch 50 botol pre-order</span>
      </div>
    </div>
  );
}

export function OpportunityFitMockupCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`glass-panel glass-panel-hover w-full max-w-full sm:max-w-[350px] rounded-cards p-16 sm:p-20 text-paper-white cursor-pointer select-none ${className}`}
    >
      <div className="flex items-center justify-between gap-8 border-b border-paper-white/15 pb-12">
        <div className="flex items-center gap-8">
          <span className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-royal-violet/30 text-lilac-mist border border-royal-violet/40 shadow-xs">
            <TargetIcon className="h-16 w-16" />
          </span>
          <span className="text-[11px] font-w540 uppercase tracking-widest text-lilac-mist">
            Decision Engine
          </span>
        </div>
        <span className="text-[11px] font-w540 text-emerald-300">Fit Score 86/100</span>
      </div>

      <div className="mt-12 flex items-start justify-between gap-12">
        <div>
          <h4 className="text-body font-w540 text-paper-white">
            Cold Brew Tea Takeaway Pod
          </h4>
          <span className="text-[11px] text-paper-white/60">Format: Booth Mikro + Pre-Order</span>
        </div>
        <div className="text-right shrink-0">
          <span className="text-heading-sm font-w460 tracking-tight tabular-nums text-paper-white">
            86
          </span>
          <span className="text-[10px] text-paper-white/60 block">/ 100 Skor</span>
        </div>
      </div>

      {/* Score Progress Bar */}
      <div className="mt-10">
        <div className="h-6 w-full overflow-hidden rounded-pills bg-white/15 border border-white/10">
          <div
            className="h-full bg-royal-violet"
            style={{ width: "86%" }}
          />
        </div>
      </div>

      <div className="mt-14 space-y-6 rounded-small-buttons bg-white/[0.06] p-10 border border-white/10 text-caption">
        <div className="flex justify-between text-paper-white">
          <span className="text-paper-white/60">Kesesuaian Modal:</span>
          <span className="font-w540">Rp12 Jt (Tersedia: Rp15 Jt)</span>
        </div>
        <div className="flex justify-between text-paper-white">
          <span className="text-paper-white/60">Profil Risiko:</span>
          <span className="font-w540 text-emerald-300">Terkendali (Low Risk)</span>
        </div>
        <div className="flex justify-between text-paper-white">
          <span className="text-paper-white/60">Kanal Penjualan:</span>
          <span className="font-w540">Delivery + Pickup Stand</span>
        </div>
      </div>
    </div>
  );
}

export function LiveMarketPulseCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`glass-panel glass-panel-hover w-full max-w-full sm:max-w-[320px] rounded-cards p-14 sm:p-16 text-paper-white cursor-pointer select-none ${className}`}
    >
      <div className="flex items-center justify-between border-b border-paper-white/15 pb-10">
        <div className="flex items-center gap-6">
          <span className="h-6 w-6 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-w540 uppercase tracking-widest text-lilac-mist">
            Live Market Pulse
          </span>
        </div>
        <span className="text-[10px] text-paper-white/60">Q4 2026</span>
      </div>

      <div className="mt-10 space-y-8 text-caption">
        <div className="flex items-center justify-between">
          <span className="text-paper-white font-w540 truncate">Artisan Botanical Infusion</span>
          <span className="text-emerald-300 font-w540 text-[11px] shrink-0 ml-8">+42.6%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-paper-white/80 truncate">Cassava &amp; Herb Root Chips</span>
          <span className="text-lilac-mist font-w540 text-[11px] shrink-0 ml-8">+28.4%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-paper-white/80 truncate">Functional Cold Brew Pod</span>
          <span className="text-emerald-300 font-w540 text-[11px] shrink-0 ml-8">+35.1%</span>
        </div>
      </div>
    </div>
  );
}

export function FloatingGlassDock({ className = "" }: { className?: string }) {
  const tools = [
    { icon: CompassIcon, label: "Trend Radar" },
    { icon: TargetIcon, label: "Opportunity Fit Engine" },
    { icon: RouteIcon, label: "Action Roadmap" },
    { icon: TrendingUpIcon, label: "Momentum Pasar" },
    { icon: ShieldCheckIcon, label: "Audit Bukti" },
  ];

  return (
    <div
      className={`glass-dock rounded-full p-8 flex lg:flex-col items-center gap-6 shadow-2xl select-none w-fit h-fit shrink-0 ${className}`}
      role="toolbar"
      aria-label="Venturex Core Toolset"
    >
      {tools.map((t) => {
        const IconComponent = t.icon;
        return (
          <button
            key={t.label}
            type="button"
            title={t.label}
            aria-label={t.label}
            className="group relative flex h-44 w-44 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-paper-white/80 transition-all duration-200 hover:scale-115 hover:bg-white/20 hover:text-lilac-mist active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-lilac-mist"
          >
            <IconComponent className="h-18 w-18" />
            <span className="pointer-events-none absolute left-full ml-12 hidden whitespace-nowrap rounded-small-buttons bg-midnight-wine/95 px-10 py-4 text-[11px] font-w540 text-paper-white border border-white/20 shadow-xl lg:group-hover:block z-50">
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function FloatingGlassPill({
  icon: Icon,
  text,
  className = "",
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  className?: string;
}) {
  return (
    <div
      className={`glass-pill rounded-full px-14 py-8 flex items-center gap-8 text-caption text-paper-white cursor-pointer select-none ${className}`}
    >
      <Icon className="h-14 w-14 shrink-0 text-lilac-mist" />
      <span className="whitespace-nowrap font-w540">{text}</span>
    </div>
  );
}
