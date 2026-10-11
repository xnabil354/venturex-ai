import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { RoadmapDetail, RoadmapPage } from "@/roadmap/domain";
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

describe("Roadmap views", () => {
  it("shows a useful empty list and links saved records", () => {
    const empty = renderToStaticMarkup(<RoadmapList page={page} />);
    const saved = renderToStaticMarkup(<RoadmapList page={{ ...page, totalCount: 1, items: [{ id: detail.id, roadmapType: "STARTUP", createdAt: detail.createdAt, opportunity: detail.opportunity }] }} />);
    expect(empty).toContain("Belum ada Startup Roadmap");
    expect(empty).toContain('href="/opportunities"');
    expect(saved).toContain("Menu minuman");
    expect(saved).toContain(`href="/roadmaps/${detail.id}"`);
  });

  it("provides accessible previous and next links for paged results", () => {
    const markup = renderToStaticMarkup(<RoadmapList page={{ ...page, page: 2, totalPages: 3, totalCount: 41 }} />);
    expect(markup).toContain('aria-label="Navigasi halaman Roadmap"');
    expect(markup).toContain('href="/roadmaps?page=1"');
    expect(markup).toContain('href="/roadmaps?page=3"');
  });

  it("shows ordered step data, provenance, unavailable inputs, and Opportunity navigation", () => {
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
});
