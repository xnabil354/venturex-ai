"use client";

import { useState } from "react";

import { syntheticDemoFixtureIdSchema, syntheticDemoResultSchema, type SyntheticDemoFixtureId, type SyntheticDemoResult } from "@/ai-analysis/synthetic-demo/contracts";
import { Button } from "@/components/ui/button";

const personas: readonly { readonly id: SyntheticDemoFixtureId; readonly label: string; readonly description: string }[] = [
  { id: "DEMO_ENTREPRENEUR", label: "Calon pengusaha", description: "Profil sintetis pada tahap awal eksplorasi konsep." },
  { id: "DEMO_UMKM", label: "Pelaku UMKM", description: "Profil sintetis usaha minuman yang ingin menilai varian." },
];

const analysisFields = [
  ["summary", "Ringkasan"],
  ["whyRelevant", "Mengapa relevan"],
  ["targetConsumer", "Target konsumen"],
  ["competition", "Persaingan"],
  ["potential", "Potensi"],
  ["nextAction", "Langkah berikutnya"],
] as const;

function isFixtureId(value: string): value is SyntheticDemoFixtureId {
  return syntheticDemoFixtureIdSchema.safeParse(value).success;
}

function messageForDemoError(code: string): string {
  switch (code) {
    case "DEMO_RESPONSE_INVALID": return "Contoh analisis tidak memenuhi format yang diharapkan. Tidak ada hasil yang ditampilkan.";
    case "DEMO_TIMEOUT": return "Pembuatan analisis melewati batas waktu. Tidak ada hasil yang ditampilkan; tidak ada retry otomatis.";
    case "DEMO_UPSTREAM_UNAVAILABLE": return "Layanan sementara tidak tersedia. Coba lagi nanti.";
    case "DEMO_PROVIDER_CONFIGURATION_UNAVAILABLE": return "Fitur belum siap digunakan.";
    case "DEMO_PROVIDER_AUTH_FAILED": return "Autentikasi gagal. Hubungi pengelola.";
    case "DEMO_PROVIDER_CONNECTION_FAILED": return "Koneksi gagal. Coba lagi.";
    case "RATE_LIMITED":
    case "BUSY": return "Demo sedang sibuk. Tunggu sebelum mencoba lagi.";
    default: return "Analisis belum tersedia. Coba lagi nanti.";
  }
}

