// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PrivateHypothesisScoreDetail } from "./private-hypothesis-score-detail";
import { entrepreneurAnalysisSchema } from "@/opportunity/entrepreneur-analysis-contract";
import type { PrivateOpportunityIdeaDto } from "@/opportunity/private-hypothesis";

const score = { score: 65, coverage: 100, status: "PRELIMINARY", factors: [{ key: "example", label: "Contoh faktor", value: 65, weight: 1, basis: "MARKET", reason: "Bukti contoh khusus pengujian." }] };
const analysis = entrepreneurAnalysisSchema.parse({ version: "entrepreneur-decision-v2", generatedAt: "2026-10-21T01:00:00.000Z", inputFingerprint: "a".repeat(64), model: null, capitalMin: 500000,
  requirements: { categoryId: null, customerSegmentIds: [], salesChannelIds: [], requiredExperience: "BEGINNER", requiredTime: "PART_TIME", complexity: "SIMPLE", summary: "Konsep uji", rationale: "Uji kebutuhan", initialNeeds: ["Bahan uji"], assumptions: ["Minat perlu diuji"] },
  opportunity: score, fit: score, targetConsumer: "Keluarga", competition: "Sampel belum tersedia", risks: ["Perlu uji"], trend: null, competitors: null, warnings: [] });
const item: PrivateOpportunityIdeaDto = { id: "80000000-0000-4000-8000-000000000001", provider: "ninerouter", model: "cx/gpt-6-luna-xhigh", saved: false, generatedAt: analysis.generatedAt,
  hypothesis: { title: "Bakso keluarga", concept: "Uji konsep bakso ayam untuk keluarga sebelum menjalankan usaha secara penuh.", targetCustomer: "Keluarga", validationSteps: ["Uji rasa", "Catat hasil"], assumptions: ["Belum diuji"], analysis },
  source: { snapshotId: "70000000-0000-4000-8000-000000000001", signalId: "70000000-0000-4000-8000-000000000002", title: "Bakso", publisher: "Google Trends", transport: "Bright Data SERP API", url: "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1", retrievedAt: analysis.generatedAt, classification: "LIKELY_FNB" } };
const props = { item, initialFresh: true, profile: { budget: { min: 500000, max: 1000000 }, interestCategoryIds: [], salesChannelIds: [] }, options: { categories: [], channels: [] } };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("review and permanent save", () => {
  it("makes the listing filter counts available without exposing raw responses", () => {
    const competitors = { query: "bakso Jakarta Utara, DKI Jakarta, Indonesia", city: "Kota Administrasi Jakarta Utara", retrievedAt: analysis.generatedAt, sampleCount: 3, places: [], diagnostics: { receivedCount: 8, inspectedCount: 8, invalidCount: 1, outsideCityCount: 3, duplicateCount: 1 } };
    render(<PrivateHypothesisScoreDetail {...props} item={{ ...item, hypothesis: { ...item.hypothesis, analysis: { ...analysis, competitors } } }} />);
    const summary = screen.getByText("Lihat hasil penyaringan listing");
    fireEvent.click(summary);
    expect(summary.closest("details")?.open).toBe(true);
    expect(screen.getByText("Diterima dari pencarian")).toBeTruthy();
    expect(screen.getByText("Data tidak lengkap / tidak valid")).toBeTruthy();
  });
  it("formats rupiah while posting the confirmed numeric amount", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ data: analysis })); vi.stubGlobal("fetch", fetcher);
    render(<PrivateHypothesisScoreDetail {...props} />);
    const input = screen.getByRole("textbox", { name: "Estimasi modal minimum dalam rupiah" }) as HTMLInputElement;
    expect(input.value).toBe("500.000");
    fireEvent.change(input, { target: { value: "Rp 1.250.000,00" } }); expect(input.value).toBe("1.250.000");
    fireEvent.change(input, { target: { value: "1e6" } }); expect(input.value).toBe("1.250.000");
    fireEvent.click(screen.getByRole("checkbox", { name: /Saya setuju konteks bisnis/ }));
    fireEvent.click(screen.getByRole("button", { name: "Perbarui analisis" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    expect(JSON.parse(fetcher.mock.calls[0]![1].body).capitalMin).toBe(1250000);
  });
  it("requires review, saves the shown snapshot, and then locks the controls", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ data: { saved: true } })); vi.stubGlobal("fetch", fetcher);
    render(<PrivateHypothesisScoreDetail {...props} />);
    const button = screen.getByRole("button", { name: "Simpan peluang" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /Saya sudah meninjau/ })); fireEvent.click(button);
    await waitFor(() => expect(screen.getByText("Peluang sudah tersimpan")).toBeTruthy());
    expect(fetcher.mock.calls[0]![0]).toBe("/api/v1/opportunities/ideas");
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual({ id: item.id, saved: true, reviewed: true, analysisFingerprint: analysis.inputFingerprint });
    expect(screen.queryByRole("button", { name: "Perbarui analisis" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Hapus hipotesis" })).toBeNull();
  });
  it("keeps stale and missing scores from being saved", () => {
    render(<PrivateHypothesisScoreDetail {...props} initialFresh={false} />);
    expect((screen.getByRole("checkbox", { name: /Saya sudah meninjau/ }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Simpan peluang" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
