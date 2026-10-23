import type { DashboardDto } from "@/dashboard/dto";
import type { PrivateOpportunityIdeaDto } from "@/opportunity/private-hypothesis";
import { startupRoadmapDisplayAction } from "@/roadmap/private-startup-text";
import { journeyPlan, type JourneyProgress } from "./journey";

export type ReportCell = string | number;
export type ReportSection = { title: string; columns: string[]; rows: ReportCell[][] };
export type JourneyReport = { title: string; persona: string; createdAt: string; sections: ReportSection[] };
const date = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(new Date(value));
const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
const names = (values: readonly { name: string }[]) => values.map(v => v.name).join(", ") || "Belum diisi";
const periods: Record<string, string> = { "24h": "24 jam terakhir", "7d": "7 hari terakhir", "30d": "30 hari terakhir", "90d": "90 hari terakhir", "1y": "1 tahun terakhir", month: "Bulan berjalan" };
export function buildJourneyReport(item: PrivateOpportunityIdeaDto, dashboard: DashboardDto, progress: JourneyProgress, now = new Date()): JourneyReport {
  if (!progress.complete) throw new Error("JOURNEY_INCOMPLETE");
  const role = dashboard.userType;
  const existing = role === "UMKM_EXISTING";
  const analysis = existing ? item.hypothesis.businessAnalysis : item.hypothesis.analysis;
  const plan = journeyPlan(item, role);
  if (!analysis?.requirements || !plan) throw new Error("JOURNEY_INCOMPLETE");
  const profile = dashboard.profile;
  const profileRows: ReportCell[][] = [["Lokasi", profile.location.text], ["Pelanggan", names(profile.customerSegments)], ["Kanal penjualan", names(profile.salesChannels)]];
  if (dashboard.userType === "ENTREPRENEUR") {
    const p = dashboard.profile;
    profileRows.unshift(["Minat produk", p.preferredProductType ?? "Belum diisi"], ["Bidang minat", names(p.interests)], ["Anggaran", `${money(p.budget.min)} – ${money(p.budget.max)}`]);
    const experience: Record<string, string> = { BEGINNER: "Pemula", SOME_EXPERIENCE: "Pernah menjalankan usaha", EXPERIENCED: "Berpengalaman" };
    const time: Record<string, string> = { LIMITED: "Terbatas", PART_TIME: "Paruh waktu", FULL_TIME: "Penuh waktu" };
    profileRows.push(["Pengalaman", experience[p.experienceLevel] ?? p.experienceLevel], ["Waktu tersedia", time[p.timeCommitment] ?? p.timeCommitment]);
  } else {
    const p = dashboard.profile;
    profileRows.unshift(["Nama usaha", p.businessName], ["Kategori", p.businessCategory.name], ["Rentang harga", `${money(p.averagePrice.min)} – ${money(p.averagePrice.max)}`]);
    if (item.hypothesis.businessAnalysis?.planningContext) profileRows.push(["Produk saat analisis", item.hypothesis.businessAnalysis.planningContext.products.join(", ")]);
  }
  const source = item.source;
  const signalRows: ReportCell[][] = "query" in source ? [
    ["Produk acuan", source.productQuery], ["Kueri terpilih", source.query], ["Jenis", source.sourceType === "RELATED_QUERY_TOP" ? "Kueri terpopuler" : "Kueri yang makin populer"],
    ["Wilayah", source.geo === "ID" ? "Indonesia" : source.geo || "Seluruh dunia"], ["Periode", periods[source.period] ?? source.period],
    ["Indikator", source.sourceType === "RELATED_QUERY_TOP" ? source.interestIndex === null ? "Tidak tersedia" : `Indeks ${source.interestIndex}` : source.isBreakout ? "Lonjakan" : source.growthPercent === null ? "Tidak tersedia" : `Pertumbuhan ${source.growthPercent}%`],
    ["Tanggal data", date(source.retrievedAt)], ["Sumber", source.url],
  ] : [["Sinyal terpilih", source.title], ["Tanggal data", date(source.retrievedAt)], ["Sumber", source.url]];
  const sections: ReportSection[] = [
    { title: existing ? "Profil usaha saat ekspor" : "Profil calon usaha saat ekspor", columns: ["Konteks", "Rincian"], rows: profileRows },
    { title: "Tren yang dipilih", columns: ["Konteks", "Rincian"], rows: signalRows },
    { title: "Peluang tersimpan", columns: ["Konteks", "Rincian"], rows: [["Konsep", item.hypothesis.concept], ["Target awal", item.hypothesis.targetCustomer], ["Target hasil analisis", analysis.targetConsumer], ["Tanggal analisis", date(analysis.generatedAt)], ["Kebutuhan", analysis.requirements.summary], ...analysis.requirements.initialNeeds.map(v => ["Persiapan", v])] },
  ];
  const complexity = { SIMPLE: "Sederhana", STANDARD: "Standar", COMPLEX: "Kompleks" };
  sections[2]!.rows.push(["Pelaksanaan", analysis.requirements.complexity ? complexity[analysis.requirements.complexity] : "Belum dinilai"]);
  if (existing && item.hypothesis.businessAnalysis?.proposedPrice) {
    const price = item.hypothesis.businessAnalysis.proposedPrice;
    sections[2]!.rows.push(["Harga uji yang diajukan", `${money(price.min)} – ${money(price.max)}`]);
  } else if (!existing && item.hypothesis.analysis?.capitalMin !== null && item.hypothesis.analysis?.capitalMin !== undefined) sections[2]!.rows.push(["Modal minimum yang dianalisis", money(item.hypothesis.analysis.capitalMin)]);
  for (const [label, score] of [["Opportunity Score", analysis.opportunity], [existing ? "Business Fit" : "Founder Fit", analysis.fit]] as const) {
    sections.push({ title: `${label} — ${score.score === null ? "Belum dinilai" : score.score.toFixed(2)} / 100`, columns: ["Faktor", "Nilai / 100", "Bobot %", "Dasar penilaian"], rows: [["Cakupan data (%)", score.coverage, "", "Skor awal; komponen tanpa data tidak dianggap nol."], ...score.factors.map(f => [f.label, f.value ?? "Belum dinilai", f.weight * 100, f.reason])] });
  }
  const business = item.hypothesis.businessAnalysis;
  const risks = existing && business ? business.risk.reasons : item.hypothesis.analysis?.risks ?? [];
  const riskLabels = { LOW: "Rendah", MEDIUM: "Sedang", HIGH: "Tinggi", UNKNOWN: "Belum dinilai" };
  sections.push({ title: "Pertimbangan keputusan", columns: ["Konteks", "Rincian"], rows: [
    ["Kompetisi", analysis.competition], ...(existing && business ? [["Risiko", riskLabels[business.risk.level]]] : []), ...risks.map(v => ["Catatan risiko", v]),
    ...analysis.requirements.assumptions.map(v => ["Asumsi", v]), ...analysis.warnings.map(v => ["Batasan data", v]),
    ...(item.hypothesis.evidenceGaps ?? []).map(v => ["Perlu divalidasi", v]),
    ...(analysis.competitors?.places ?? []).map(v => ["Sampel pesaing", `${v.name}\n${v.address ?? ""}\n${v.url ?? ""}`]),
  ] });
  sections.push({ title: existing ? "Growth Roadmap" : "Startup Roadmap", columns: ["Tahap", "Pelaksanaan", "Tujuan dan waktu", "Hasil yang dicatat"], rows: plan.steps.map((step, i) => [
    `${i + 1}. ${step.stage}`, !existing && item.hypothesis.startupRoadmap ? startupRoadmapDisplayAction(item, item.hypothesis.startupRoadmap.steps[i]!) : step.action,
    `${step.objective}\n\n${step.timeline}`, `${step.expectedOutput}\n\nDitandai selesai: ${date(progress.steps[i]!.completedAt!)}`,
  ]) });
  sections.push({ title: "Catatan laporan", columns: ["Konteks", "Rincian"], rows: [["Penyelesaian", "Seluruh tahap ditandai selesai oleh pengguna. Status ini bukan verifikasi keberhasilan usaha."], ["Penggunaan", "Analisis dan roadmap merupakan rencana berdasarkan data tersimpan, bukan jaminan hasil. Profil saat ekspor dapat berbeda dari konteks analisis sebelumnya."]] });
  return { title: item.hypothesis.title, persona: existing ? "Pengusaha Existing" : "Calon Pengusaha", createdAt: now.toISOString(), sections };
}
