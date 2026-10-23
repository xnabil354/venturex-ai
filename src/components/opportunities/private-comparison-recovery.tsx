"use client";
import { useEffect } from "react";

export function PrivateComparisonRecovery({ ownerId, removedIds }: { readonly ownerId: string; readonly removedIds: readonly string[] }) {
  useEffect(() => {
    if (!removedIds.length) return;
    try {
      const key = `venturex:compare:${ownerId}`;
      const current: unknown = JSON.parse(sessionStorage.getItem(key) ?? "[]");
      if (Array.isArray(current)) sessionStorage.setItem(key, JSON.stringify(current.filter(id => typeof id === "string" && !removedIds.includes(id))));
      window.dispatchEvent(new Event("venturex-comparison"));
    } catch { /* The remaining owner-scoped results are readable without browser storage. */ }
  }, [ownerId, removedIds]);
  return null;
}
