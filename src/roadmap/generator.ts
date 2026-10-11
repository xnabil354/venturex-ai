import { z } from "zod";

import {
  ROADMAP_GENERATION_METHOD,
  ROADMAP_GENERATION_VERSION,
  ROADMAP_STAGES,
  roadmapStepSchema,
  type RoadmapAnalysisContext,
  type RoadmapGenerationContext,
  type RoadmapOpportunityContext,
  type RoadmapProfileContext,
} from "./domain";

const profileSchema = z.object({
  locationText: z.string().trim().min(1),
  countryCode: z.literal("ID"),
  budgetMin: z.number().int().safe().nonnegative(),
  budgetMax: z.number().int().safe().nonnegative(),
  experienceLevel: z.enum(["BEGINNER", "SOME_EXPERIENCE", "EXPERIENCED"]),
  timeCommitment: z.enum(["LIMITED", "PART_TIME", "FULL_TIME"]),
  preferredProductType: z.string().nullable(),
  businessObjective: z.string().nullable(),
  interests: z.array(z.string().trim().min(1)).min(1),
  customerSegments: z.array(z.string().trim().min(1)).min(1),
  salesChannels: z.array(z.string().trim().min(1)).min(1),
}).refine((profile) => profile.budgetMax >= profile.budgetMin);

export class RoadmapInsufficientDataError extends Error {
  constructor() {
    super("Trusted profile or Opportunity context is incomplete.");
    this.name = "RoadmapInsufficientDataError";
  }
}

function clean(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text.slice(0, 180) : null;
}

function validSignal(value: string | null): number | null {
  if (value === null) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null;
}

function validRisk(analysis: RoadmapAnalysisContext | null): "LOW" | "MEDIUM" | "HIGH" | null {
  if (!analysis || !["LOW", "MEDIUM", "HIGH"].includes(analysis.riskLevel ?? "")) return null;
  return analysis.riskReasons.some((reason) => typeof reason === "string" && reason.trim().length > 0)
    ? (analysis.riskLevel as "LOW" | "MEDIUM" | "HIGH")
    : null;
}

