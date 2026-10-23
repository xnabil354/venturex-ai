import "server-only";
import path from "node:path";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import type { JourneyReport, ReportCell } from "./model";

const wine = "#421d24", ink = "#292827", parchment = "#f2f0eb", lilac = "#d4c7ff";
export const cleanReportText = (value: ReportCell) => String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/gu, "").replace(/\b(?:9router|ninerouter|search\s*api(?:\.io)?)\b/giu, "layanan data");

export async function exportPdf(report: JourneyReport): Promise<Buffer> {
  const regular = path.join(process.cwd(), "src/reports/fonts/NotoSans-Regular.ttf");
  const bold = path.join(process.cwd(), "src/reports/fonts/NotoSans-Bold.ttf");
  const doc = new PDFDocument({ size: "A4", margins: { top: 54, bottom: 58, left: 44, right: 44 }, bufferPages: true, font: regular, info: { Title: report.title, Author: "VENTUREX", Subject: report.persona } });
  doc.registerFont("body", regular).registerFont("bold", bold);
  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => { doc.on("data", (chunk: Buffer) => chunks.push(chunk)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  const width = doc.page.width - 88, bottom = () => doc.page.height - 65;
  function heading(text: string) {
    if (doc.y + (text.includes("Roadmap") ? 190 : 110) > bottom()) doc.addPage();
    doc.font("bold").fontSize(14).fillColor(wine).text(cleanReportText(text), 44, doc.y, { width });
    doc.moveDown(0.6);
  }
  doc.rect(0, 0, doc.page.width, 12).fill(wine);
  doc.fillColor(wine).font("bold").fontSize(12).text("VENTUREX");
  doc.moveDown().fontSize(23).fillColor(ink).text(cleanReportText(report.title), { width });
  doc.moveDown(0.5).font("body").fontSize(10).text(`${report.persona}  ·  ${new Date(report.createdAt).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}`);
  doc.moveDown(1.4);
  for (const section of report.sections) {
    heading(section.title);
    if (section.columns.length === 2) {
      for (const row of section.rows) {
        doc.font("body").fontSize(10);
        const text = cleanReportText(row[1] ?? "");
        const needed = doc.heightOfString(text, { width }) + 26;
        if (doc.y + Math.min(needed, 250) > bottom()) doc.addPage();
        doc.font("bold").fontSize(9).fillColor(wine).text(cleanReportText(row[0] ?? ""), 44, doc.y, { width });
        doc.moveDown(0.25).font("body").fontSize(10).fillColor(ink).text(text || "Tidak tersedia", { width, lineGap: 3 });
        doc.moveDown(0.8);
      }
    } else if (section.title.includes("Roadmap")) {
      for (const row of section.rows) {
        if (doc.y + 130 > bottom()) doc.addPage();
        doc.font("bold").fontSize(11).fillColor(wine).text(cleanReportText(row[0] ?? ""), 44, doc.y, { width });
        for (let i = 1; i < row.length; i++) {
          doc.moveDown(0.5).font("bold").fontSize(9).fillColor(ink).text(section.columns[i] ?? "");
          doc.font("body").fontSize(10).text(cleanReportText(row[i] ?? ""), { width, lineGap: 3 });
        }
        doc.moveDown(1);
      }
    } else {
      const widths = [108, 54, 54, width - 216];
      function tableRow(cells: ReportCell[], header: boolean) {
        doc.font(header ? "bold" : "body").fontSize(9);
        const heights = cells.map((cell, i) => doc.heightOfString(cleanReportText(cell), { width: widths[i]! - 12, lineGap: 2 }));
        const height = Math.max(...heights) + 16;
        if (doc.y + height > bottom()) { doc.addPage(); if (!header) { heading(`${section.title} (lanjutan)`); tableRow(section.columns, true); } }
        const y = doc.y;
        if (header) doc.rect(44, y, width, height).fill(lilac);
        let x = 44;
        cells.forEach((cell, i) => { doc.font(header ? "bold" : "body").fontSize(9).fillColor(ink).text(cleanReportText(cell), x + 6, y + 8, { width: widths[i]! - 12, lineGap: 2 }); x += widths[i]!; });
        doc.strokeColor("#dedbd5").lineWidth(0.5).moveTo(44, y + height).lineTo(44 + width, y + height).stroke();
        doc.y = y + height;
      }
      tableRow(section.columns, true);
      for (const row of section.rows) tableRow(row, false);
      doc.moveDown(1);
    }
  }
  const range = doc.bufferedPageRange();
  for (let p = range.start; p < range.start + range.count; p++) {
    doc.switchToPage(p);
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.rect(44, doc.page.height - 42, width, 1).fill(parchment);
    doc.font("body").fontSize(8).fillColor(ink).text(`VENTUREX  ·  ${report.persona}`, 44, doc.page.height - 32, { width: width - 45, lineBreak: false });
    doc.text(`${p + 1} / ${range.count}`, doc.page.width - 85, doc.page.height - 32, { width: 42, align: "right", lineBreak: false });
    doc.page.margins.bottom = savedBottom;
  }
  doc.end();
  return finished;
}

function wrapChunks(value: ReportCell, width: number): string[] {
  const text = cleanReportText(value);
  const capacity = Math.max(200, Math.floor(width * 0.85) * 16);
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + capacity, text.length);
    if (end < text.length) { const space = text.lastIndexOf(" ", end); if (space > start + capacity / 2) end = space + 1; }
    chunks.push(text.slice(start, end)); start = end;
  }
  return chunks.length ? chunks : [""];
}
export async function exportExcel(report: JourneyReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "VENTUREX"; workbook.created = new Date(report.createdAt);
  const groups = [
    { name: "Ringkasan", sections: report.sections.slice(0, 3) },
    { name: "Analisis", sections: report.sections.filter(s => s.title.includes("Score") || s.title.includes("Fit") || s.title === "Pertimbangan keputusan") },
    { name: "Roadmap", sections: report.sections.filter(s => s.title.includes("Roadmap") || s.title === "Catatan laporan") },
  ];
  for (const group of groups) {
    const sheet = workbook.addWorksheet(group.name, { views: [{ state: "frozen", ySplit: 4 }], pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 } } });
    const widths = group.name === "Analisis" ? [28, 16, 16, 80] : group.name === "Roadmap" ? [26, 48, 34, 48] : [26, 42, 28, 48];
    const detailWidth = widths.slice(1).reduce((total, width) => total + width, 0);
    sheet.columns = widths.map(width => ({ width }));
    const title = sheet.addRow(["VENTUREX"]); sheet.mergeCells(title.number, 1, title.number, 4);
    title.font = { name: "Arial", size: 18, bold: true, color: { argb: "FFFFFFFF" } }; title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF421D24" } }; title.height = 34;
    sheet.addRow([report.persona]); sheet.addRow([cleanReportText(report.title)]); sheet.mergeCells(3, 1, 3, 4); sheet.getRow(3).height = 34;
    sheet.addRow([`Disusun ${new Date(report.createdAt).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}`]);
    for (const section of group.sections) {
      sheet.addRow([]);
      const sectionRow = sheet.addRow([section.title]); sheet.mergeCells(sectionRow.number, 1, sectionRow.number, 4); sectionRow.height = 26;
      sectionRow.font = { name: "Arial", size: 12, bold: true, color: { argb: "FF421D24" } }; sectionRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F0EB" } };
      const two = section.columns.length === 2;
      const header = sheet.addRow(section.columns); if (two) sheet.mergeCells(header.number, 2, header.number, 4);
      header.height = 24; header.font = { name: "Arial", size: 10, bold: true }; header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD4C7FF" } };
      for (const cells of section.rows) {
        const chunks = cells.map((value, i) => typeof value === "number" ? [value] : wrapChunks(value, two && i === 1 ? detailWidth : widths[i]!));
        for (let part = 0; part < Math.max(...chunks.map(v => v.length)); part++) {
          const values = chunks.map(values => values[part] ?? "");
          const row = sheet.addRow(values);
          if (two) sheet.mergeCells(row.number, 2, row.number, 4);
          let lines = 1;
          values.forEach((value, i) => { const width = two && i === 1 ? detailWidth : widths[i]!; lines = Math.max(lines, String(value).split("\n").reduce((total, line) => total + Math.max(1, Math.ceil(line.length / (width * 0.85))), 0)); if (typeof value === "number") row.getCell(i + 1).numFmt = "0.00"; });
          row.height = Math.min(400, Math.max(24, lines * 15 + 8));
        }
      }
    }
    sheet.eachRow(row => row.eachCell(cell => {
      if (!cell.font?.name) cell.font = { name: "Arial", size: 11, color: { argb: "FF292827" } };
      cell.alignment = { vertical: "top", horizontal: typeof cell.value === "number" ? "right" : "left", wrapText: true, indent: 1 };
    }));
    sheet.pageSetup.printArea = `A1:D${sheet.rowCount}`;
    sheet.pageSetup.printTitlesRow = "1:4";
    sheet.headerFooter.oddFooter = "&LVENTUREX&RHalaman &P dari &N";
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
