"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { radarFilterContext } from "@/dashboard/radar-preview";
import type { RadarHistory } from "@/trend/trend-radar-history";

export function TrendRadarHistory({ history, selectedId, onOpen }: { readonly history: RadarHistory; readonly selectedId?: string; readonly onOpen: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? history.entries : history.entries.slice(0, 3);
  return (
    <Card className="grid min-w-0 gap-12 p-16 sm:p-20">
      <div className="flex flex-wrap items-baseline justify-between gap-6">
        <h2 className="text-body font-w540 text-ink-charcoal">Riwayat tren <span className="text-stone-gray">({history.entries.length})</span></h2>
        <p className="text-caption text-stone-gray">20 terakhir di browser ini</p>
      </div>
      <ol className="grid max-h-[320px] gap-10 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {visible.map(entry => (
          <li className="min-w-0" key={entry.id}>
            <button aria-pressed={entry.id === selectedId} className={`grid min-h-button w-full gap-6 rounded-small-buttons border p-12 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet ${entry.id === selectedId ? "border-royal-violet/40 bg-lilac-mist/20" : "border-soft-mist bg-warm-parchment/50 hover:border-royal-violet/40"}`} onClick={() => onOpen(entry.id)} type="button">
              <span className="break-words text-body-sm font-w540 text-ink-charcoal">{entry.result.productQuery}</span>
              <span className="break-words text-caption leading-relaxed text-stone-gray">{radarFilterContext(entry.geographyLabel, entry.result.appliedFilters.period, entry.result.appliedFilters.property, entry.result.appliedFilters.time)}</span>
              <span className="text-caption text-stone-gray">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(entry.recordedAt))} WIB</span>
            </button>
          </li>
        ))}
      </ol>
      {history.entries.length > 3 ? <button className="min-h-button w-fit rounded-small-buttons px-10 text-body-sm font-w540 text-royal-violet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet" onClick={() => setExpanded(value => !value)} type="button">{expanded ? "Tampilkan lebih sedikit" : "Lihat semua riwayat"}</button> : null}
    </Card>
  );
}
