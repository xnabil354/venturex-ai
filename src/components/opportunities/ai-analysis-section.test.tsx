// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AIAnalysisSection } from "./ai-analysis-section";

const analysis = {
  analysisId: "b0000000-0000-4000-8000-000000000001",
  summary: "Peluang sebagai hipotesis awal.",
  whyRelevant: "Kategori ini sesuai dengan profil.",
  targetConsumer: "Wawancarai segmen yang tercatat.",
  competition: "Kompetisi katalog belum diverifikasi.",
  potential: "Potensi perlu diuji secara lokal.",
  risks: ["Evidence tidak mengukur seluruh pasar."],
  nextAction: "Wawancarai calon konsumen.",
  generatedAt: "2026-10-11T10:00:00.000Z",
  provider: "test-provider",
  model: "test-model",
  limitedEvidence: true,
};

function jsonResponse(payload: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload } as Response;
}

function success(data: unknown) {
  return { success: true, data };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AIAnalysisSection", () => {
  it("loads an existing structured analysis and labels limited evidence", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(success(analysis)));
    vi.stubGlobal("fetch", fetchMock);
    render(<AIAnalysisSection opportunityId="60000000-0000-4000-8000-000000000001" />);

    expect(screen.getByRole("status").textContent).toContain("Memuat AI Analysis");
    expect(await screen.findByText(analysis.summary)).toBeTruthy();
    expect(screen.getByText("Evidence terbatas. Analisis berisi interpretasi awal dan asumsi yang perlu diverifikasi.")).toBeTruthy();
    expect(screen.getByText(analysis.risks[0]!)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "GET", cache: "no-store" });
  });

  it("does not generate on page load and generates only after an explicit button action", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(success(null)))
      .mockResolvedValueOnce(jsonResponse(success(analysis)));
    vi.stubGlobal("fetch", fetchMock);
    render(<AIAnalysisSection opportunityId="60000000-0000-4000-8000-000000000001" />);

    const button = await screen.findByRole("button", { name: "Generate AI Analysis" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "GET" });
    fireEvent.click(button);
    expect(await screen.findByText(analysis.summary)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "POST", body: JSON.stringify({ forceRefresh: false }) });
  });

  it("shows an honest provider-unavailable state without fabricating output", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(success(null)))
      .mockResolvedValueOnce(jsonResponse({ success: false, error: { code: "AI_SERVICE_UNAVAILABLE" } }, 503));
    vi.stubGlobal("fetch", fetchMock);
    render(<AIAnalysisSection opportunityId="60000000-0000-4000-8000-000000000001" />);
    fireEvent.click(await screen.findByRole("button", { name: "Generate AI Analysis" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Layanan AI tidak tersedia atau belum dikonfigurasi");
    expect(screen.queryByText(analysis.summary)).toBeNull();
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeTruthy();
  });

  it("preserves a previously loaded analysis when a refresh fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(success(analysis)))
      .mockResolvedValueOnce(jsonResponse({ success: false, error: { code: "RATE_LIMITED" } }, 429));
    vi.stubGlobal("fetch", fetchMock);
    render(<AIAnalysisSection opportunityId="60000000-0000-4000-8000-000000000001" />);
    fireEvent.click(await screen.findByRole("button", { name: "Generate ulang AI Analysis" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Permintaan analisis terlalu sering"));
    expect(screen.getByText(analysis.summary)).toBeTruthy();
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "POST", body: JSON.stringify({ forceRefresh: true }) });
  });

  it("does not render malformed provider/cache data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(success({ ...analysis, risks: "invalid" })));
    vi.stubGlobal("fetch", fetchMock);
    render(<AIAnalysisSection opportunityId="60000000-0000-4000-8000-000000000001" />);
    expect((await screen.findByRole("alert")).textContent).toContain("AI Analysis belum dapat dimuat");
    expect(screen.queryByText(analysis.summary)).toBeNull();
  });
});
