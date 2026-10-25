"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import type { AiUsageKind } from "@/billing/catalog";
import type { BillingSummary, BillingUsageCost } from "@/billing/service";
import { StatusNotice } from "@/components/ui/status-notice";

type BillingSnapshot = BillingSummary & { readonly usageCosts: ReadonlyArray<BillingUsageCost> };
type BillingContextValue = {
  readonly snapshot: BillingSnapshot | null;
  readonly stale: boolean;
  readonly refresh: () => Promise<BillingSnapshot>;
};

const BillingContext = createContext<BillingContextValue | null>(null);

function isBillingSnapshot(value: unknown): value is BillingSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const data = value as Partial<BillingSnapshot>;
  return Number.isSafeInteger(data.availableCredits) && data.availableCredits! >= 0
    && typeof data.canUseAi === "boolean"
    && typeof data.requiresRenewal === "boolean"
    && Array.isArray(data.usageCosts)
    && data.usageCosts.every((cost: unknown) =>
      typeof cost === "object" && cost !== null
      && "usage" in cost && "credits" in cost
      && (cost.usage === "OPPORTUNITY_HYPOTHESIS" || cost.usage === "DETAILED_ANALYSIS")
      && typeof cost.credits === "number" && Number.isSafeInteger(cost.credits) && cost.credits >= 0,
    );
}

export function BillingProvider({ children, initialSummary, redirectOnExpiredPlan = false }: { readonly children: ReactNode; readonly initialSummary: BillingSummary | null; readonly redirectOnExpiredPlan?: boolean }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<BillingSnapshot | null>(initialSummary ? { ...initialSummary, usageCosts: [] } : null);
  const [dataStale, setDataStale] = useState(initialSummary === null);
  const [streamDisconnected, setStreamDisconnected] = useState(false);
  const mounted = useRef(true);
  const latestRequest = useRef(0);

  const refresh = useCallback(async (): Promise<BillingSnapshot> => {
    const requestId = ++latestRequest.current;
    try {
      const response = await fetch("/api/v1/billing", { cache: "no-store", credentials: "same-origin" });
      const payload: unknown = await response.json();
      const data = typeof payload === "object" && payload !== null && "data" in payload ? payload.data : null;
      if (!response.ok || !isBillingSnapshot(data)) throw new Error("BILLING_UNAVAILABLE");
      if (mounted.current && requestId === latestRequest.current) { setSnapshot(data); setDataStale(false); }
      return data;
    } catch (error) {
      if (mounted.current && requestId === latestRequest.current) setDataStale(true);
      throw error;
    }
  }, []);

  useEffect(() => {
    if (redirectOnExpiredPlan && snapshot?.requiresRenewal) router.replace("/billing");
  }, [redirectOnExpiredPlan, snapshot?.requiresRenewal, router]);

  useEffect(() => {
    mounted.current = true;
    const update = () => { setStreamDisconnected(false); void refresh().catch(() => {}); };
    const source = new EventSource("/api/v1/billing/events");
    source.addEventListener("ready", update);
    source.addEventListener("changed", update);
    source.addEventListener("unavailable", () => setStreamDisconnected(true));
    source.onerror = () => setStreamDisconnected(true);
    const onFocus = () => { void refresh().catch(() => {}); };
    const onVisibility = () => { if (document.visibilityState === "visible") void refresh().catch(() => {}); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    void refresh().catch(() => {});
    return () => {
      mounted.current = false;
      source.close();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  useEffect(() => {
    const dates = [snapshot?.planEndsAt, snapshot?.trialEndsAt, snapshot?.scheduledStartsAt]
      .filter((date): date is string => Boolean(date))
      .map((date) => new Date(date).getTime())
      .filter((time) => time > Date.now());
    const next = Math.min(...dates);
    if (!Number.isFinite(next)) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const remaining = next - Date.now() + 100;
      timer = setTimeout(() => {
        if (remaining > 2_147_483_647) schedule();
        else void refresh().catch(() => {});
      }, Math.min(remaining, 2_147_483_647));
    };
    schedule();
    return () => clearTimeout(timer);
  }, [snapshot?.planEndsAt, snapshot?.trialEndsAt, snapshot?.scheduledStartsAt, refresh]);

  return <BillingContext.Provider value={{ snapshot, stale: dataStale || streamDisconnected, refresh }}>{children}</BillingContext.Provider>;
}

export function useBillingState(): BillingContextValue | null {
  return useContext(BillingContext);
}

type CreditWarningKind = "insufficient" | "locked" | "unavailable";

export function useCreditGate(usage: AiUsageKind) {
  const billing = useContext(BillingContext);
  const [override, setOverride] = useState<{ readonly kind: CreditWarningKind; readonly snapshot: BillingSnapshot | null } | null>(null);
  const showOverride = (kind: CreditWarningKind) => setOverride({ kind, snapshot: billing?.snapshot ?? null });
  const cost = billing?.snapshot?.usageCosts.find((item) => item.usage === usage)?.credits;
  const available = billing?.snapshot?.availableCredits;
  const derived: CreditWarningKind | null = !billing || billing.stale || cost === undefined || available === undefined
    ? null
    : available < cost ? "insufficient" : !billing.snapshot?.canUseAi ? "locked" : null;
  const warning = override?.snapshot === billing?.snapshot ? override?.kind ?? derived : derived;

  async function check(): Promise<boolean> {
    if (!billing) return true;
    try {
      const current = await billing.refresh();
      const currentCost = current.usageCosts.find((item) => item.usage === usage)?.credits;
      if (currentCost === undefined) { showOverride("unavailable"); return false; }
      if (current.availableCredits < currentCost) { showOverride("insufficient"); return false; }
      if (!current.canUseAi) { showOverride("locked"); return false; }
      setOverride(null);
      return true;
    } catch {
      showOverride("unavailable");
      return false;
    }
  }

  async function handleRejection(response: Response): Promise<boolean> {
    if (response.status !== 402 && response.status !== 403) return false;
    const payload: unknown = await response.clone().json().catch(() => null);
    const code = typeof payload === "object" && payload !== null && "error" in payload
      && typeof payload.error === "object" && payload.error !== null && "code" in payload.error
      ? payload.error.code : null;
    if (code !== "INSUFFICIENT_CREDITS" && code !== "AI_ACCESS_LOCKED") return false;
    showOverride(code === "INSUFFICIENT_CREDITS" ? "insufficient" : "locked");
    await billing?.refresh().catch(() => {});
    return true;
  }

  const notice = warning ? (
    <StatusNotice role="alert" tone="warning">
      {warning === "insufficient" ? `Kredit tidak cukup. Aksi ini membutuhkan ${cost ?? "—"} kredit; saldo Anda ${available ?? "—"} kredit.`
        : warning === "locked" ? "AI terkunci. Aktifkan paket untuk menggunakan AI; sisa kredit Anda tetap tersimpan."
          : "Saldo dan tarif kredit belum dapat diperiksa. Coba lagi sesaat lagi."}{" "}
      <Link className="font-w540 text-royal-violet underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet" href="/billing">Lihat paket & kredit</Link>
      {warning === "insufficient" || warning === "locked" ? (
        <button className="ml-8 min-h-44 font-w540 text-royal-violet underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet" onClick={() => { setOverride(null); void billing?.refresh().catch(() => {}); }} type="button">Perbarui saldo</button>
      ) : null}
    </StatusNotice>
  ) : null;

  return { blocked: warning === "insufficient" || warning === "locked", check, handleRejection, notice, refresh: billing?.refresh };
}
