"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Card, EmptyState, PageContainer } from "@/components/ui";
import {
  privateOpportunityIdeaResponseSchema,
  type PrivateOpportunityIdeaDto,
} from "@/opportunity/private-hypothesis";
import type { LiveTrendSignal } from "@/trend/live-signals-contract";

type SourceOption = Readonly<{
  snapshotId: string;
  signal: LiveTrendSignal;
}>;

function apiError(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || !("error" in payload)) return null;
  const error = payload.error;
  if (typeof error !== "object" || error === null || !("message" in error)) return null;
  return typeof error.message === "string" ? error.message : null;
}

export function PrivateOpportunityFinder({
  initialItems,
  initialLoadFailed = false,
  providerAvailable = false,
  publicHttpTransport = false,
  sourceOptions = [],
  view = "finder",
}: {
  readonly initialItems: readonly PrivateOpportunityIdeaDto[];
  readonly initialLoadFailed?: boolean;
  readonly providerAvailable?: boolean;
  readonly publicHttpTransport?: boolean;
  readonly sourceOptions?: readonly SourceOption[];
  readonly view?: "finder" | "saved";
}) {
  const [items, setItems] = useState(initialItems);
  const [selectedSourceId, setSelectedSourceId] = useState(sourceOptions[0]?.signal.id ?? "");
  const [consent, setConsent] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialLoadFailed ? "Penyimpanan hipotesis belum siap. Terapkan migrasi database 018 sebelum menggunakan Finder." : null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedSource = useMemo(
    () => sourceOptions.find(({ signal }) => signal.id === selectedSourceId) ?? null,
    [selectedSourceId, sourceOptions],
  );

  async function generate() {
    if (!providerAvailable || initialLoadFailed || !selectedSource || selectedSource.signal.classification !== "LIKELY_FNB" || !consent) return;
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/v1/opportunities/ideas", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshotId: selectedSource.snapshotId,
          signalId: selectedSource.signal.id,
          consent: true,
          disclosureVersion: "opportunities-ninerouter-profile-v2",
        }),
      });
      const payload = await response.json() as unknown;
      if (!response.ok) {
        setError(apiError(payload) ?? "Hipotesis AI belum tersedia.");
        return;
      }
      if (typeof payload !== "object" || payload === null || !("data" in payload) || !Array.isArray(payload.data)) {
        setError("Respons AI tidak memenuhi kontrak tampilan. Tidak ada hasil simulasi yang ditampilkan.");
        return;
      }
      const parsed = payload.data.map((item) => privateOpportunityIdeaResponseSchema.safeParse(item));
      if (parsed.some((item) => !item.success)) {
        setError("Respons AI tidak lolos validasi. Tidak ada hasil simulasi yang ditampilkan.");
        return;
      }
      const generatedItems = parsed.flatMap((item) => item.success ? [item.data] : []);
      setItems((current) => [...generatedItems, ...current].slice(0, 50));
      setNotice(`Tersimpan privat ${generatedItems.length} hipotesis dari 9Router. Setiap hipotesis perlu divalidasi.`);
      setConsent(false);
    } catch {
      setError("Koneksi ke layanan AI gagal. Tidak ada hasil simulasi yang ditampilkan.");
    } finally {
      setGenerating(false);
    }
  }

  async function toggleSaved(item: PrivateOpportunityIdeaDto) {
    setSavingId(item.id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/v1/opportunities/ideas", {
        method: "PATCH",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, saved: !item.saved }),
      });
      const payload = await response.json() as unknown;
      if (!response.ok) {
        setError(apiError(payload) ?? "Status simpan belum dapat diperbarui.");
        return;
      }
      if (typeof payload !== "object" || payload === null || !("data" in payload)) {
        setError("Status simpan tidak dapat diverifikasi.");
        return;
      }
      const parsed = privateOpportunityIdeaResponseSchema.safeParse(payload.data);
      if (!parsed.success) {
        setError("Status simpan tidak memenuhi kontrak tampilan.");
        return;
      }
      setItems((current) => current
        .map((candidate) => candidate.id === parsed.data.id ? parsed.data : candidate)
        .filter((candidate) => view !== "saved" || candidate.saved));
      setNotice(parsed.data.saved ? "Hipotesis tersimpan di akun Anda." : "Hipotesis dihapus dari daftar simpanan.");
    } catch {
      setError("Koneksi untuk menyimpan hipotesis gagal.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <PageContainer>
      <div className="grid gap-24 py-32 sm:py-48 lg:py-64">
        <header className="grid max-w-[760px] gap-12">
          <p className="text-label-bold font-w460 text-royal-violet">Opportunity Intelligence</p>
          <h1 className="text-heading-lg font-w460 leading-heading-lg text-ink-charcoal sm:text-display sm:leading-display">
            {view === "saved" ? "Saved Opportunities" : "Opportunity Finder"}
          </h1>
          <p className="text-body leading-body text-stone-gray">
            Ide dibuat dari sinyal pencarian live dan konteks profil yang diizinkan. Ide adalah hipotesis pribadi, bukan Opportunity terbit atau bukti permintaan pasar.
          </p>
        </header>

        {view === "finder" ? (
          <section aria-labelledby="generate-ideas-title" className="grid max-w-[860px] gap-14 border-y border-soft-mist py-20">
            <h2 className="text-heading-sm font-w460 text-ink-charcoal" id="generate-ideas-title">Buat hipotesis dari sinyal terbaru</h2>
            {sourceOptions.length === 0 ? (
              <div className="grid gap-8">
                <p className="text-body-sm leading-body-sm text-stone-gray">Belum ada sinyal F&amp;B live pada rentang ini. Muat observasi Google Trends terlebih dahulu.</p>
                <Link className="inline-flex min-h-button w-fit items-center text-body-sm font-w540 text-royal-violet underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet" href="/trends">Buka Trend Radar</Link>
              </div>
            ) : (
              <>
                <label className="grid gap-6 text-body-sm font-w540 text-ink-charcoal" htmlFor="opportunity-source-signal">
                  Sinyal Google Trends
                  <select
                    className="min-h-button min-w-0 rounded-small-buttons border border-soft-mist bg-paper-white px-12 text-body-sm text-ink-charcoal"
                    id="opportunity-source-signal"
                    onChange={(event) => setSelectedSourceId(event.target.value)}
                    value={selectedSourceId}
                  >
                    {sourceOptions.map(({ signal }) => (
                      <option disabled={signal.classification !== "LIKELY_FNB"} key={signal.id} value={signal.id}>
                        {signal.title} ({signal.classification === "LIKELY_FNB" ? "heuristik F&B" : "perlu tinjauan"})
                      </option>
                    ))}
                  </select>
                </label>
                {selectedSource ? (
                  <p className="text-caption leading-body-sm text-stone-gray">Sumber: Google Trends. Diambil {new Date(selectedSource.signal.source.retrievedAt).toLocaleString("id-ID")} WIB. Label F&amp;B berasal dari heuristic, bukan review faktual.</p>
                ) : null}
                {publicHttpTransport ? <p className="border-l-2 border-ink-charcoal bg-white px-12 py-10 text-body-sm leading-body-sm text-ink-charcoal" role="alert">Peringatan transport: koneksi ke 9Router memakai HTTP publik tanpa enkripsi. Kunci API dan konteks yang dikirim dapat terlihat di jalur jaringan. Gunakan hanya profil uji sintetis dan jangan lanjutkan dengan data sensitif.</p> : null}
                <label className="flex items-start gap-10 text-body-sm leading-body-sm text-ink-charcoal">
                  <input checked={consent} className="mt-3 size-16 accent-royal-violet" onChange={(event) => setConsent(event.target.checked)} type="checkbox" />
                  <span>Saya setuju kategori produk/minat, jenis produk yang diminati bila diisi, segmen pelanggan, kanal penjualan, dan bila tersedia tingkat pengalaman/komitmen waktu dari profil server serta judul sinyal terpilih dikirim ke 9Router untuk membuat hipotesis. Nama akun, email, lokasi, catatan bebas, dan angka finansial tidak dikirim. Hasil disimpan privat pada akun saya. Retensi dan penggunaan lanjutan oleh 9Router belum diverifikasi.{publicHttpTransport ? " Saya memahami request ini memakai HTTP publik tanpa enkripsi dan hanya melanjutkan dengan profil uji sintetis." : ""}</span>
                </label>
                {!providerAvailable ? <p className="text-body-sm text-stone-gray" role="status">Konfigurasi 9Router belum siap atau tidak diizinkan pada lingkungan ini. Profil tidak dikirim dan inference belum dijalankan.</p> : null}
                {initialLoadFailed ? <p className="text-body-sm text-stone-gray" role="status">Penyimpanan hipotesis belum siap. Tidak ada request AI yang akan dikirim sampai database siap.</p> : null}
                <button
                  className="min-h-44 w-fit rounded-full border border-ink-charcoal bg-lilac-mist px-18 py-10 text-body-sm font-w540 text-ink-charcoal transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!providerAvailable || initialLoadFailed || !consent || generating || !selectedSource || selectedSource.signal.classification !== "LIKELY_FNB"}
                  onClick={() => void generate()}
                  type="button"
                >
                  {generating ? "Meminta 9Router..." : "Buat hipotesis dengan 9Router"}
                </button>
              </>
            )}
          </section>
        ) : null}

        {error ? <p aria-live="polite" className="border-l-2 border-ink-charcoal bg-white px-14 py-12 text-body-sm text-ink-charcoal" role="alert">{error}</p> : null}
        {notice ? <p aria-live="polite" className="border-l-2 border-royal-violet bg-white px-14 py-12 text-body-sm text-ink-charcoal" role="status">{notice}</p> : null}

        {items.length === 0 && initialLoadFailed ? (
          <EmptyState
            action={<Link className="text-body-sm font-w540 text-royal-violet underline underline-offset-4" href="/opportunities">Coba kembali</Link>}
            description="Penyimpanan hipotesis belum siap. Terapkan migrasi database 018 sebelum menggunakan daftar ini."
            title="Penyimpanan belum tersedia"
          />
        ) : items.length === 0 ? (
          <EmptyState
            action={view === "saved" ? <Link className="text-body-sm font-w540 text-royal-violet underline underline-offset-4" href="/opportunities">Buka Opportunity Finder</Link> : null}
            description={view === "saved" ? "Belum ada hipotesis yang disimpan." : "Setelah memuat sinyal live, pilih sinyal dan minta hipotesis secara eksplisit."}
            title={view === "saved" ? "Belum ada simpanan" : "Belum ada hipotesis pribadi"}
          />
        ) : (
          <ul aria-label={view === "saved" ? "Hipotesis tersimpan pribadi" : "Hipotesis peluang pribadi"} className="grid gap-16">
            {items.map((item) => (
              <li data-hypothesis-id={item.id} key={item.id}>
                <Card className="p-20 sm:p-24">
                  <article className="grid gap-12">
                    <p className="text-label-bold font-w540 text-royal-violet">Hipotesis Peluang | Perlu Validasi</p>
                    <h2 className="wrap-anywhere text-heading-sm font-w460 text-ink-charcoal">{item.hypothesis.title}</h2>
                    <p className="wrap-anywhere text-body-sm leading-body-sm text-ink-charcoal">{item.hypothesis.concept}</p>
                    <div className="grid gap-6 text-body-sm text-stone-gray">
                      <p><strong className="font-w540 text-ink-charcoal">Pelanggan yang perlu diuji:</strong> {item.hypothesis.targetCustomer}</p>
                      <div>
                        <p className="font-w540 text-ink-charcoal">Langkah validasi</p>
                        <ol className="list-decimal pl-20">{item.hypothesis.validationSteps.map((step, index) => <li key={`${item.id}-step-${index}`}>{step}</li>)}</ol>
                      </div>
                      <div>
                        <p className="font-w540 text-ink-charcoal">Asumsi yang belum terbukti</p>
                        <ul className="list-disc pl-20">{item.hypothesis.assumptions.map((assumption, index) => <li key={`${item.id}-assumption-${index}`}>{assumption}</li>)}</ul>
                      </div>
                    </div>
                    <p className="border-t border-soft-mist pt-10 text-caption text-stone-gray">Sumber: {item.source.publisher}, sinyal “{item.source.title}”, diambil {new Date(item.source.retrievedAt).toLocaleString("id-ID")} WIB. Screening {item.source.classification === "LIKELY_FNB" ? "heuristik F&B" : "memerlukan review"}. Tidak membuktikan permintaan, pembelian, pendapatan, kompetisi, atau keberhasilan.</p>
                    <p className="text-caption text-stone-gray">Dihasilkan {new Date(item.generatedAt).toLocaleString("id-ID")} WIB oleh {item.provider}, model {item.model}. Hasil ini disimpan privat untuk akun Anda.</p>
                    <button
                      className="min-h-44 w-fit rounded-full border border-ink-charcoal px-16 py-10 text-body-sm font-w540 text-ink-charcoal hover:bg-lilac-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={savingId === item.id}
                      onClick={() => void toggleSaved(item)}
                      type="button"
                    >
                      {savingId === item.id ? "Menyimpan..." : item.saved ? "Hapus dari simpanan" : "Simpan hipotesis"}
                    </button>
                  </article>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageContainer>
  );
}
