"use client";

import { useEffect, useState } from "react";

import { OPPORTUNITY_ANALYSIS_DISCLOSURE_VERSION, opportunityAnalysisDtoSchema, type OpportunityAnalysisDto } from "@/ai-analysis/domain";
import { Button } from "@/components/ui/button";

type AnalysisState = {
  readonly loading: boolean;
  readonly generating: boolean;
  readonly analysis: OpportunityAnalysisDto | null;
  readonly error: string | null;
  readonly providerUnavailable: boolean;
};

function errorCopy(code: unknown): { readonly message: string; readonly unavailable: boolean } {
  switch (code) {
    case "AI_SERVICE_UNAVAILABLE":
      return { message: "Layanan AI tidak tersedia atau belum dikonfigurasi. Tidak ada analisis otomatis yang ditampilkan.", unavailable: true };
    case "AI_RESPONSE_INVALID":
      return { message: "Respons analisis belum dapat divalidasi. Coba lagi nanti.", unavailable: false };
    case "PROFILE_INCOMPLETE":
      return { message: "Lengkapi profil sesuai tipe akun untuk membuat analisis.", unavailable: false };
    case "INSUFFICIENT_DATA":
      return { message: "Data tepercaya belum cukup untuk membuat analisis.", unavailable: false };
    case "RATE_LIMITED":
      return { message: "Permintaan analisis terlalu sering. Tunggu sebentar lalu coba lagi.", unavailable: false };
    case "UNAUTHORIZED":
      return { message: "Sesi Anda tidak tersedia. Masuk kembali untuk memuat AI Analysis.", unavailable: false };
    default:
      return { message: "AI Analysis belum dapat dimuat. Informasi Opportunity tetap tersedia.", unavailable: false };
  }
}

async function readResponse(response: Response): Promise<OpportunityAnalysisDto | null> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("ANALYSIS_UNAVAILABLE");
  }
  if (!response.ok) {
    const error = typeof payload === "object" && payload !== null && "error" in payload
      ? (payload as { error?: { code?: unknown } }).error?.code
      : null;
    throw new Error(typeof error === "string" ? error : "ANALYSIS_UNAVAILABLE");
  }
  if (typeof payload !== "object" || payload === null || !("success" in payload) || payload.success !== true || !("data" in payload)) {
    throw new Error("ANALYSIS_UNAVAILABLE");
  }
  if (payload.data === null) return null;
  const parsed = opportunityAnalysisDtoSchema.safeParse(payload.data);
  if (!parsed.success) throw new Error("ANALYSIS_UNAVAILABLE");
  return parsed.data;
}

const fields = [
  ["summary", "Ringkasan"],
  ["whyRelevant", "Relevansi dengan profil"],
  ["targetConsumer", "Target konsumen"],
  ["competition", "Kompetisi"],
  ["potential", "Potensi dan asumsi"],
  ["nextAction", "Langkah berikutnya"],
] as const;

