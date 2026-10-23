// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { LiveTrendSignalsPanel } from "./live-trend-signals-panel";
import type { LiveTrendAnalysisResponse, LiveTrendSignalsResponse } from "@/trend/live-signals-contract";

const signalId = "80000000-0000-4000-8000-000000000002";
const snapshotId = "80000000-0000-4000-8000-000000000001";

const snapshot: LiveTrendSignalsResponse = {
  snapshotId,
  mode: "MOCK_TEST",
  generatedAt: "2026-10-14T04:01:00.000Z",
  retrievedAt: "2026-10-14T04:00:00.000Z",
  expiresAt: "2026-10-14T04:06:00.000Z",
  batchStatus: "PARTIAL",
  freshness: "CURRENT",
  cache: "NETWORK",
  source: {
    publisher: "Google Trends",
    url: "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1",
    geo: "ID",
    timeWindowHours: 24,
  },
  records: { retrieved: 3, accepted: 2, rejected: 1 },
  relatedQueriesAvailability: { available: 1, unavailable: 1, invalid: 0, uninspectable: 0 },
  screening: {
    inputRecords: 3,
    acceptedParsedRecords: 2,
    rejectedParsedRecords: 1,
    uniqueScreenedGroups: 2,
    classifications: { LIKELY_FNB: 1, REVIEW_REQUIRED: 1, OUT_OF_SCOPE: 0 },
  },
  signals: [{
    id: signalId,
    title: "kopi susu",
    classification: "LIKELY_FNB",
    matchedKeywords: ["kopi susu"],
    screeningExplanation: "Heuristic keyword match.",
    observationCount: 1,
    source: {
      publisher: "Google Trends",
      url: "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1",
      geo: "ID",
      retrievedAt: "2026-10-14T04:00:00.000Z",
      providerStartedAtUnixSeconds: 1_765_000_000,
      timeWindowHours: 24,
    },
    metrics: {
      volume: { availability: "AVAILABLE", value: "2K+", unit: "UNSPECIFIED" },
      volumeChange: { availability: "UNAVAILABLE", value: null, unit: "UNSPECIFIED" },
      active: { value: true, semantics: "PROVIDER_FLAG_UNVERIFIED" },
      categoriesCount: 1,
      relatedQueries: "UNAVAILABLE",
    },
    limitations: ["Search activity is not proof of purchase demand."],
  }],
  analysisAvailability: { status: "AVAILABLE", reason: "READY" },
  cacheLimitations: ["Test fixture only; not provider evidence."],
};

const analysis: LiveTrendAnalysisResponse = {
  analysis: {
    summary: "Uji ringkasan sintetis.",
    whyRelevant: "Uji relevansi sintetis.",
    targetConsumer: "Uji konsumen sintetis.",
    competition: "Bukti kompetisi tidak tersedia.",
    potential: "Hipotesis sintetis yang perlu divalidasi.",
    risks: ["Pencarian tidak membuktikan pembelian."],
    nextAction: "Uji wawancara pelanggan.",
  },
  provider: "ninerouter",
  model: "cx/gpt-6-luna-xhigh",
  mode: "MOCK_TEST",
  generatedAt: "2026-10-14T04:02:00.000Z",
  sourceReference: {
    title: "kopi susu",
    publisher: "Google Trends",
    url: "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1",
    retrievedAt: "2026-10-14T04:00:00.000Z",
    classification: "LIKELY_FNB",
  },
  limitations: ["Synthetic UI test data; not a 9Router response."],
};

