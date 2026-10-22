import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { RoadmapDetail, RoadmapPage } from "@/roadmap/domain";
import { GROWTH_ROADMAP_STAGES } from "@/roadmap/domain";
import { RoadmapDetailView } from "./roadmap-detail";
import { RoadmapList } from "./roadmap-list";

const page: RoadmapPage = { items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 1 };
const detail: RoadmapDetail = {
  id: "50000000-0000-4000-8000-000000000001",
  roadmapType: "STARTUP",
  createdAt: "2026-10-11T00:00:00.000Z",
  opportunity: { id: "60000000-0000-4000-8000-000000000001", name: "Menu minuman" },
  generationContext: {
    version: "startup-validation-v1",
    method: "MVP_STRUCTURED_VALIDATION",
    contextMode: "LIMITED_CONTEXT",
    profileVersion: 1,
    profileInputs: { location: "Bandung", budgetRange: { min: 1_000_000, max: 5_000_000, currency: "IDR" }, experienceLevel: "BEGINNER", timeCommitment: "PART_TIME", interests: ["Minuman"], customerSegments: ["Pekerja kantor"], salesChannels: ["Toko"], preferredProductType: null, businessObjective: null },
    opportunity: { id: "60000000-0000-4000-8000-000000000001", name: "Menu minuman", category: "Minuman", trendId: "70000000-0000-4000-8000-000000000001", trendTitle: "Trend terkurasi", trendSummary: "Ringkasan" },
    evidence: [{ id: "80000000-0000-4000-8000-000000000001", sourceName: "Sumber tersimpan", sourceReference: "Ref-A" }],
    availableSignals: { opportunityScore: null, fitScore: null, riskLevel: null },
    unavailableInputs: ["Opportunity Score", "Fit Score", "Risk"],
    assumptions: ["Data profil dan Opportunity adalah konteks tersimpan."],
    limitations: ["Roadmap bukan prediksi."],
  },
  steps: [{ id: "90000000-0000-4000-8000-000000000001", sequence: 1, stage: "Market Validation", action: "Uji masalah dengan calon pelanggan pada segmen yang dipilih.", objective: "Memeriksa kebutuhan yang diasumsikan.", timeline: "Sebelum prototipe", expectedOutput: "Catatan wawancara dan pertanyaan terbuka." }],
};

const growth: RoadmapDetail = {
  id: "50000000-0000-4000-8000-000000000002",
  roadmapType: "GROWTH",
  createdAt: "2026-10-11T00:00:00.000Z",
  opportunity: { id: detail.opportunity.id, name: "Menu sarapan" },
  generationContext: {
    version: "growth-roadmap-v1",
    method: "MVP_STRUCTURED_GROWTH_PLANNING",
    contextMode: "LIMITED_CONTEXT",
    profileVersion: 2,
    profileInputs: { businessName: "Kedai Pagi", businessCategory: "Minuman", location: "Bandung", averagePriceRange: { min: 15_000, max: 35_000, currency: "IDR" }, products: [{ name: "Kopi susu", category: "Minuman", listedPrice: 25_000 }], customerSegments: ["Pekerja kantor"], salesChannels: ["Gerai"], businessDescription: null },
    opportunity: { id: detail.opportunity.id, name: "Menu sarapan", category: "Makanan", trendId: "70000000-0000-4000-8000-000000000001", trendTitle: "Trend", trendSummary: "Ringkasan" },
    evidence: [],
    availableSignals: { opportunityScore: null, fitScore: null, riskLevel: null },
    unavailableInputs: ["Catatan transaksi penjualan aktual", "Catatan biaya aktual untuk penilaian margin", "Opportunity Score", "Fit Score", "Risk"],
    assumptions: ["Konteks tersimpan"],
    limitations: ["Margin tidak dihitung tanpa catatan aktual."],
  },
  steps: GROWTH_ROADMAP_STAGES.map((stage, index) => ({ id: `90000000-0000-4000-8000-${String(index + 2).padStart(12, "0")}`, sequence: index + 1, stage, action: "Tinjau dan catat hasil aktual untuk usaha yang berjalan.", objective: "Memeriksa bukti sebelum membuat keputusan usaha.", timeline: "Setelah catatan tersedia", expectedOutput: "Catatan yang dapat ditinjau tanpa angka perkiraan." })),
};

describe("Roadmap views", () => {
  it("shows a useful empty list and links saved records", () => {
    const empty = renderToStaticMarkup(<RoadmapList page={page} roadmapType="STARTUP" />);
    const saved = renderToStaticMarkup(<RoadmapList page={{ ...page, totalCount: 1, items: [{ id: detail.id, roadmapType: "STARTUP", createdAt: detail.createdAt, opportunity: detail.opportunity }] }} roadmapType="STARTUP" />);
    const savedGrowth = renderToStaticMarkup(<RoadmapList page={{ ...page, totalCount: 1, items: [{ id: growth.id, roadmapType: "GROWTH", createdAt: growth.createdAt, opportunity: growth.opportunity }] }} roadmapType="GROWTH" />);
    expect(empty).toContain("Belum ada roadmap tersimpan");
    expect(empty).toContain('href="/opportunities"');
    expect(empty).not.toContain("Growth Roadmap");
    expect(saved).toContain("Menu minuman");
    expect(saved).toContain(`href="/roadmaps/${detail.id}"`);
    expect(saved).not.toContain("Startup Roadmap");
    expect(savedGrowth).not.toContain("Growth Roadmap");
  });

  it("provides accessible previous and next links for paged results", () => {
    const markup = renderToStaticMarkup(<RoadmapList page={{ ...page, page: 2, totalPages: 3, totalCount: 41 }} roadmapType="STARTUP" />);
    expect(markup).toContain('aria-label="Navigasi halaman Roadmap"');
    expect(markup).toContain('href="/roadmaps?page=1"');
    expect(markup).toContain('href="/roadmaps?page=3"');
  });

  it("shows ordered Startup steps, provenance, unavailable inputs, and Opportunity navigation", () => {
    const markup = renderToStaticMarkup(<RoadmapDetailView roadmap={detail} />);
    expect(markup).toContain("Market Validation");
    expect(markup).toContain("Uji masalah dengan calon pelanggan");
    expect(markup).toContain("Sebelum prototipe");
    expect(markup).toContain("Catatan wawancara");
    expect(markup).toContain("Opportunity Score, Fit Score, Risk");
    expect(markup).toContain("MVP STRUCTURED VALIDATION");
    expect(markup).toContain(`href="/opportunities/${detail.opportunity.id}"`);
    expect(markup).toContain("Sumber tersimpan");
    expect(markup).toContain("anggaran profil Rp 1.000.000–Rp 5.000.000");
  });

  it("renders all five Growth stages and stored business context with margin limitations", () => {
    const markup = renderToStaticMarkup(<RoadmapDetailView roadmap={growth} />);
    expect(markup).toContain("Growth Roadmap");
    for (const stage of GROWTH_ROADMAP_STAGES) expect(markup).toContain(stage);
    expect(markup).toContain("Kedai Pagi");
    expect(markup).toContain("harga rata-rata pada profil");
    expect(markup).toContain("Margin tidak dihitung");
    expect(markup).not.toContain("profit Rp");
  });
});
