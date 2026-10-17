# VENTUREX Design System — Style Reference
> Golden Hour Editorial Software & Bento Studio Identity

**Theme:** Warm Editorial Light with Dark Wine Framing
**Canvas:** `#f2f0eb` (Warm Parchment)
**Framing & Hero Ground:** `#14080e` / `#421d24` (Midnight Wine)

VENTUREX sits at the intersection of artisanal culinary culture and precision software intelligence. It fuses a warm parchment editorial canvas with deep-wine framing, dark-lagoon feature moments, and vibrant lilac & violet brand punctuation. Visual depth is established through thoughtful spatial layering, hairline borders, and tactile micro-cards rather than flat, washed-out admin templates.

---

## 1. Design Tokens

### A. Color Palette

| Name | Hex Value | Token | Role |
|------|-----------|-------|------|
| **Midnight Wine Ground** | `#14080e` | `--color-wine-ground` | Navigation header background, hero ground, high-contrast dark framing |
| **Midnight Wine** | `#421d24` | `--color-midnight-wine` | Primary filled action CTA buttons, footer, flagship milestone ground |
| **Deep Lagoon** | `#0c4243` | `--color-deep-lagoon` | High-impact feature bento cards, data integrity band, and dark contrast sections |
| **Royal Violet** | `#714cb6` | `--color-royal-violet` | Eyebrow badges, emphasized text links, active focus rings, and radar indicator dots |
| **Lilac Mist** | `#d4c7ff` | `--color-lilac-mist` | Secondary action fills, selected card surfaces, logo dot, and brand tinting |
| **Warm Parchment** | `#f2f0eb` | `--color-warm-parchment` | Base page canvas — warm cream that replaces cold sterile white |
| **Paper White** | `#ffffff` | `--color-paper-white` | Elevated card surfaces, floating spec sheets, and high-contrast text on dark surfaces |
| **Soft Mist** | `#e3e3e2` | `--color-soft-mist` | Hairline borders, card outlines, and subtle separators |
| **Ink Charcoal** | `#292827` | `--color-ink-charcoal` | Primary body and heading text — warm near-black with brown undertones |
| **Stone Gray** | `#666666` | `--color-stone-gray` | Secondary body text, metadata, descriptions, and placeholder copy |
| **Live Emerald** | `#10b981` / `#34d399` | `--color-emerald` | Live market pulse, momentum indicators (+YoY), and verified data badges |

---

### B. Typography Scale (Super Sans VF)

Headlines speak with restraint at weight 460 with tight tracking rather than shout with heavy bold weights.

| Role | Weight | Size | Line Height | Tracking | Token |
|------|--------|------|-------------|----------|-------|
| **caption** | 460 / 540 | 12px | 1.5 | 0 | `--text-caption` |
| **body-sm** | 460 / 540 | 14px | 1.5 | 0 | `--text-body-sm` |
| **body** | 460 / 540 | 16px | 1.2 | 0 | `--text-body` |
| **label-bold** | 460 / 540 | 19px | 1.5 | 0 | `--text-label-bold` |
| **subheading** | 460 | 26px | 1.3 | -0.4px | `--text-subheading` |
| **heading-sm** | 460 | 28px | 1.14 | -0.62px | `--text-heading-sm` |
| **heading-lg** | 460 | 49px | 1.2 | -1.32px | `--text-heading-lg` |
| **display** | 460 | 64px | 0.96 | -1.8px | `--text-display` |

---

### C. Spacing & Shapes

- **Base Unit:** 4px
- **Border Radius:**
  - `tabs`: 8px (`rounded-tabs`)
  - `small-buttons` / `form inputs`: 8px (`rounded-small-buttons`)
  - `cards` / `bento containers`: 16px (`rounded-cards`)
  - `primary buttons`: 16px (`rounded-buttons`)
  - `pills` / `badges`: 999px (`rounded-pills`)
- **Max Widths:**
  - Platform / Page Container: `1200px` (or `1280px` for headers)
  - Editorial Readable Line: `60ch` – `76ch`

---

## 2. Component System (Bento Studio & Progressive Workflow)

### A. Navigation Header
- **Background:** Dark wine ground `#14080e` with `backdrop-blur-[16px]` and `border-b border-white/10`.
- **Brand Logo:** `VENTUREX` in `#ffffff` with a glowing `#d4c7ff` (Lilac Mist) circular dot.
- **Links:** `#ffffff` at 80% opacity (`text-paper-white/80`) hovering to `#d4c7ff` (Lilac Mist). Active routes highlighted with high-contrast text and a subtle Lilac Mist border/capsule.
- **User Actions:** User session pill in `bg-white/10 text-paper-white/90 border border-white/15 rounded-pills px-12 py-4`.