function success(data: unknown): Response {
  return new Response(JSON.stringify({ data, requestId: "req_test" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LiveTrendSignalsPanel", () => {
  it("does not fetch on page load and explains an operation-specific rights block", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      error: { code: "DISPLAY_RIGHTS_UNVERIFIED", message: "Konten Google Trends belum dapat ditampilkan sebelum izin penggunaan dikonfirmasi." },
      requestId: "req_test",
    }), { status: 403, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetcher);
    render(<LiveTrendSignalsPanel />);

    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Muat sinyal terbaru" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Sinyal belum dapat dimuat. Coba lagi."));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Analisis tren" })).toBeNull();
  });

  it("renders provider attribution and the partial-source result without calling mock content live", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => success(snapshot));
    vi.stubGlobal("fetch", fetcher);
    render(<LiveTrendSignalsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Muat sinyal terbaru" }));
    await screen.findByText("Mode contoh menggunakan data simulasi.");
    expect(screen.getByRole("heading", { name: "kopi susu" })).toBeTruthy();
    expect(document.body.textContent).not.toContain("Snapshot uji ");
    expect(document.body.textContent).not.toContain("Bright Data");
    expect(screen.getByRole("link", { name: "Google Trends Trending Now (Indonesia)" })).toBeTruthy();
    expect(screen.getByText("Google Trends Trending Now (Indonesia)")).toBeTruthy();
    expect(document.body.textContent).not.toContain("sumber diambil");
    expect(screen.queryByText("Diterima 2 dari 3; ditolak 1.", { exact: false })).toBeNull();
    expect(screen.getByText("Volume Sumber").parentElement?.textContent).toContain("2K+");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("requires consent and renders all seven structured fields from the wrapped analysis contract", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(success(snapshot))
      .mockResolvedValueOnce(success(analysis));
    vi.stubGlobal("fetch", fetcher);
    render(<LiveTrendSignalsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Muat sinyal terbaru" }));
    await screen.findByText("Mode contoh menggunakan data simulasi.");
    fireEvent.click(screen.getByRole("button", { name: "Analisis tren" }));
    const submit = screen.getByRole("button", { name: "Mulai analisis" });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getAllByRole("checkbox")[1]!);
    fireEvent.click(submit);

    await screen.findByText("Analisis selesai");
    for (const label of ["Ringkasan", "Mengapa relevan", "Konsumen sasaran", "Kompetisi", "Potensi sebagai hipotesis", "Risiko", "Langkah berikutnya"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText("Uji ringkasan sintetis.")).toBeTruthy();
    expect(screen.getByText("Synthetic UI test data; not a 9Router response.")).toBeTruthy();
    expect(fetcher).toHaveBeenCalledTimes(2);
    const request = JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body)) as Record<string, unknown>;
    expect(request).toEqual({
      snapshotId,
      signalId,
      consent: true,
      disclosureVersion: "trends-ninerouter-profile-v2",
    });
  });

  it("offers only a delayed manual retry after a sanitized upstream 503", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(success(snapshot))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: {
        code: "AI_UPSTREAM_UNAVAILABLE",
        message: "9Router melaporkan layanan sementara tidak tersedia.",
      } }), { status: 503, headers: { "content-type": "application/json", "retry-after": "60" } }));
    vi.stubGlobal("fetch", fetcher);
    render(<LiveTrendSignalsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Muat sinyal terbaru" }));
    await screen.findByRole("heading", { name: "kopi susu" });
    fireEvent.click(screen.getByRole("button", { name: "Analisis tren" }));
    fireEvent.click(screen.getAllByRole("checkbox")[1]!);
    fireEvent.click(screen.getByRole("button", { name: "Mulai analisis" }));

    await screen.findByRole("alert");
    const retry = screen.getByRole("button", { name: "Coba lagi dalam 60 detik" }) as HTMLButtonElement;
    expect(retry.disabled).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("uses the profile keyword as a local filter and applies the selected time window only on manual refresh", async () => {
    const baksoSignal = {
      ...snapshot.signals[0]!,
      id: "80000000-0000-4000-8000-000000000003",
      title: "bakso bakar",
      matchedKeywords: ["bakso"],
    };
    const withBakso: LiveTrendSignalsResponse = { ...snapshot, signals: [...snapshot.signals, baksoSignal] };
    const fetcher = vi.fn<typeof fetch>(async () => success(withBakso));
    vi.stubGlobal("fetch", fetcher);
    render(<LiveTrendSignalsPanel initialKeyword="bakso" />);

    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("combobox", { name: /Rentang Trending Now/u }), { target: { value: "168" } });
    fireEvent.click(screen.getByRole("button", { name: "Muat sinyal terbaru" }));

    await screen.findByRole("heading", { name: "bakso bakar" });
    expect(screen.queryByRole("heading", { name: "kopi susu" })).toBeNull();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("?hours=168");

    fireEvent.change(screen.getByRole("textbox", { name: /Kata kunci produk dari profil/u }), { target: { value: "kopi" } });
    await screen.findByRole("heading", { name: "kopi susu" });
    expect(screen.queryByRole("heading", { name: "bakso bakar" })).toBeNull();
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
