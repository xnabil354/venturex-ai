"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui";
import type { FitScoreApiDto } from "@/scoring/fit-score-api-dto";
import type { FitScoreComponent } from "@/scoring/fit-score";

type FitScoreViewState = (
  | { readonly status: "LOADING" }
  | { readonly status: "AVAILABLE"; readonly result: Extract<FitScoreApiDto, { status: "AVAILABLE" }> }
  | { readonly status: "INSUFFICIENT_DATA"; readonly result: Extract<FitScoreApiDto, { status: "INSUFFICIENT_DATA" }> }
  | { readonly status: "ERROR"; readonly error: "UNAUTHENTICATED" | "INVALID_REQUEST" | "UNAVAILABLE" | "PROFILE_INCOMPLETE" | "TEMPORARY" }
) & { readonly opportunityId: string; readonly requestKey: number };

const COMPONENT_LABELS: Record<FitScoreComponent, string> = {
  budgetFit: "Kecukupan modal",
  interestFit: "Minat kategori",
  locationFit: "Lokasi",
  experienceFit: "Pengalaman",
  channelFit: "Kanal penjualan",
  timeFit: "Komitmen waktu",
  productFit: "Kategori produk",
  customerFit: "Segmen pelanggan",
  priceFit: "Rentang harga",
  operationalFit: "Operasional",
  brandFit: "Brand",
};

const FIT_SCORE_DISCLAIMER =
  "Fit Score menunjukkan kesesuaian berdasarkan profil dan kriteria terbatas yang tersedia, bukan jaminan keberhasilan bisnis.";
const FIT_SCORE_LABEL = "MVP Heuristic Fit Score";
const FIT_SCORE_POLICY_VERSION = "FIT_MVP_HEURISTIC_V1";

const FIT_SCORE_COMPONENTS = new Set<FitScoreComponent>(Object.keys(COMPONENT_LABELS) as FitScoreComponent[]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function isFitScoreComponent(value: unknown): value is FitScoreComponent {
  return typeof value === "string" && FIT_SCORE_COMPONENTS.has(value as FitScoreComponent);
}

function parseFitScoreResponse(value: unknown): FitScoreApiDto | null {
  if (!isRecord(value) || value.success !== true || !isRecord(value.data) || !isRecord(value.data.fitScore)) {
    return null;
  }

  const raw = value.data.fitScore;
  if (raw.modelType !== "ENTREPRENEUR_FIT" && raw.modelType !== "BUSINESS_FIT") return null;
  if (raw.policyVersion !== FIT_SCORE_POLICY_VERSION) return null;
  if (raw.confidence !== null || raw.label !== FIT_SCORE_LABEL || raw.disclaimer !== FIT_SCORE_DISCLAIMER) return null;

  const base = {
    modelType: raw.modelType,
    policyVersion: raw.policyVersion,
    confidence: null,
    label: raw.label,
    disclaimer: raw.disclaimer,
  } as const;

  if (raw.status === "AVAILABLE" && isFiniteScore(raw.value) && Array.isArray(raw.breakdown)) {
    const breakdown: Extract<FitScoreApiDto, { status: "AVAILABLE" }>["breakdown"][number][] = [];
    for (const item of raw.breakdown) {
      if (
        !isRecord(item) ||
        !isFitScoreComponent(item.component) ||
        !isFiniteScore(item.value) ||
        typeof item.weightedContribution !== "number" ||
        !Number.isFinite(item.weightedContribution) ||
        typeof item.interpretation !== "string"
      ) {
        return null;
      }
      breakdown.push({
        component: item.component,
        value: item.value,
        weightedContribution: item.weightedContribution,
        interpretation: item.interpretation,
      });
    }

    return { ...base, status: "AVAILABLE", value: raw.value, breakdown };
  }

  if (
    raw.status === "INSUFFICIENT_DATA" &&
    raw.value === null &&
    raw.reason === "ACTIVE_COMPONENTS_UNAVAILABLE" &&
    Array.isArray(raw.missingComponents) &&
    raw.missingComponents.every(isFitScoreComponent)
  ) {
    return {
      ...base,
      status: "INSUFFICIENT_DATA",
      value: null,
      reason: raw.reason,
      missingComponents: [...raw.missingComponents],
    };
  }

  return null;
}

function formatScore(value: number): string {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);
}

function messageForError(error: Extract<FitScoreViewState, { status: "ERROR" }>["error"]): string {
  switch (error) {
    case "UNAUTHENTICATED":
      return "Sesi Anda tidak dapat digunakan untuk melihat Fit Score.";
    case "INVALID_REQUEST":
      return "Permintaan Fit Score tidak valid. Muat ulang detail Opportunity.";
    case "UNAVAILABLE":
      return "Fit Score tidak tersedia untuk Opportunity ini.";
    case "PROFILE_INCOMPLETE":
      return "Lengkapi profil agar Fit Score dapat dihitung.";
    case "TEMPORARY":
      return "Fit Score belum dapat dimuat. Detail Opportunity tetap tersedia.";
  }
}

function errorForStatus(status: number): Extract<FitScoreViewState, { status: "ERROR" }>["error"] {
  if (status === 400) return "INVALID_REQUEST";
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 404) return "UNAVAILABLE";
  if (status === 422) return "PROFILE_INCOMPLETE";
  return "TEMPORARY";
}