export function SyntheticAIDemoScreen() {
  const [selected, setSelected] = useState<SyntheticDemoFixtureId | "">("");
  const [result, setResult] = useState<SyntheticDemoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    if (!selected || !isFixtureId(selected) || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/local/synthetic-ai-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtureId: selected }),
        cache: "no-store",
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const code = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
          ? body.error
          : "DEMO_UNAVAILABLE";
        setError(messageForDemoError(code));
        return;
      }
      const body: unknown = await response.json();
      const parsed = syntheticDemoResultSchema.safeParse(
        typeof body === "object" && body !== null && "data" in body ? body.data : null,
      );
      if (!parsed.success || parsed.data.fixtureId !== selected) {
        setError("Respons simulasi tidak valid. Tidak ada hasil yang ditampilkan.");
        return;
      }
      setResult(parsed.data);
    } catch {
      setError("Tidak dapat menghubungi demo lokal. Periksa apakah server lokal masih berjalan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-page px-20 py-40 sm:px-32 lg:py-64" data-testid="synthetic-ai-demo">
      <header className="mb-32 border-b border-soft-mist pb-28">
        <p className="mb-12 text-body-sm font-w540 text-royal-violet">Ruang demonstrasi lokal</p>
        <h1 className="max-w-3xl text-heading-lg font-w460 tracking-heading-lg">Analisis Peluang AI</h1>
        <p className="mt-12 max-w-2xl text-body-sm leading-relaxed text-stone-gray">
          Lihat alur analisis dengan profil dan konsep sintetis tetap. Halaman ini tidak memakai akun atau data usaha nyata maupun database.
        </p>
      </header>

      <section aria-labelledby="demo-warning" className="mb-28 rounded-cards border border-soft-mist bg-paper-white p-20 sm:p-24">
        <h2 className="text-label-bold font-w540" id="demo-warning">Analisis demo — profil sintetis</h2>
        <p className="mt-8 text-body-sm text-stone-gray">
          Demo menggunakan profil dan data contoh. Hasilnya bukan data usaha nyata.
        </p>
      </section>

      <section aria-labelledby="persona-heading" className="grid gap-24 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="rounded-cards border border-soft-mist bg-paper-white p-20 sm:p-24">
          <h2 className="text-subheading font-w460" id="persona-heading">Pilih profil simulasi</h2>
          <fieldset className="mt-18 space-y-12">
            <legend className="sr-only">Persona untuk contoh analisis</legend>
            {personas.map((persona) => (
              <label className="flex cursor-pointer gap-12 rounded-small-buttons border border-soft-mist p-14 hover:border-royal-violet" key={persona.id}>
                <input
                  checked={selected === persona.id}
                  className="mt-4 size-16 accent-midnight-wine"
                  name="synthetic-persona"
                  onChange={() => { setSelected(persona.id); setResult(null); setError(null); }}
                  type="radio"
                  value={persona.id}
                />
                <span>
                  <span className="block font-w540">{persona.label}</span>
                  <span className="mt-4 block text-body-sm text-stone-gray">{persona.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <Button className="mt-20 w-full sm:w-auto" disabled={!selected} loading={loading} onClick={generate}>
            {result ? "Ulangi simulasi" : "Tampilkan contoh analisis"}
          </Button>
          <p className="mt-10 text-caption text-stone-gray">Pilihan harus dibuat secara eksplisit. Tidak ada hasil yang dimuat otomatis.</p>
        </div>

        <div aria-live="polite" className="min-w-0">
          {loading ? (
            <div className="rounded-cards border border-soft-mist bg-paper-white p-24" role="status">
              <h2 className="text-subheading font-w460">Menyiapkan contoh simulasi</h2>
              <p className="mt-8 text-body-sm text-stone-gray">Menyiapkan hasil contoh…</p>
            </div>
          ) : null}
          {error ? (
            <div className="rounded-cards border border-soft-mist bg-paper-white p-24" role="alert">
              <h2 className="text-subheading font-w460">Simulasi gagal dimuat</h2>
              <p className="mt-8 text-body-sm text-stone-gray">{error}</p>
            </div>
          ) : null}
          {result ? <ResultPanel result={result} /> : null}
          {!loading && !error && !result ? (
            <div className="flex min-h-40 items-center rounded-cards border border-dashed border-soft-mist p-24">
              <p className="text-body-sm text-stone-gray">Pilih salah satu persona, lalu tampilkan contoh analisis.</p>
            </div>
          ) : null}
        </div>
      </section>
      <footer className="mt-32 border-t border-soft-mist pt-16 text-caption text-stone-gray">
        Jalankan hanya di komputer lokal melalui <code className="rounded bg-paper-white px-6 py-4">node scripts/demo/local-server.mjs</code>.
      </footer>
    </main>
  );
}

function ResultPanel({ result }: { readonly result: SyntheticDemoResult }) {
  return (
    <article aria-labelledby="result-heading" className="space-y-16">
      <section className="rounded-cards border border-soft-mist bg-paper-white p-20 sm:p-24">
        <p className="text-caption font-w540 text-royal-violet">Contoh analisis</p>

        <h2 className="mt-8 text-subheading font-w460" id="result-heading">{result.personaLabel}</h2>
        <p className="mt-8 text-body-sm text-stone-gray">{result.profile.summary}</p>
        <div className="mt-18 border-t border-soft-mist pt-16">
          <p className="text-caption font-w540 text-stone-gray">{result.opportunity.hypothesisLabel}</p>
          <h3 className="mt-4 font-w540">{result.opportunity.name}</h3>
          <p className="mt-6 text-body-sm text-stone-gray">{result.opportunity.description}</p>
        </div>

      </section>

      <section className="rounded-cards border border-soft-mist bg-paper-white p-20 sm:p-24">
        <h3 className="text-label-bold font-w540">Status data keputusan</h3>
        <ul className="mt-10 space-y-6 text-body-sm">
          <li>Opportunity Score: tidak tersedia — {result.decisionSupport.opportunityScore.reason}</li>
          <li>Fit Score: tidak tersedia — {result.decisionSupport.fitScore.reason}</li>
          <li>Risk Indicator: tidak tersedia — {result.decisionSupport.riskAssessment.reason}</li>
        </ul>
        <div className="mt-16 border-t border-soft-mist pt-14">
          <h4 className="font-w540">Evidence pasar</h4>
          <p className="mt-6 text-body-sm text-stone-gray">Tidak tersedia. {result.evidence.reason}</p>
        </div>
      </section>

      <section className="rounded-cards border border-soft-mist bg-paper-white p-20 sm:p-24">
        <h3 className="text-label-bold font-w540">Analisis contoh</h3>
        <p className="mt-6 text-caption text-stone-gray">
          {result.evidenceReferences.length === 0
            ? "Tidak ada evidence pasar yang disetujui atau diberikan ke analisis ini."
            : `Referensi evidence yang digunakan: ${result.evidenceReferences.join(", ")}`}
        </p>
        <dl className="mt-14 space-y-16">
          {analysisFields.map(([key, label]) => (
            <div className="border-t border-soft-mist pt-12" key={key}>
              <dt className="font-w540">{label}</dt>
              <dd className="mt-6 text-body-sm leading-relaxed text-stone-gray">{result.analysis[key]}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-16 border-t border-soft-mist pt-12">
          <h4 className="font-w540">Risiko dan batasan</h4>
          <ul className="mt-6 list-disc space-y-6 pl-20 text-body-sm text-stone-gray">
            {result.analysis.risks.map((risk) => <li key={risk}>{risk}</li>)}
            {result.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
          </ul>
        </div>
      </section>
    </article>
  );
}
