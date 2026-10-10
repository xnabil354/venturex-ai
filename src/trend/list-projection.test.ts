import { describe, expect, it } from "vitest";

import { USER_TYPES } from "../auth/user-types";
import type { TrendDto } from "./dto";
import { projectTrendList, TrendListDisplayContractError } from "./list-projection";

const publishedTrend: TrendDto = {
  id: "60000000-0000-4000-8000-000000000001",
  title: "Minuman berbasis tanaman",
  category: { code: "PRODUCT_MENU", name: "Produk dan Menu", description: "Kategori." },
  subjectArea: { code: "BEVERAGE", name: "Minuman" },
  signal: {
    summary: "Pilihan minuman berbasis tanaman bertambah.",
    description: "Catatan internal yang tidak ditampilkan.",
    direction: "RISING",
    observationPeriod: { start: "2026-01-01", end: "2026-03-31" },
  },
  evidence: [{
    sourceName: "Laporan industri",
    sourceReference: "Report 12, p. 4",
    supportingDetail: "Porsi pilihan meningkat pada data yang diamati.",
    sourceDate: "2026-02-14T23:30:00.000Z",
    limitations: "Cakupan terbatas pada beberapa kota.",
  }],
  businessRelevanceExplanation: "Dapat menjadi konteks perencanaan menu.",
  affectedUserTypes: [USER_TYPES.ENTREPRENEUR],
  lifecycleState: "PUBLISHED",
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-02T00:00:00.000Z",
};

function createTrend(overrides: Partial<TrendDto> = {}): TrendDto {
  return {
    ...publishedTrend,
    ...overrides,
    category: overrides.category ?? publishedTrend.category,
    signal: { ...publishedTrend.signal, ...overrides.signal },
    evidence: overrides.evidence ?? publishedTrend.evidence,
  };
}

describe("projectTrendList", () => {
  it.each([
    ["both dates", { start: "2026-01-01", end: "2026-03-31" }, "Periode observasi: 1 Jan 2026 – 31 Mar 2026"],
    ["start only", { start: "2026-01-01", end: null }, "Awal observasi: 1 Jan 2026 · Akhir belum tersedia"],
    ["end only", { start: null, end: "2026-03-31" }, "Akhir observasi: 31 Mar 2026 · Awal belum tersedia"],
    ["neither date", { start: null, end: null }, "Periode observasi belum tersedia"],
  ] as const)("formats the approved observation period when %s is available", (_case, period, expected) => {
    const [item] = projectTrendList(
      [createTrend({ signal: { observationPeriod: period } as TrendDto["signal"] })],
      USER_TYPES.ENTREPRENEUR,
    );

    expect(item?.observationPeriodLabel).toBe(expected);
  });

  it.each([
    ["RISING", "Meningkat"],
    ["STABLE", "Stabil"],
    ["DECLINING", "Menurun"],
  ] as const)("maps supported direction %s to %s", (direction, expected) => {
    const [item] = projectTrendList(
      [createTrend({ signal: { ...publishedTrend.signal, direction } })],
      USER_TYPES.ENTREPRENEUR,
    );

    expect(item?.directionLabel).toBe(expected);
  });

  it.each([null, "SIDEWAYS"] as const)("fails closed for invalid direction %s", (direction) => {
    const trend = createTrend({
      signal: { ...publishedTrend.signal, direction: direction as TrendDto["signal"]["direction"] },
    });

    expect(() => projectTrendList([trend], USER_TYPES.ENTREPRENEUR))
      .toThrow(TrendListDisplayContractError);
  });

  it("preserves multiple evidence items, source dates, plain references, and limitations", () => {
    const trend = createTrend({
      evidence: [
        publishedTrend.evidence[0]!,
        {
          sourceName: "Dataset 2",
          sourceReference: "dataset-table-8",
          supportingDetail: "Kumpulan data menunjukkan perubahan serupa.",
          sourceDate: null,
          limitations: "Tidak mencakup usaha di luar perkotaan.",
        },
      ],
    });
    const [item] = projectTrendList([trend], USER_TYPES.ENTREPRENEUR);

    expect(item?.evidence).toEqual([
      {
        sourceName: "Laporan industri",
        sourceReference: "Report 12, p. 4",
        supportingDetail: "Porsi pilihan meningkat pada data yang diamati.",
        sourceDateLabel: "Tanggal sumber: 14 Feb 2026",
        limitations: "Cakupan terbatas pada beberapa kota.",
      },
      {
        sourceName: "Dataset 2",
        sourceReference: "dataset-table-8",
        supportingDetail: "Kumpulan data menunjukkan perubahan serupa.",
        sourceDateLabel: "Tanggal sumber tidak dicantumkan",
        limitations: "Tidak mencakup usaha di luar perkotaan.",
      },
    ]);
  });

  it("fails closed when an eligible published Trend has no evidence", () => {
    expect(() => projectTrendList(
      [createTrend({ evidence: [] })],
      USER_TYPES.ENTREPRENEUR,
    )).toThrow(TrendListDisplayContractError);
  });

  it("rejects records outside the published and persisted audience contract", () => {
    expect(() => projectTrendList(
      [createTrend({ lifecycleState: "DRAFT" })],
      USER_TYPES.ENTREPRENEUR,
    )).toThrow(TrendListDisplayContractError);
    expect(() => projectTrendList(
      [createTrend({ affectedUserTypes: [USER_TYPES.UMKM_EXISTING] })],
      USER_TYPES.ENTREPRENEUR,
    )).toThrow(TrendListDisplayContractError);
  });

  it("returns only allowlisted display fields", () => {
    const [item] = projectTrendList([publishedTrend], USER_TYPES.ENTREPRENEUR);

    expect(item).toMatchObject({
      categoryName: "Produk dan Menu",
      subjectAreaName: "Minuman",
      businessRelevanceExplanation: "Dapat menjadi konteks perencanaan menu.",
      catalogUpdatedAtLabel: "2 Apr 2026",
    });
    expect(item).not.toHaveProperty("lifecycleState");
    expect(item).not.toHaveProperty("affectedUserTypes");
    expect(item).not.toHaveProperty("createdAt");
    expect(item).not.toHaveProperty("direction");
    expect(item).not.toHaveProperty("categoryCode");
    expect(item?.evidence[0]).not.toHaveProperty("id");
  });
});