export function FitScoreSection({
  opportunityId,
  compact = false,
}: {
  readonly opportunityId: string;
  readonly compact?: boolean;
}) {
  const [retryKey, setRetryKey] = useState(0);
  const [state, setState] = useState<FitScoreViewState>({
    opportunityId,
    requestKey: 0,
    status: "LOADING",
  });
  const requestSequence = useRef(0);
  const visibleState = state.opportunityId === opportunityId && state.requestKey === retryKey
    ? state
    : { opportunityId, requestKey: retryKey, status: "LOADING" as const };

  useEffect(() => {
    const controller = new AbortController();
    const sequence = ++requestSequence.current;
    let active = true;

    async function loadFitScore() {
      try {
        const response = await fetch(
          `/api/v1/opportunities/${encodeURIComponent(opportunityId)}/fit-score`,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          if (active && sequence === requestSequence.current) {
            setState({ opportunityId, requestKey: retryKey, status: "ERROR", error: errorForStatus(response.status) });
          }
          return;
        }

        const result = parseFitScoreResponse(await response.json());
        if (!active || sequence !== requestSequence.current) return;
        if (!result) {
          setState({ opportunityId, requestKey: retryKey, status: "ERROR", error: "TEMPORARY" });
        } else if (result.status === "AVAILABLE") {
          setState({ opportunityId, requestKey: retryKey, status: "AVAILABLE", result });
        } else {
          setState({ opportunityId, requestKey: retryKey, status: "INSUFFICIENT_DATA", result });
        }
      } catch {
        if (active && sequence === requestSequence.current && !controller.signal.aborted) {
          setState({ opportunityId, requestKey: retryKey, status: "ERROR", error: "TEMPORARY" });
        }
      }
    }

    void loadFitScore();

    return () => {
      active = false;
      controller.abort();
    };
  }, [opportunityId, retryKey]);

  return (
    <div aria-busy={visibleState.status === "LOADING"} className="grid min-w-0 gap-12">
      {visibleState.status === "LOADING" ? (
        <p className="text-body-sm text-stone-gray" role="status">
          Memuat Fit Score…
        </p>
      ) : null}

      {visibleState.status === "AVAILABLE" ? (
        <div className="grid min-w-0 gap-12">
          <div className="grid gap-4">
            <p className="text-label-bold font-w540 text-ink-charcoal">{visibleState.result.label}</p>
            <p className={`${compact ? "text-heading-sm" : "text-heading-lg"} wrap-anywhere font-w460 text-ink-charcoal`} aria-label={`Fit Score ${formatScore(visibleState.result.value)}`}>
              {formatScore(visibleState.result.value)}
              <span className="ml-4 text-body-sm font-w400 text-stone-gray">/ 100</span>
            </p>

          </div>

          {!compact ? (
            <ul className="grid gap-8">
              {visibleState.result.breakdown.map((item) => (
                <li className="grid min-w-0 gap-4 border-l border-soft-mist pl-12 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start" key={item.component}>
                  <div className="grid min-w-0 gap-2">
                    <span className="wrap-anywhere text-body-sm font-w540 text-ink-charcoal">
                      {COMPONENT_LABELS[item.component]}
                    </span>
                    <span className="wrap-anywhere text-caption leading-body-sm text-stone-gray">
                      {item.interpretation}
                    </span>
                  </div>
                  <span className="text-body-sm text-stone-gray">
                    {formatScore(item.value)} <span className="text-caption">(kontribusi {formatScore(item.weightedContribution)})</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <p className="max-w-[76ch] text-caption leading-body-sm text-stone-gray">
            {visibleState.result.disclaimer}
          </p>
        </div>
      ) : null}

      {visibleState.status === "INSUFFICIENT_DATA" ? (
        <div className="grid gap-8">
          <p className="text-body-sm text-stone-gray" role="status">
            Data belum cukup untuk menghitung Fit Score.
          </p>
          {visibleState.result.missingComponents.length > 0 ? (
            <p className="wrap-anywhere text-caption leading-body-sm text-stone-gray">
              Komponen yang belum tersedia: {visibleState.result.missingComponents.map((component) => COMPONENT_LABELS[component]).join(", ")}.
            </p>
          ) : null}
          <p className="max-w-[76ch] text-caption leading-body-sm text-stone-gray">
            {visibleState.result.disclaimer}
          </p>
        </div>
      ) : null}

      {visibleState.status === "ERROR" ? (
        <div className="grid justify-items-start gap-8">
          <p className="max-w-[76ch] text-body-sm leading-body-sm text-stone-gray" role="alert">
            {messageForError(visibleState.error)}
          </p>
          {visibleState.error === "UNAUTHENTICATED" ? (
            <Link className="min-h-button inline-flex items-center text-body-sm font-w540 text-royal-violet underline-offset-2 hover:underline" href="/login">
              Masuk kembali
            </Link>
          ) : null}
          {visibleState.error === "PROFILE_INCOMPLETE" ? (
            <Link className="min-h-button inline-flex items-center text-body-sm font-w540 text-royal-violet underline-offset-2 hover:underline" href="/profile">
              Lengkapi profil
            </Link>
          ) : null}
          {visibleState.error === "TEMPORARY" ? (
            <Button onClick={() => setRetryKey((current) => current + 1)} type="button" variant="secondary">
              Coba lagi
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
