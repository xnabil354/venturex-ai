// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OpportunityComparisonItem, OpportunityComparisonResult } from "@/opportunity/compare-domain";
import { OpportunityComparisonPanel, useOpportunityCompare } from "./opportunity-comparison";

const ids = [
  "60000000-0000-4000-8000-000000000001",
  "60000000-0000-4000-8000-000000000002",
  "60000000-0000-4000-8000-000000000003",
  "60000000-0000-4000-8000-000000000004",
] as const;

function item(id: string, name: string): OpportunityComparisonItem {
  return {
    opportunityId: id,
    name,
    categoryName: "Minuman",
    opportunityScore: { status: "AVAILABLE", value: 72.5, explanation: "Dari konfigurasi score yang disetujui." },
    fitScore: { status: "INSUFFICIENT_DATA", value: null, explanation: "Data profil belum cukup." },
    relatedTrend: { status: "AVAILABLE", value: { title: "Tren minuman", direction: "RISING" }, explanation: "Trend terpublikasi." },
    competition: { status: "AVAILABLE", value: { level: "MEDIUM", summary: "Kompetisi perlu diverifikasi." }, explanation: "Dari data Opportunity tersimpan." },
    risk: { status: "UNAVAILABLE", value: null, explanation: "Risk policy belum tersedia." },
    executionFeasibility: { status: "AVAILABLE", value: 75, explanation: "Nilai tersimpan pada Opportunity." },
  };
}

function Harness({ count = 4 }: { readonly count?: number }) {
  const compareState = useOpportunityCompare();
  return (
    <div>
      {ids.slice(0, count).map((id, index) => {
        const name = `Peluang ${index + 1}`;
        return (
          <label key={id}>
            <input
              aria-label={`Pilih ${name}`}
              checked={compareState.selected.some((selection) => selection.id === id)}
              disabled={compareState.loading}
              onChange={() => compareState.toggle({ id, name })}
              type="checkbox"
            />
            {name}
          </label>
        );
      })}
      <OpportunityComparisonPanel compareState={compareState} />
    </div>
  );
}

function availableResult(selectedIds: readonly string[]): OpportunityComparisonResult {
  return { items: selectedIds.map((id, index) => item(id, `Peluang ${index + 1}`)) };
}

function successfulFetch(result: OpportunityComparisonResult) {
  return vi.fn(async () => ({
    ok: true,
    json: async () => ({ success: true, data: result }),
  } as Response));
}

describe("OpportunityComparisonPanel", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows empty selection guidance and disables Compare below two selected opportunities", () => {
    render(<Harness />);

    expect(screen.getAllByRole("status")[0]?.textContent).toContain("Belum ada peluang dipilih");
    expect((screen.getByRole("button", { name: "Bandingkan (0/3)" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("enforces three selections, gives feedback, and lets the user remove a selection", () => {
    render(<Harness />);
    fireEvent.click(screen.getByLabelText("Pilih Peluang 1"));
    fireEvent.click(screen.getByLabelText("Pilih Peluang 2"));
    fireEvent.click(screen.getByLabelText("Pilih Peluang 3"));
    fireEvent.click(screen.getByLabelText("Pilih Peluang 4"));

    expect(screen.getByRole("alert").textContent).toContain("Maksimal tiga peluang");
    expect((screen.getByRole("button", { name: "Bandingkan (3/3)" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByLabelText("Pilih Peluang 4") as HTMLInputElement).checked).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Hapus Peluang 2 dari perbandingan" }));
    expect((screen.getByRole("button", { name: "Bandingkan (2/3)" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByLabelText("Pilih Peluang 2") as HTMLInputElement).checked).toBe(false);
  });

  it("compares selected IDs and displays all six attributes with honest unavailable states and detail links", async () => {
    const selectedIds = ids.slice(0, 2);
    vi.stubGlobal("fetch", successfulFetch(availableResult(selectedIds)));
    render(<Harness />);
    fireEvent.click(screen.getByLabelText("Pilih Peluang 1"));
    fireEvent.click(screen.getByLabelText("Pilih Peluang 2"));
    fireEvent.click(screen.getByRole("button", { name: "Bandingkan (2/3)" }));

    await screen.findByRole("heading", { name: "Hasil perbandingan" });
    expect((await screen.findAllByText("Opportunity Score")).length).toBeGreaterThanOrEqual(2);
    for (const label of ["Fit Score", "Trend terkait", "Kompetisi", "Risiko", "Execution Feasibility"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(2);
    }
    expect(screen.getAllByText("Data belum cukup").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Belum tersedia").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole("link", { name: "Peluang 1" })[0]?.getAttribute("href")).toBe(`/opportunities/${ids[0]}`);
    expect(screen.getAllByRole("link", { name: "Peluang 2" })[0]?.getAttribute("href")).toBe(`/opportunities/${ids[1]}`);
    expect(document.body.textContent).not.toContain("Pemenang:");
    expect(fetch).toHaveBeenCalledWith("/api/v1/opportunities/compare", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ opportunityIds: selectedIds }),
    }));
  });

  it("shows a safe retry message when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      json: async () => ({ success: false, error: { code: "INTERNAL_ERROR", message: "database stack" } }),
    } as Response)));
    render(<Harness />);
    fireEvent.click(screen.getByLabelText("Pilih Peluang 1"));
    fireEvent.click(screen.getByLabelText("Pilih Peluang 2"));
    fireEvent.click(screen.getByRole("button", { name: "Bandingkan (2/3)" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Perbandingan belum dapat dimuat");
    expect(document.body.textContent).not.toContain("database stack");
  });

  it("exposes the loading state while comparison is in progress", async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolveResponse = resolve; })));
    render(<Harness />);
    fireEvent.click(screen.getByLabelText("Pilih Peluang 1"));
    fireEvent.click(screen.getByLabelText("Pilih Peluang 2"));
    fireEvent.click(screen.getByRole("button", { name: "Bandingkan (2/3)" }));

    expect(screen.getByRole("button", { name: "Loading" }).getAttribute("aria-busy")).toBe("true");
    expect((screen.getByLabelText("Pilih Peluang 1") as HTMLInputElement).disabled).toBe(true);
    resolveResponse?.({ ok: true, json: async () => ({ success: true, data: availableResult(ids.slice(0, 2)) }) } as Response);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Hasil perbandingan" })).toBeTruthy());
  });
});
