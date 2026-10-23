"use client";

import { useRadarHistory } from "../trends/use-radar-history";
import type { DashboardTrendModuleState } from "@/dashboard/dto";
import { buildRadarPreview, radarContext, readRadarSnapshot } from "@/dashboard/radar-preview";
import { TrendPreviewSection } from "./trend-preview-section";

export function DashboardRadarPreview({ state, userId, productQuery }: {
  readonly state: DashboardTrendModuleState;
  readonly userId: string;
  readonly productQuery: string;
}) {
  const history = useRadarHistory(userId);
  const active = history?.entries.find(entry => entry.id === history.activeId);
  const explicitHistory = active && !active.id.startsWith("legacy-");
  const result = active ? (explicitHistory ? active.result : readRadarSnapshot(JSON.stringify(active.result), productQuery)) : null;
  const preview = result && (explicitHistory || !state.observedAt || result.retrievedAt >= state.observedAt) ? buildRadarPreview(result) : state;
  return <TrendPreviewSection state={explicitHistory && result ? { ...preview, context: `Sinyal terkait · ${radarContext(result.productQuery, result.appliedFilters.geo, result.appliedFilters.period, result.appliedFilters.property, result.appliedFilters.time)}` } : preview} title="Trend Radar" />;
}