export function generateStartupRoadmap(input: {
  readonly profile: RoadmapProfileContext;
  readonly opportunity: RoadmapOpportunityContext;
  readonly analysis: RoadmapAnalysisContext | null;
}): { readonly generationContext: RoadmapGenerationContext; readonly steps: ReturnType<typeof roadmapStepSchema.parse>[] } {
  const profile = profileSchema.safeParse(input.profile);
  const opportunity = input.opportunity;
  if (
    !profile.success || !opportunity.name.trim() || !opportunity.categoryName.trim() ||
    !opportunity.description.trim() || !opportunity.trend.title.trim() ||
    opportunity.trend.lifecycleState !== "PUBLISHED" ||
    !opportunity.trend.affectedUserTypes.includes("ENTREPRENEUR")
  ) {
    throw new RoadmapInsufficientDataError();
  }

  const normalizedProfile = profile.data;
  const segment = normalizedProfile.customerSegments[0];
  const location = clean(normalizedProfile.locationText) ?? "lokasi pada profil Anda";
  const channel = normalizedProfile.salesChannels[0];
  const product = clean(normalizedProfile.preferredProductType) ?? opportunity.categoryName;
  const interest = normalizedProfile.interests[0];
  const experienceGuidance = normalizedProfile.experienceLevel === "BEGINNER"
    ? "pilih bentuk yang dapat diuji dengan keterampilan yang sudah Anda miliki"
    : normalizedProfile.experienceLevel === "SOME_EXPERIENCE"
      ? "gunakan pengalaman yang relevan dan catat bagian yang masih perlu dipelajari"
      : "catat proses dan kapasitas yang ingin Anda uji dengan pengalaman yang sudah ada";
  const timeGuidance = normalizedProfile.timeCommitment === "LIMITED"
    ? "sesuaikan langkah uji dengan waktu terbatas yang Anda cantumkan"
    : normalizedProfile.timeCommitment === "PART_TIME"
      ? "susun kegiatan uji di sekitar komitmen paruh waktu Anda"
      : "alokasikan waktu berdasarkan kapasitas penuh yang Anda cantumkan";
  const scoreAvailable = input.analysis?.scoreStatus === "AVAILABLE";
  const opportunityScore = scoreAvailable ? validSignal(input.analysis?.opportunityScore ?? null) : null;
  const fitScore = scoreAvailable ? validSignal(input.analysis?.fitScore ?? null) : null;
  const riskLevel = validRisk(input.analysis);
  const unavailableInputs = [
    ...(opportunityScore === null ? ["Opportunity Score"] : []),
    ...(fitScore === null ? ["Fit Score"] : []),
    ...(riskLevel === null ? ["Risk"] : []),
  ];
  const contextMode = unavailableInputs.length === 0 ? "FULL_CONTEXT" : "LIMITED_CONTEXT";
  const steps = [
    {
      sequence: 1,
      stage: ROADMAP_STAGES[0],
      action: `Uji masalah yang ingin dijawab oleh “${opportunity.name}” dengan berbicara kepada segmen ${segment} di ${location}; catat kebutuhan dan keberatan yang mereka sampaikan.`,
      objective: `Memeriksa apakah masalah yang diasumsikan untuk ${opportunity.name} benar-benar muncul pada calon pelanggan yang Anda pilih.`,
      timeline: "Sebelum mengeluarkan biaya untuk prototipe",
      expectedOutput: "Catatan percakapan, kebutuhan, keberatan, dan pertanyaan yang masih perlu dijawab; bukan ukuran permintaan pasar.",
    },
    {
      sequence: 2,
      stage: ROADMAP_STAGES[1],
      action: `Amati penawaran sejenis yang dapat ditemukan oleh calon pelanggan ${segment}, termasuk melalui ${channel}; catat harga yang benar-benar terlihat hanya bila sumbernya dapat diperiksa.`,
      objective: "Memahami pilihan yang tersedia dan membedakan asumsi Anda dari informasi yang dapat diamati.",
      timeline: "Setelah merumuskan masalah yang akan diuji",
      expectedOutput: "Daftar penawaran yang diamati beserta sumber dan tanggal pengamatan; tidak ada klaim jumlah pesaing atau pangsa pasar.",
    },
    {
      sequence: 3,
      stage: ROADMAP_STAGES[2],
      action: `Buat bentuk uji sederhana untuk ${opportunity.name} sebagai ${product}, sesuai dengan minat ${interest} dan kategori ${opportunity.categoryName}; ${experienceGuidance}, lalu batasi bahan dan biaya pada anggaran yang Anda putuskan sendiri.`,
      objective: "Mewujudkan penawaran minimum yang dapat diperlihatkan dan menerima umpan balik tanpa menganggapnya sebagai produk siap jual.",
      timeline: "Setelah masalah dan alternatif awal ditinjau",
      expectedOutput: "Contoh, rancangan, atau deskripsi penawaran yang dapat ditinjau calon pelanggan; estimasi biaya hanya jika Anda memiliki dasar sendiri.",
    },
    {
      sequence: 4,
      stage: ROADMAP_STAGES[3],
      action: `Uji penawaran secara terbatas melalui ${channel} kepada segmen ${segment}, ${timeGuidance}, jelaskan bahwa ini uji awal, dan catat respons nyata tanpa mengubah minat menjadi proyeksi penjualan.`,
      objective: "Mengamati respons terhadap penawaran dan proses pemenuhan sebelum memutuskan komitmen yang lebih besar.",
      timeline: "Setelah contoh penawaran siap dan aturan setempat diperiksa",
      expectedOutput: "Catatan tawaran, respons, transaksi bila benar terjadi, kendala operasional, dan sumber pencatatan.",
    },
    {
      sequence: 5,
      stage: ROADMAP_STAGES[4],
      action: "Bandingkan catatan uji dengan asumsi awal, biaya yang benar-benar keluar terhadap rentang anggaran pada profil, umpan balik, dan kapasitas waktu Anda; gunakan score atau risk tersimpan hanya sebagai konteks tambahan bila tersedia.",
      objective: "Menilai bukti aktual, hal yang belum diketahui, dan kemampuan menjalankan langkah berikutnya tanpa memperlakukan score atau risk sebagai prediksi.",
      timeline: "Setelah catatan uji dapat ditinjau",
      expectedOutput: "Ringkasan hasil aktual, asumsi yang didukung atau belum didukung, biaya tercatat, serta pertanyaan yang masih terbuka.",
    },
    {
      sequence: 6,
      stage: ROADMAP_STAGES[5],
      action: "Tentukan sendiri apakah akan lanjut, revisi penawaran lalu uji kembali, atau berhenti; pertimbangkan bukti aktual, anggaran, waktu, dan batas risiko yang Anda tetapkan.",
      objective: clean(normalizedProfile.businessObjective)
        ? `Membuat keputusan awal dari hasil uji dan meninjau tujuan Anda: ${clean(normalizedProfile.businessObjective)}. Keputusan bukan jaminan keberhasilan atau rekomendasi otomatis.`
        : "Membuat keputusan awal yang dapat dijelaskan dari hasil uji, bukan dari jaminan keberhasilan atau rekomendasi otomatis.",
      timeline: "Setelah evaluasi pribadi selesai",
      expectedOutput: "Keputusan Go, Revise, atau Stop beserta alasan dan langkah berikutnya yang Anda pilih.",
    },
  ].map((step) => roadmapStepSchema.parse(step));

  const generationContext: RoadmapGenerationContext = {
    version: ROADMAP_GENERATION_VERSION,
    method: ROADMAP_GENERATION_METHOD,
    contextMode,
    profileVersion: input.profile.profileVersion,
    profileInputs: {
      location,
      budgetRange: { min: input.profile.budgetMin, max: input.profile.budgetMax, currency: "IDR" },
      experienceLevel: normalizedProfile.experienceLevel,
      timeCommitment: normalizedProfile.timeCommitment,
      interests: normalizedProfile.interests,
      customerSegments: normalizedProfile.customerSegments,
      salesChannels: normalizedProfile.salesChannels,
      preferredProductType: clean(input.profile.preferredProductType),
      businessObjective: clean(input.profile.businessObjective),
    },
    opportunity: {
      id: opportunity.id,
      name: opportunity.name,
      category: opportunity.categoryName,
      trendId: opportunity.trend.id,
      trendTitle: opportunity.trend.title,
      trendSummary: opportunity.trend.signalSummary,
    },
    evidence: opportunity.evidence.map((item) => ({
      id: item.id,
      sourceName: item.sourceName,
      sourceReference: item.sourceReference,
    })),
    availableSignals: { opportunityScore, fitScore, riskLevel },
    unavailableInputs,
    assumptions: [
      "Roadmap ini menyusun langkah validasi berdasarkan data profil dan Opportunity yang tersimpan.",
      "Permintaan pasar, preferensi konsumen, penjualan, biaya, dan hasil bisnis belum dibuktikan oleh roadmap ini.",
      ...(opportunity.evidence.length === 0 ? ["Tidak ada evidence tersimpan yang dapat dirujuk untuk Opportunity ini."] : []),
    ],
    limitations: [
      "Hasil disusun dengan template deterministik berversi; tidak dihasilkan oleh LLM dan bukan prediksi.",
      "Trend terpublikasi dan evidence adalah konteks sumber, bukan validasi fakta atau jaminan pasar.",
      "Tidak ada estimasi biaya atau tenggat kalender karena dasar yang tervalidasi tidak tersedia.",
      ...(input.analysis ? [] : ["Analisis score/risk sebelumnya tidak tersedia untuk kombinasi pengguna dan Opportunity ini."]),
    ],
  };
  return { generationContext, steps };
}
