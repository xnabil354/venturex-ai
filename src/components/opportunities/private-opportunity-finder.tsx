"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Badge, Button, Card, EmptyState, PageContainer, StatusNotice } from "@/components/ui";
import { cx } from "@/lib/cx";
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
      const response = await fetch(`/api/v1/opportunities/ideas/${item.id}/saved`, {
        method: "PATCH",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saved: !item.saved }),
      });
      const payload = await response.json() as unknown;
      if (!response.ok) {
        setError(apiError(payload) ?? "Penyimpanan hipotesis gagal diperbarui.");
        return;
      }
      const parsed = privateOpportunityIdeaResponseSchema.safeParse(
        typeof payload === "object" && payload !== null && "data" in payload ? payload.data : null,
      );
      if (!parsed.success) {
        setError("Respons pembaruan penyimpanan tidak valid.");
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
        <header className="grid max-w-[760px] gap-12 border-b border-soft-mist pb-24">
          <div className="flex items-center gap-12">
            <h1 className="text-heading-lg font-w460 leading-heading-lg text-ink-charcoal sm:text-display sm:leading-display">
              {view === "saved" ? "Saved Opportunities" : "Opportunity Finder"}
            </h1>
            <span className="rounded-pills border border-soft-mist bg-paper-white px-10 py-3 text-caption font-w540 uppercase tracking-wider text-royal-violet shadow-2xs">
              {view === "saved" ? "Arsip Pribadi" : "Sintesis Hipotesis AI"}
            </span>
          </div>
          <p className="text-body leading-relaxed text-stone-gray">
            Ide dibuat dari sinyal pencarian live dan konteks profil yang diizinkan. Ide adalah hipotesis pribadi, bukan Opportunity terbit atau bukti permintaan pasar.
          </p>
        </header>

        {view === "finder" ? (
          <Card aria-labelledby="generate-ideas-title" className="grid max-w-[860px] gap-20 p-20 sm:p-28 border-[#ded8cb] bg-[#faf9f6]">
            <div className="flex flex-wrap items-baseline justify-between gap-8 border-b border-soft-mist pb-16">
              <h2 className="text-heading-sm font-w460 text-ink-charcoal" id="generate-ideas-title">
                Buat hipotesis dari sinyal terbaru
              </h2>
              <span className="text-caption text-stone-gray">Alur 3-Langkah Terpandu</span>
            </div>

            {sourceOptions.length === 0 ? (
              <div className="grid gap-12">
                <p className="text-body-sm leading-body-sm text-stone-gray">
                  Belum ada sinyal F&amp;B live pada rentang ini. Muat observasi Google Trends terlebih dahulu.
                </p>
                <Link
                  className="inline-flex min-h-button w-fit items-center text-body-sm font-w540 text-royal-violet underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet"
                  href="/trends"
                >
                  Buka Trend Radar
                </Link>
              </div>
            ) : (
              <div className="grid gap-20">
                {/* Langkah 1: Pemilihan Sinyal */}
                <div className="grid gap-8">
                  <div className="flex items-center gap-8">
                    <span className="flex size-28 items-center justify-center rounded-full border border-midnight-wine bg-midnight-wine text-caption font-w540 text-paper-white shadow-xs">1</span>
                    <label className="text-body-sm font-w540 text-ink-charcoal" htmlFor="opportunity-source-signal">
                      Pilih Sinyal Google Trends
                    </label>
                  </div>
                  <select
                    className="min-h-44 min-w-0 rounded-small-buttons border border-[#ded8cb] bg-paper-white px-12 text-body-sm text-ink-charcoal focus:border-royal-violet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet"
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
                  {selectedSource ? (
                    <div className="rounded-small-buttons bg-warm-parchment p-12 text-caption leading-body-sm text-stone-gray border border-[#ded8cb]">
                      Sumber: Google Trends · Diambil {new Date(selectedSource.signal.source.retrievedAt).toLocaleString("id-ID")} WIB · Label F&amp;B berasal dari heuristic, bukan review faktual.
                    </div>
                  ) : null}
                </div>

                {/* Langkah 2: Persetujuan Privasi & Batasan */}
                <div className="grid gap-12 border-t border-soft-mist pt-16">
                  <div className="flex items-center gap-8">
                    <span className="flex size-28 items-center justify-center rounded-full border border-midnight-wine bg-midnight-wine text-caption font-w540 text-paper-white shadow-xs">2</span>
                    <span className="text-body-sm font-w540 text-ink-charcoal">
                      Persetujuan Pengiriman Data Profil Minimal
                    </span>
                  </div>

                  {publicHttpTransport ? (
                    <StatusNotice role="alert" tone="error">
                      Peringatan transport: koneksi ke 9Router memakai HTTP publik tanpa enkripsi. Kunci API dan konteks yang dikirim dapat terlihat di jalur jaringan. Gunakan hanya profil uji sintetis dan jangan lanjutkan dengan data sensitif.
                    </StatusNotice>
                  ) : null}

                  <label
                    className={cx(
                      "flex cursor-pointer items-start gap-12 rounded-cards border p-16 sm:p-20 text-body-sm leading-body-sm text-ink-charcoal transition-[background-color,border-color,transform] duration-200 active:translate-y-px focus-within:ring-2 focus-within:ring-royal-violet/40",
                      consent
                        ? "border-midnight-wine bg-lilac-mist/40"
                        : "border-soft-mist bg-warm-parchment/60 hover:border-stone-gray",
                    )}
                  >
                    <input
                      checked={consent}
                      className="mt-3 size-16 accent-midnight-wine"
                      onChange={(event) => setConsent(event.target.checked)}
                      type="checkbox"
                    />
                    <span>
                      Saya setuju kategori produk/minat, jenis produk yang diminati bila diisi, segmen pelanggan, kanal penjualan, dan bila tersedia tingkat pengalaman/komitmen waktu dari profil server serta judul sinyal terpilih dikirim ke 9Router untuk membuat hipotesis. Nama akun, email, lokasi, catatan bebas, dan angka finansial tidak dikirim. Hasil disimpan privat pada akun saya. Retensi dan penggunaan lanjutan oleh 9Router belum diverifikasi.{publicHttpTransport ? " Saya memahami request ini memakai HTTP publik tanpa enkripsi dan hanya melanjutkan dengan profil uji sintetis." : ""}
                    </span>
                  </label>

                  {!providerAvailable ? (
                    <p className="text-body-sm text-stone-gray" role="status">
                      Konfigurasi 9Router belum siap atau tidak diizinkan pada lingkungan ini. Profil tidak dikirim dan inference belum dijalankan.
                    </p>
                  ) : null}
                  {initialLoadFailed ? (
                    <p className="text-body-sm text-stone-gray" role="status">
                      Penyimpanan hipotesis belum siap. Tidak ada request AI yang akan dikirim sampai database siap.
                    </p>
                  ) : null}
                </div>

                {/* Langkah 3: Eksekusi */}
                <div className="grid gap-8 border-t border-soft-mist pt-16">
                  <div className="flex items-center gap-8">
                    <span className="flex size-28 items-center justify-center rounded-full border border-midnight-wine bg-midnight-wine text-caption font-w540 text-paper-white shadow-xs">3</span>
                    <span className="text-body-sm font-w540 text-ink-charcoal">
                      Eksekusi Hipotesis
                    </span>
                  </div>
                  <Button
                    disabled={!providerAvailable || initialLoadFailed || !consent || generating || !selectedSource || selectedSource.signal.classification !== "LIKELY_FNB"}
                    loading={generating}
                    onClick={() => void generate()}
                    type="button"
                    variant="primary"
                  >
                    {generating ? "Meminta 9Router..." : "Buat hipotesis dengan 9Router"}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ) : null}

        {error ? <StatusNotice aria-live="polite" role="alert" tone="error">{error}</StatusNotice> : null}
        {notice ? <StatusNotice aria-live="polite" role="status" tone="success">{notice}</StatusNotice> : null}

        {items.length === 0 && initialLoadFailed ? (
          <EmptyState
            action={<Link className="inline-flex min-h-button items-center text-body-sm font-w540 text-royal-violet underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-royal-violet" href="/opportunities">Coba kembali</Link>}
            description="Penyimpanan hipotesis belum siap. Terapkan migrasi database 018 sebelum menggunakan daftar ini."
            title="Penyimpanan belum tersedia"
          />
        ) : items.length === 0 ? (
          <EmptyState
            action={view === "saved" ? <Link className="inline-flex min-h-button items-center text-body-sm font-w540 text-royal-violet underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-royal-violet" href="/opportunities">Buka Opportunity Finder</Link> : null}
            description={view === "saved" ? "Belum ada hipotesis yang disimpan." : "Setelah memuat sinyal live, pilih sinyal dan minta hipotesis secara eksplisit."}
            title={view === "saved" ? "Belum ada simpanan" : "Belum ada hipotesis pribadi"}
          />
        ) : (
          <ul aria-label={view === "saved" ? "Hipotesis tersimpan pribadi" : "Hipotesis peluang pribadi"} className="grid gap-16">
            {items.map((item) => (
              <li data-hypothesis-id={item.id} key={item.id}>
                <Card className="grid gap-16 p-20 sm:p-24 transition-all duration-300 border-[#ded8cb] bg-[#faf9f6] hover:border-midnight-wine/40 hover:-translate-y-1 hover:shadow-lg">
                  <article className="grid gap-14">
                    <div className="flex flex-wrap items-center justify-between gap-8">
                      <Badge tone="wash">Hipotesis peluang · perlu validasi</Badge>
                      <span className="text-caption font-w460 text-stone-gray">Privat untuk akun Anda</span>
                    </div>

                    <h2 className="wrap-anywhere text-heading-sm font-w460 text-ink-charcoal">
                      {item.hypothesis.title}
                    </h2>

                    <p className="wrap-anywhere text-body leading-body text-ink-charcoal">
                      {item.hypothesis.concept}
                    </p>

                    <div className="grid gap-12 rounded-small-buttons bg-warm-parchment p-16 sm:p-20 border border-[#ded8cb] text-body-sm transition-colors hover:border-midnight-wine/30">
                      <p>
                        <strong className="font-w540 text-ink-charcoal">Pelanggan yang perlu diuji:</strong>{" "}
                        <span className="text-stone-gray">{item.hypothesis.targetCustomer}</span>
                      </p>
                      <div className="grid gap-6">
                        <p className="font-w540 text-ink-charcoal">Langkah validasi</p>
                        <ol className="grid gap-4 list-decimal pl-20 text-stone-gray">
                          {item.hypothesis.validationSteps.map((step, index) => (
                            <li key={`${item.id}-step-${index}`}>{step}</li>
                          ))}
                        </ol>
                      </div>
                      <div className="grid gap-6">
                        <p className="font-w540 text-ink-charcoal">Asumsi yang belum terbukti</p>
                        <ul className="grid gap-4 list-disc pl-20 text-stone-gray">
                          {item.hypothesis.assumptions.map((assumption, index) => (
                            <li key={`${item.id}-assumption-${index}`}>{assumption}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="grid gap-4 border-t border-soft-mist pt-12 text-caption text-stone-gray">
                      <p>
                        Sumber: {item.source.publisher}, sinyal “{item.source.title}”, diambil {new Date(item.source.retrievedAt).toLocaleString("id-ID")} WIB. Screening {item.source.classification === "LIKELY_FNB" ? "heuristik F&B" : "memerlukan review"}. Tidak membuktikan permintaan, pembelian, pendapatan, kompetisi, atau keberhasilan.
                      </p>
                      <p>
                        Dihasilkan {new Date(item.generatedAt).toLocaleString("id-ID")} WIB oleh {item.provider}, model {item.model}. Hasil ini disimpan privat untuk akun Anda.
                      </p>
                    </div>

                    <div className="pt-4">
                      <Button
                        disabled={savingId === item.id}
                        loading={savingId === item.id}
                        onClick={() => void toggleSaved(item)}
                        type="button"
                        variant="secondary"
                      >
                        {savingId === item.id ? "Menyimpan..." : item.saved ? "Hapus dari simpanan" : "Simpan hipotesis"}
                      </Button>
                    </div>
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
