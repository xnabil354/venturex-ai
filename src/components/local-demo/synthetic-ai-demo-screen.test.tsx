// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SyntheticAIDemoScreen } from "./synthetic-ai-demo-screen";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("SyntheticAIDemoScreen", () => {
  it.each([
    {
      execution: {
        mode: "MOCK" as const,
        provider: "local-mock" as const,
        model: "synthetic-fixture-v1" as const,
        displayLabel: "Contoh hasil simulasi — bukan respons 9Router live" as const,
      },
      expectedMode: "Mode MOCK · tidak ada request ke 9Router.",
    },
    {
      execution: {
        mode: "LIVE_SYNTHETIC" as const,
        provider: "ninerouter" as const,
        model: "cx/gpt-6-luna-xhigh" as const,
        displayLabel: "Analisis 9Router — menggunakan profil demo sintetis" as const,
      },
      expectedMode: "REAL_NINEROUTER · Mode LIVE_SYNTHETIC · ninerouter · cx/gpt-6-luna-xhigh · fixture sintetis.",
    },
  ])("requires explicit fixture selection and labels $execution.mode from server metadata", async ({ execution, expectedMode }) => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      data: {
        fixtureId: "DEMO_ENTREPRENEUR",
        fixtureVersion: "synthetic-fixture-v1",
        fixtureContentHash: "a".repeat(64),
        personaLabel: "Calon pengusaha — profil sintetis",
        profile: { summary: "Profil sintetis." },
        opportunity: { name: "Konsep simulasi", description: "Deskripsi sintetis.", hypothesisLabel: "Hipotesis simulasi" },
        evidence: { status: "UNAVAILABLE", records: [], reason: "Tidak ada evidence." },
        decisionSupport: {
          opportunityScore: { status: "UNAVAILABLE", reason: "Tidak dihitung." },
          fitScore: { status: "UNAVAILABLE", reason: "Tidak dihitung." },
          riskAssessment: { status: "UNAVAILABLE", reason: "Tidak dihitung." },
        },
        limitations: ["Hanya simulasi."],
        analysis: {
          summary: "Contoh saja.", whyRelevant: "Profil sintetis.", targetConsumer: "Belum diketahui.",
          competition: "Tidak ada data.", potential: "Tidak dinilai.", risks: ["Bukan bukti."], nextAction: "Uji hipotesis.",
        },
        evidenceReferences: [],
        execution,
      },
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<SyntheticAIDemoScreen />);
    expect(screen.getByRole("button", { name: "Tampilkan contoh analisis" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: /Calon pengusaha/ }));
    fireEvent.click(screen.getByRole("button", { name: "Tampilkan contoh analisis" }));
    expect(await screen.findByText(execution.displayLabel)).toBeTruthy();
    expect(screen.getByText(expectedMode)).toBeTruthy();
    expect(screen.getByText("Opportunity Score: tidak tersedia", { exact: false })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows provider failures and rejects invalid response shapes without rendering a result", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: "DEMO_UPSTREAM_UNAVAILABLE" }, 503))
      .mockResolvedValueOnce(jsonResponse({ data: { summary: "invalid" } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<SyntheticAIDemoScreen />);
    fireEvent.click(screen.getByRole("radio", { name: /Pelaku UMKM/ }));
    fireEvent.click(screen.getByRole("button", { name: "Tampilkan contoh analisis" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("9Router melaporkan layanan sementara tidak tersedia (HTTP 503)");
    expect(screen.getByRole("alert").textContent).toContain("Tidak ada retry otomatis");
    fireEvent.click(screen.getByRole("button", { name: "Tampilkan contoh analisis" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Respons simulasi tidak valid");
    expect(screen.queryByText("Contoh hasil simulasi — bukan respons 9Router live")).toBeNull();
  });
});