### B. Bento Grid Cards
1. **Flagship Milestone Bento:**
   - When available/active: Rich dark ground (`bg-midnight-wine` or `bg-deep-lagoon`) or bold Lilac Mist highlight (`border-midnight-wine bg-lilac-mist/35`) with white/charcoal typography and a high-visibility CTA button.
   - When pending/unavailable: Crisp `bg-paper-white border border-soft-mist shadow-xs`.
2. **Standard Feature Bento:**
   - `rounded-cards bg-paper-white p-24 sm:p-32 border border-soft-mist shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-royal-violet/30`.
3. **Value Pillar Icon Containers:**
   - Royal Violet: `flex size-36 items-center justify-center rounded-small-buttons bg-royal-violet/10 text-royal-violet`
   - Deep Lagoon: `flex size-36 items-center justify-center rounded-small-buttons bg-deep-lagoon/10 text-deep-lagoon`
   - Midnight Wine: `flex size-36 items-center justify-center rounded-small-buttons bg-midnight-wine/10 text-midnight-wine`
4. **Inset Micro-Tiles:**
   - `rounded-small-buttons bg-warm-parchment/60 p-14 border border-soft-mist/70 transition-colors hover:bg-warm-parchment hover:border-royal-violet/30`.
   - Used for profile dossier fields, stage action blocks, and trend signal metrics.

### C. Buttons & CTAs
1. **Primary Filled Action:**
   - Background `#421d24` (Midnight Wine), text `#ffffff`, radius 16px (`rounded-buttons`), height ≥44px. Paired with `ArrowRightIcon` on the right (`group-hover:translate-x-1`).
   - In dark-ground containers: Background `#ffffff` (Paper White) with text `#421d24` (Midnight Wine).
2. **Secondary Outlined Action:**
   - Background `#d4c7ff` (Lilac Mist), border 1px `#292827` (Ink Charcoal), text `#292827`, radius 8px (`rounded-small-buttons`). Hover switches to `#ffffff`.
3. **Ghost Text Links:**
   - Text `#714cb6` (Royal Violet), font weight 540, underline on hover with `ArrowRightIcon`.

### D. Pills & Badges
1. **Section Eyebrow Capsule:**
   - `inline-flex items-center gap-8 rounded-pills bg-paper-white px-12 py-4 text-caption font-w540 uppercase tracking-widest text-royal-violet border border-soft-mist shadow-xs` with a glowing indicator dot `<span className="h-6 w-6 rounded-full bg-royal-violet" />`.
2. **Category / Heuristic Chips:**
   - `inline-flex items-center rounded-pills border border-soft-mist bg-paper-white px-10 py-3 text-caption font-w540 text-ink-charcoal shadow-xs transition-all duration-200 hover:scale-105 hover:bg-lilac-mist/30 hover:border-royal-violet/40 cursor-default`.
3. **Live Indicator Badge:**
   - `inline-flex items-center gap-6 rounded-pills bg-emerald-500/15 border border-emerald-400/30 px-8 py-2 text-[11px] font-w540 text-emerald-700` with pulsing dot `<span className="h-6 w-6 rounded-full bg-emerald-500 animate-pulse" />`.

### E. Form Controls & Steppers
1. **Input & Select:**
   - `min-h-44 rounded-small-buttons border border-soft-mist bg-paper-white px-12 text-body-sm font-w460 text-ink-charcoal focus:border-royal-violet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet`.
2. **Selection / Consent Cards:**
   - Active: `border-midnight-wine bg-lilac-mist/40 rounded-cards p-16 sm:p-20 shadow-xs`.
   - Inactive: `border-soft-mist bg-warm-parchment/60 rounded-cards p-16 sm:p-20 hover:border-stone-gray`.
   - Checkbox / Radio accent: `accent-midnight-wine`.
3. **Sequential Step Nodes:**
   - `size-28 rounded-full border border-midnight-wine bg-midnight-wine text-caption font-w540 text-paper-white shadow-xs`.

---

## 3. Strict Rules & Guardrails

- **NO GENERIC AI GRADIENTS:** Never apply arbitrary multi-color rainbow gradients across card surfaces. Surfaces are intentional: Warm Parchment, Paper White, Lilac Mist, Deep Lagoon, or Midnight Wine.
- **NO FLAT BEIGE ADMIN SHEETS:** Do not render all cards as uniform white boxes with plain gray borders. Use tonal hierarchy (Flagship Hero Card → 2-Column Bento → Inset Micro-Tiles).
- **TOUCH TARGETS:** All buttons, links, and form controls must be touch-safe (minimum height 44px).
- **FOCUS ACCESSIBILITY:** Every interactive control must have an explicit `focus-visible:outline-2 focus-visible:outline-royal-violet`.