export function AIAnalysisSection({ opportunityId }: { readonly opportunityId: string }) {
  const [state, setState] = useState<AnalysisState>({
    loading: true,
    generating: false,
    analysis: null,
    error: null,
    providerUnavailable: false,
  });
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    let mounted = true;
    void fetch(`/api/v1/opportunities/${encodeURIComponent(opportunityId)}/analysis/latest`, {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    }).then(readResponse).then((analysis) => {
      if (mounted) setState((current) => ({ ...current, loading: false, analysis }));
    }).catch((error: unknown) => {
      if (!mounted) return;
      const copy = errorCopy(error instanceof Error ? error.message : null);
      setState((current) => ({ ...current, loading: false, error: copy.message, providerUnavailable: copy.unavailable }));
    });
    return () => { mounted = false; };
  }, [opportunityId]);

  async function generate() {
    setState((current) => ({ ...current, generating: true, error: null, providerUnavailable: false }));
    try {
      const response = await fetch(`/api/v1/opportunities/${encodeURIComponent(opportunityId)}/analysis`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consent,
          disclosureVersion: OPPORTUNITY_ANALYSIS_DISCLOSURE_VERSION,
          forceRefresh: state.analysis !== null,
        }),
      });
      const analysis = await readResponse(response);
      if (!analysis) throw new Error("ANALYSIS_UNAVAILABLE");
      setState({ loading: false, generating: false, analysis, error: null, providerUnavailable: false });
    } catch (error) {
      const copy = errorCopy(error instanceof Error ? error.message : null);
      setState((current) => ({ ...current, loading: false, generating: false, error: copy.message, providerUnavailable: copy.unavailable }));
    } finally {
      setConsent(false);
    }
  }

  return (
    <div className="grid gap-16" aria-live="polite" aria-busy={state.loading || state.generating}>
      {state.loading ? <p className="text-body-sm text-stone-gray" role="status">Memuat AI Analysis…</p> : null}
      {state.analysis ? (
        <div className="grid gap-16">
          {state.analysis.limitedEvidence ? (
            <p className="w-fit rounded-full border border-soft-mist bg-lilac-mist px-10 py-4 text-body-sm font-w540 text-ink-charcoal" role="status">
              Evidence terbatas. Analisis berisi interpretasi awal dan asumsi yang perlu diverifikasi.
            </p>
          ) : null}
          <dl className="grid gap-16">
            {fields.map(([key, label]) => (
              <div className="grid gap-4" key={key}>
                <dt className="text-body-sm font-w540 text-ink-charcoal">{label}</dt>
                <dd className="max-w-[76ch] whitespace-pre-wrap wrap-anywhere text-body-sm leading-body-sm text-stone-gray">
                  {state.analysis?.[key] ?? ""}
                </dd>
              </div>
            ))}
            <div className="grid gap-4">
              <dt className="text-body-sm font-w540 text-ink-charcoal">Risiko</dt>
              <dd>
                <ul className="grid gap-6">
                  {state.analysis.risks.map((risk, index) => <li className="max-w-[76ch] wrap-anywhere text-body-sm leading-body-sm text-stone-gray" key={`${index}-${risk}`}>{risk}</li>)}
                </ul>
              </dd>
            </div>
          </dl>
          <p className="text-caption text-stone-gray">Provider: {state.analysis.provider} · Model: {state.analysis.model} · Dibuat: {state.analysis.generatedAt}</p>
        </div>
      ) : null}
      {state.error ? (
        <p className="max-w-[76ch] text-body-sm leading-body-sm text-stone-gray" role="alert">
          {state.error}
        </p>
      ) : null}
      {!state.analysis && !state.loading && !state.error ? (
        <p className="max-w-[76ch] text-body-sm leading-body-sm text-stone-gray">
          Analisis belum dibuat. Pembuatan hanya dimulai saat Anda memilih tombol di bawah.
        </p>
      ) : null}
      <div className="grid max-w-[76ch] gap-10 rounded-xl border border-soft-mist bg-white p-14">
        <label className="flex items-start gap-10 text-body-sm leading-body-sm text-ink-charcoal">
          <input checked={consent} className="mt-3 size-16 accent-royal-violet" onChange={(event) => setConsent(event.target.checked)} type="checkbox" />
          <span>
            Saya setuju VENTUREX mengirim konteks minimum profil yang sesuai tipe akun saya, ringkasan Opportunity, Trend terpublikasi, dan evidence terpilih ke layanan 9Router yang dikonfigurasi operator untuk dianalisis dengan model {state.analysis?.model ?? "cx/gpt-6-luna-xhigh"}. Lokasi, anggaran/harga persis, uraian bebas, nama produk, identitas akun, dan kontak tidak dikirim. Persetujuan ini berlaku untuk permintaan yang saya mulai.
          </span>
        </label>
        <p className="text-caption leading-body-sm text-stone-gray">
          Hasil disimpan sebagai AI Analysis akun Anda sesuai fitur aplikasi. Retensi dan pemrosesan lanjutan pada layanan 9Router tidak diverifikasi oleh VENTUREX. Jangan lanjutkan bila Anda tidak menyetujui pengiriman ini.
        </p>
      </div>
      <Button
        className="w-fit"
        disabled={state.loading || state.generating || !consent}
        onClick={() => void generate()}
        type="button"
      >
        {state.generating ? "Membuat AI Analysis…" : state.analysis ? "Generate ulang AI Analysis" : state.error ? "Coba lagi" : "Generate AI Analysis"}
      </Button>
    </div>
  );
}
