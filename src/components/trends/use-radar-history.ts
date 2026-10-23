"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { getRadarHistoryRaw, RADAR_HISTORY_EVENT, radarHistoryKey, readRadarHistory } from "@/trend/trend-radar-history";
import { radarSnapshotKey } from "@/dashboard/radar-preview";

export function useRadarHistory(userId?: string) {
  const read = useCallback(() => userId ? getRadarHistoryRaw(userId) : null, [userId]);
  const subscribe = useCallback((notify: () => void) => {
    const changed = (event: StorageEvent) => {
      if (userId && (event.key === null || event.key === radarHistoryKey(userId) || event.key === radarSnapshotKey(userId))) notify();
    };
    window.addEventListener("storage", changed);
    window.addEventListener(RADAR_HISTORY_EVENT, notify);
    return () => { window.removeEventListener("storage", changed); window.removeEventListener(RADAR_HISTORY_EVENT, notify); };
  }, [userId]);
  const raw = useSyncExternalStore(subscribe, read, () => null);
  return useMemo(() => readRadarHistory(raw), [raw]);
}
