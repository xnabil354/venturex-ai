"use client";

import { useState } from "react";
import Link from "next/link";

import { Button, Card } from "@/components/ui";
import {
  opportunityComparisonResultSchema,
  type OpportunityComparisonItem,
  type OpportunityComparisonMetric,
  type OpportunityComparisonResult,
} from "@/opportunity/compare-domain";

export type ComparisonSelection = { readonly id: string; readonly name: string };

export type CompareHook = {
  readonly selected: readonly ComparisonSelection[];
  readonly result: OpportunityComparisonResult | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly toggle: (selection: ComparisonSelection) => void;
  readonly remove: (id: string) => void;
  readonly compare: () => Promise<void>;
};

function errorMessage(code: unknown): string {
  if (code === "PROFILE_INCOMPLETE") return "Lengkapi profil sebelum membandingkan peluang.";
  if (code === "RESOURCE_NOT_FOUND") return "Satu atau lebih peluang tidak lagi tersedia untuk akun ini.";
  if (code === "VALIDATION_ERROR") return "Pilih dua atau tiga peluang yang berbeda.";
  return "Perbandingan belum dapat dimuat. Silakan coba kembali.";
}

export function useOpportunityCompare(): CompareHook {
  const [selected, setSelected] = useState<readonly ComparisonSelection[]>([]);
  const [result, setResult] = useState<OpportunityComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(selection: ComparisonSelection) {
    if (loading) return;
    setError(null);
    setResult(null);
    if (selected.some(({ id }) => id === selection.id)) {
      setSelected(selected.filter(({ id }) => id !== selection.id));
      return;
    }
    if (selected.length >= 3) {
      setError("Maksimal tiga peluang dapat dibandingkan sekaligus.");
      return;
    }
    setSelected([...selected, selection]);
  }

  function remove(id: string) {
    if (loading) return;
    setError(null);
    setResult(null);
    setSelected((current) => current.filter((item) => item.id !== id));
  }

  async function compare() {
    if (selected.length < 2) {
      setError("Pilih minimal dua peluang untuk memulai perbandingan.");
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/v1/opportunities/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityIds: selected.map(({ id }) => id) }),
      });
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error("invalid-response");
      }
      if (!response.ok || typeof payload !== "object" || payload === null
        || !("success" in payload) || payload.success !== true || !("data" in payload)) {
        const code = typeof payload === "object" && payload !== null && "error" in payload
          && typeof payload.error === "object" && payload.error !== null && "code" in payload.error
          ? payload.error.code
          : null;
        throw new Error(typeof code === "string" ? code : "request-failed");
      }

      const parsed = opportunityComparisonResultSchema.safeParse(payload.data);
      const expectedIds = new Set(selected.map(({ id }) => id));
      if (!parsed.success || parsed.data.items.length !== selected.length
        || parsed.data.items.some(({ opportunityId }) => !expectedIds.has(opportunityId))) {
        throw new Error("invalid-response");
      }
      setResult(parsed.data);
    } catch (caught) {
      setError(errorMessage(caught instanceof Error ? caught.message : null));
    } finally {
      setLoading(false);
    }
  }

  return { selected, result, loading, error, toggle, remove, compare };
}

type MetricValue = OpportunityComparisonMetric<unknown>;
type Attribute = {
  readonly label: string;
  readonly get: (item: OpportunityComparisonItem) => MetricValue;
  readonly display: (metric: MetricValue) => string;
};

function statusCopy(status: MetricValue["status"]): string {
  if (status === "INSUFFICIENT_DATA") return "Data belum cukup";
  if (status === "UNAVAILABLE") return "Belum tersedia";
  return "Tersedia";
}

const ATTRIBUTES: readonly Attribute[] = [
  {
    label: "Opportunity Score",
    get: (item) => item.opportunityScore,
    display: (value) => typeof value.value === "number" ? `${value.value}/100` : "Belum tersedia",
  },
  {
    label: "Fit Score",
    get: (item) => item.fitScore,
    display: (value) => typeof value.value === "number" ? `${value.value}/100` : "Belum tersedia",
  },
  {
    label: "Trend terkait",
    get: (item) => item.relatedTrend,
    display: (metric) => {
      if (typeof metric.value !== "object" || metric.value === null || !("title" in metric.value)) return "Belum tersedia";
      const trend = metric.value as { readonly title: string; readonly direction: string | null };
      return trend.direction ? `${trend.title} · ${trend.direction}` : trend.title;
    },
  },
  {
    label: "Kompetisi",
    get: (item) => item.competition,
    display: (metric) => {
      if (typeof metric.value !== "object" || metric.value === null) return "Belum tersedia";
      const competition = metric.value as { readonly level: string | null; readonly summary: string | null };
      return [competition.level, competition.summary].filter(Boolean).join(" — ") || "Belum tersedia";
    },
  },
  {
    label: "Risiko",
    get: (item) => item.risk,
    display: (metric) => {
      if (typeof metric.value !== "object" || metric.value === null || !("level" in metric.value)) return "Belum tersedia";
      const risk = metric.value as { readonly level: "LOW" | "MEDIUM" | "HIGH"; readonly reasons: readonly string[] };
      const level = risk.level === "LOW" ? "Rendah" : risk.level === "MEDIUM" ? "Sedang" : "Tinggi";
      return risk.reasons.length > 0 ? `${level} — ${risk.reasons.join(" ")}` : level;
    },
  },
  {
    label: "Execution Feasibility",
    get: (item) => item.executionFeasibility,
    display: (value) => typeof value.value === "number" ? `${value.value}/100` : "Belum tersedia",
  },
];

