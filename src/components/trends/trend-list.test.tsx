import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { USER_TYPES } from "@/auth/user-types";
import type { TrendDto } from "@/trend/dto";
import { projectTrendList } from "@/trend/list-projection";

import { TrendList } from "./trend-list";

const trend: TrendDto = {
  id: "60000000-0000-4000-8000-000000000002",
  title: "Perubahan pilihan menu minuman",
  category: { code: "PRODUCT_MENU", name: "Produk dan Menu", description: "Internal." },
  subjectArea: null,
  signal: {
    summary: "Pilihan menu berubah pada periode pengamatan.",
    description: "Internal signal description.",
    direction: "STABLE",
    observationPeriod: { start: null, end: null },
  },
  evidence: [{
    sourceName: "Survei konsumen",
    sourceReference: "survey-2026-q1/table-4",
    supportingDetail: "Tabel menunjukkan perubahan pilihan responden.",
    sourceDate: null,
    limitations: "Survei mencakup responden di dua kota.",
  }],
  businessRelevanceExplanation: "Konteks untuk meninjau variasi menu.",
  affectedUserTypes: [USER_TYPES.ENTREPRENEUR],
  lifecycleState: "PUBLISHED",
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-02T00:00:00.000Z",
};

describe("TrendList", () => {
  it("renders real allowlisted content and traceable references as text", () => {
    const items = projectTrendList([{
      ...trend,
      evidence: [
        ...trend.evidence,
        {
          sourceName: "Catatan data kedua",
          sourceReference: "internal-ref/table-9",
          supportingDetail: "Catatan ini menambah dukungan terpisah.",
          sourceDate: "2026-03-12T00:00:00.000Z",
          limitations: null,
        },
      ],
    }], USER_TYPES.ENTREPRENEUR);
    const markup = renderToStaticMarkup(<TrendList items={items} />).replace(/\s+/gu, " ");

    expect(markup).toContain("Perubahan pilihan menu minuman");
    expect(markup).toContain("Produk dan Menu");
    expect(markup).toContain("Stabil");
    expect(markup).toContain("Periode observasi belum tersedia");
    expect(markup).toContain("Tanggal sumber tidak dicantumkan");
    expect(markup).toContain("survey-2026-q1/table-4");
    expect(markup).toContain("Catatan data kedua");
    expect(markup).toContain("internal-ref/table-9");
    expect(markup).toContain("Survei mencakup responden di dua kota");
    expect(markup).toContain("Konteks relevansi bisnis");
    expect(markup).toContain("Katalog diperbarui 2 Apr 2026");
    expect(markup).toContain(`href="/trends/${trend.id}"`);
    expect(markup).not.toContain('href="survey-2026-q1/table-4"');
    expect(markup).not.toContain("Internal signal description");
    expect(markup).not.toContain("Internal.");
    expect(markup).not.toContain("Source Type");
    expect(markup).not.toContain("Untuk Anda");
    expect(markup).not.toContain("Fit Score");
  });

  it("keeps long unbroken dynamic content rendered inside wrapping elements", () => {
    const longValues = {
      categoryName: `kategori${"x".repeat(120)}`,
      title: `judul${"x".repeat(120)}`,
      subjectAreaName: `bidang${"x".repeat(120)}`,
      summary: `ringkasan${"x".repeat(120)}`,
      sourceName: `sumber${"x".repeat(120)}`,
      supportingDetail: `dukungan${"x".repeat(120)}`,
      sourceReference: `referensi${"x".repeat(120)}`,
      limitations: `batasan${"x".repeat(120)}`,
      businessRelevanceExplanation: `relevansi${"x".repeat(120)}`,
    };
    const items = projectTrendList([{
      ...trend,
      title: longValues.title,
      category: { ...trend.category, name: longValues.categoryName },
      subjectArea: { code: "LONG", name: longValues.subjectAreaName },
      signal: { ...trend.signal, summary: longValues.summary },
      evidence: [{
        ...trend.evidence[0]!,
        sourceName: longValues.sourceName,
        supportingDetail: longValues.supportingDetail,
        sourceReference: longValues.sourceReference,
        limitations: longValues.limitations,
      }],
      businessRelevanceExplanation: longValues.businessRelevanceExplanation,
    }], USER_TYPES.ENTREPRENEUR);
    const markup = renderToStaticMarkup(<TrendList items={items} />).replace(/\s+/gu, " ");

    const expectWrappedText = (tag: "h2" | "p" | "span", text: string) => {
      const textIndex = markup.indexOf(text);
      expect(textIndex).toBeGreaterThanOrEqual(0);
      const elementStart = markup.lastIndexOf(`<${tag} `, textIndex);
      const elementEnd = markup.indexOf(`</${tag}>`, textIndex);

      expect(elementStart).toBeGreaterThanOrEqual(0);
      expect(elementEnd).toBeGreaterThan(textIndex);
      expect(markup.slice(elementStart, elementEnd)).toContain("wrap-anywhere");
    };

    expectWrappedText("span", longValues.categoryName);
    expectWrappedText("h2", longValues.title);
    expectWrappedText("p", longValues.subjectAreaName);
    expectWrappedText("p", longValues.summary);
    expectWrappedText("p", longValues.sourceName);
    expectWrappedText("p", longValues.supportingDetail);
    expectWrappedText("p", longValues.sourceReference);
    expectWrappedText("p", longValues.limitations);
    expectWrappedText("p", longValues.businessRelevanceExplanation);
  });

  it("renders the truthful EMPTY state without records or metrics", () => {
    const markup = renderToStaticMarkup(<TrendList items={[]} />).replace(/\s+/gu, " ");

    expect(markup).toContain(
      "Belum ada tren F&amp;B terkurasi yang dipublikasikan untuk jenis pengguna ini.",
    );
    expect(markup).not.toContain("% pertumbuhan");
    expect(markup).not.toContain("contoh tren");
  });
});
