import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
vi.mock("server-only", () => ({}));
import { cleanReportText, exportExcel, exportPdf } from "./export";
import type { JourneyReport } from "./model";

const report: JourneyReport = {
  title: "Uji kemasan — rasa & ukuran", persona: "Calon Pengusaha", createdAt: "2026-10-22T10:00:00.000Z",
  sections: [{ title: "Profil calon usaha", columns: ["Konteks", "Rincian"], rows: [["Konsep", '=HYPERLINK("https://example.test","contoh")'], ["Data kosong", "Belum dinilai"], ["Nilai", 42.75]] }],
};
describe("portable report exports", () => {
  it("keeps untrusted leading equals signs as text and preserves numeric cells", async () => {
    const file = await exportExcel(report), book = new ExcelJS.Workbook();
    await book.xlsx.load(new Uint8Array(file).buffer);
    const cells: ExcelJS.Cell[] = [];
    book.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => cells.push(cell))));
    const formulaText = cells.find(cell => String(cell.value).startsWith("=HYPERLINK"));
    expect(formulaText?.type).toBe(ExcelJS.ValueType.String);
    expect(cells.some(cell => cell.type === ExcelJS.ValueType.Formula)).toBe(false);
    expect(cells.some(cell => cell.value === 42.75)).toBe(true);
    expect(cells.some(cell => cell.value === "Belum dinilai")).toBe(true);
  });
  it("embeds the bundled font into an actual PDF and removes provider copy", async () => {
    const file = await exportPdf(report);
    expect(file.subarray(0, 5).toString()).toBe("%PDF-");
    expect(file.length).toBeGreaterThan(10000);
    expect(cleanReportText("9router · SearchApi.io · Search API")).toBe("layanan data · layanan data · layanan data");
  });
});
