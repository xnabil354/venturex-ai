import type { ReactNode } from "react";

export function HypothesisDetailSurface({ children }: { readonly children: ReactNode }) {
  return (
    <div className="relative isolate min-h-[calc(100dvh-64px)] bg-warm-parchment">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/Cozy%20Breakfast%20Bowl%20and%20Iced%20Latte.png')" }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-paper-white/86" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