function MetricContent({ attribute, metric }: { readonly attribute: Attribute; readonly metric: MetricValue }) {
  return (
    <div className="grid min-w-0 gap-4">
      <span className="wrap-anywhere text-body-sm font-w540 text-ink-charcoal">
        {metric.status === "AVAILABLE" && metric.value !== null ? attribute.display(metric) : statusCopy(metric.status)}
      </span>
      <span className="wrap-anywhere text-body-xs leading-body-sm text-stone-gray">{metric.explanation}</span>
    </div>
  );
}

function ComparisonResults({ result }: { readonly result: OpportunityComparisonResult }) {
  const itemById = new Map(result.items.map((item) => [item.opportunityId, item]));
  return (
    <section aria-labelledby="comparison-results-heading" className="grid min-w-0 gap-16">
      <h3 className="text-heading-sm font-w460 text-ink-charcoal" id="comparison-results-heading">Hasil perbandingan</h3>
      <div className="hidden min-w-0 rounded-cards border border-soft-mist sm:block">
        <table className="w-full table-fixed border-collapse text-left">
          <caption className="sr-only">Perbandingan Opportunity berdasarkan enam atribut</caption>
          <thead>
            <tr className="bg-lilac-mist">
              <th className="w-[22%] border-b border-soft-mist p-12 text-body-sm font-w540 text-ink-charcoal" scope="col">Atribut</th>
              {result.items.map((item) => (
                <th className="border-b border-l border-soft-mist p-12 align-top text-body-sm font-w540 text-ink-charcoal" key={item.opportunityId} scope="col">
                  <Link className="inline-flex min-h-button max-w-full items-center wrap-anywhere text-royal-violet underline-offset-2 hover:underline" href={`/opportunities/${item.opportunityId}`}>{item.name}</Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ATTRIBUTES.map((attribute) => (
              <tr key={attribute.label}>
                <th className="border-b border-soft-mist p-12 align-top text-body-sm font-w540 text-ink-charcoal" scope="row">{attribute.label}</th>
                {result.items.map((item) => (
                  <td className="border-b border-l border-soft-mist p-12 align-top" key={item.opportunityId}>
                    <MetricContent attribute={attribute} metric={attribute.get(item)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-12 sm:hidden">
        {result.items.map((item) => (
          <Card className="grid min-w-0 gap-12 p-16" key={item.opportunityId}>
            <Link className="inline-flex min-h-button max-w-full items-center wrap-anywhere text-heading-sm font-w540 text-royal-violet underline-offset-2 hover:underline" href={`/opportunities/${item.opportunityId}`}>
              {item.name}
            </Link>
            <dl className="grid min-w-0 gap-12">
              {ATTRIBUTES.map((attribute) => (
                <div className="grid min-w-0 gap-4 border-t border-soft-mist pt-8" key={attribute.label}>
                  <dt className="text-body-xs font-w540 text-stone-gray">{attribute.label}</dt>
                  <dd><MetricContent attribute={attribute} metric={attribute.get(item)} /></dd>
                </div>
              ))}
            </dl>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function OpportunityComparisonPanel({ compareState }: { readonly compareState: CompareHook }) {
  const { selected, result, loading, error, remove, compare } = compareState;
  return (
    <Card className="grid min-w-0 gap-16 p-16 sm:p-24">
      <header className="grid gap-4">
        <h2 className="text-heading-sm font-w460 text-ink-charcoal">Bandingkan peluang</h2>
        <p className="text-body-sm leading-body-sm text-stone-gray">Pilih dua atau tiga peluang. Nilai yang belum didukung data akan ditandai, tanpa menentukan pemenang.</p>
      </header>

      {selected.length === 0 ? (
        <p className="text-body-sm text-stone-gray" role="status">Belum ada peluang dipilih. Pilih setidaknya dua peluang dari daftar.</p>
      ) : (
        <ul aria-label="Peluang yang dipilih untuk perbandingan" className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {selected.map((item) => (
            <li className="flex min-w-0 items-center justify-between gap-8 rounded-small-buttons border border-soft-mist p-8" key={item.id}>
              <span className="wrap-anywhere min-w-0 text-body-sm text-ink-charcoal">{item.name}</span>
              <Button aria-label={`Hapus ${item.name} dari perbandingan`} className="shrink-0" disabled={loading} onClick={() => remove(item.id)} variant="ghost">Hapus</Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-12">
        <Button disabled={selected.length < 2 || loading} loading={loading} onClick={() => void compare()}>
          Bandingkan ({selected.length}/3)
        </Button>
        <span className="text-body-xs text-stone-gray" role="status">{selected.length < 2 ? "Pilih minimal dua peluang." : `${selected.length} peluang dipilih.`}</span>
      </div>

      {error ? <p className="text-body-sm text-midnight-wine" role="alert">{error}</p> : null}
      {result ? <ComparisonResults result={result} /> : null}
    </Card>
  );
}
