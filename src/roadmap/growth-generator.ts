import { z } from "zod";

import {
  GROWTH_ROADMAP_GENERATION_METHOD,
  GROWTH_ROADMAP_GENERATION_VERSION,
  GROWTH_ROADMAP_STAGES,
  roadmapStepSchema,
  type GrowthRoadmapGenerationContext,
  type GrowthRoadmapProfileContext,
  type RoadmapAnalysisContext,
  type RoadmapOpportunityContext,
} from "./domain";
import { RoadmapInsufficientDataError } from "./generator";

const growthProfileSchema = z.object({
  profileVersion: z.number().int().positive(),
  businessName: z.string().trim().min(1).max(180),
  businessCategory: z.string().trim().min(1).max(120),
  locationText: z.string().trim().min(1).max(255),
  countryCode: z.literal("ID"),
  averagePriceMin: z.number().int().safe().nonnegative(),
  averagePriceMax: z.number().int().safe().nonnegative(),
  businessDescription: z.string().max(5000).nullable(),
  products: z.array(z.object({
    name: z.string().trim().min(1).max(180),
    category: z.string().trim().min(1).max(120).nullable(),
    price: z.number().int().safe().nonnegative().nullable(),
  }).strict()).min(1).max(20),
  customerSegments: z.array(z.string().trim().min(1).max(120)).min(1).max(100),
  salesChannels: z.array(z.string().trim().min(1).max(120)).min(1).max(100),
}).strict().refine((profile) => profile.averagePriceMax >= profile.averagePriceMin);

const evidenceSchema = z.array(z.object({
  id: z.string().uuid(),
  sourceName: z.string().trim().min(1).max(180),
  sourceReference: z.string().max(500).nullable(),
}).strict()).max(10);

function clean(value: string | null | undefined, max = 180): string | null {
  const text = value?.trim();
  return text ? text.slice(0, max) : null;
}

function validSignal(value: string | null): number | null {
  if (value === null) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null;
}

function validRisk(analysis: RoadmapAnalysisContext | null): "LOW" | "MEDIUM" | "HIGH" | null {
  if (!analysis || !["LOW", "MEDIUM", "HIGH"].includes(analysis.riskLevel ?? "")) return null;
  return analysis.riskReasons.some((reason) => typeof reason === "string" && reason.trim().length > 0)
    ? analysis.riskLevel as "LOW" | "MEDIUM" | "HIGH"
    : null;
}

export function generateGrowthRoadmap(input: {
  readonly profile: GrowthRoadmapProfileContext;
  readonly opportunity: RoadmapOpportunityContext;
  readonly analysis: RoadmapAnalysisContext | null;
}): { readonly generationContext: GrowthRoadmapGenerationContext; readonly steps: ReturnType<typeof roadmapStepSchema.parse>[] } {
  const parsed = growthProfileSchema.safeParse(input.profile);
  const opportunity = input.opportunity;
  const evidence = evidenceSchema.safeParse(opportunity.evidence.map(({ id, sourceName, sourceReference }) => ({
    id,
    sourceName,
    sourceReference,
  })));
  if (
    !parsed.success || !evidence.success || !opportunity.name.trim() || !opportunity.categoryName.trim() ||
    !opportunity.id.trim() || !opportunity.trend.id.trim() ||
    !opportunity.description.trim() || !opportunity.trend.title.trim() ||
    !opportunity.trend.signalSummary.trim() ||
    opportunity.trend.lifecycleState !== "PUBLISHED" ||
    !opportunity.trend.affectedUserTypes.includes("UMKM_EXISTING")
  ) {
    throw new RoadmapInsufficientDataError();
  }

  const profile = parsed.data;
  const location = clean(profile.locationText) ?? "lokasi pada profil bisnis";
  const segment = profile.customerSegments[0]!;
  const channel = profile.salesChannels[0]!;
  const existingProducts = profile.products.slice(0, 3).map(({ name }) => name).join(", ");
  const scoreAvailable = input.analysis?.scoreStatus === "AVAILABLE";
  const opportunityScore = scoreAvailable ? validSignal(input.analysis?.opportunityScore ?? null) : null;
  const fitScore = scoreAvailable ? validSignal(input.analysis?.fitScore ?? null) : null;
  const riskLevel = validRisk(input.analysis);
  const unavailableInputs = [
    "Catatan transaksi penjualan aktual",
    "Catatan biaya aktual untuk penilaian margin",
    ...(opportunityScore === null ? ["Opportunity Score"] : []),
    ...(fitScore === null ? ["Fit Score"] : []),
    ...(riskLevel === null ? ["Risk"] : []),
  ];

  const steps = [
    {
      sequence: 1,
      stage: GROWTH_ROADMAP_STAGES[0],
      action: `Tinjau kebutuhan pelanggan yang saat ini dilayani ${segment} di ${location}. Bicarakan relevansi Opportunity “${opportunity.name}” dan catat masukan yang benar-benar disampaikan untuk bisnis ${profile.businessName}.`,
      objective: "Memeriksa apakah kebutuhan yang terkait Opportunity muncul pada pelanggan bisnis yang sudah berjalan, tanpa menganggap Trend sebagai bukti permintaan.",
      timeline: "Sebelum mengubah menu atau proses operasional",
      expectedOutput: "Catatan percakapan, kebutuhan, keberatan, dan pertanyaan yang masih terbuka; bukan estimasi jumlah pelanggan atau permintaan pasar.",
    },
    {
      sequence: 2,
      stage: GROWTH_ROADMAP_STAGES[1],
      action: `Siapkan contoh produk atau penawaran terbatas yang menghubungkan Opportunity “${opportunity.name}” dengan kategori ${opportunity.categoryName}. Bandingkan dengan produk aktif ${existingProducts} dan dokumentasikan bahan serta proses yang benar-benar digunakan.`,
      objective: "Membuat bentuk uji yang dapat ditinjau pelanggan sambil menjaga perbedaan antara rancangan baru dan produk yang sudah dijual.",
      timeline: "Setelah kebutuhan awal ditinjau",
      expectedOutput: "Contoh menu atau penawaran, catatan proses aktual, dan daftar informasi yang belum tersedia; harga atau biaya baru tidak diasumsikan.",
    },
    {
      sequence: 3,
      stage: GROWTH_ROADMAP_STAGES[2],
      action: `Uji penawaran secara terbatas melalui ${channel} kepada pelanggan yang relevan dengan segmen ${segment}. Catat penawaran, transaksi yang benar-benar terjadi, respons, dan kendala pemenuhan dalam operasi ${profile.businessName}.`,
      objective: "Mengamati pelaksanaan dan respons aktual sebelum memperluas produk atau mengubah operasi bisnis.",
      timeline: "Setelah contoh penawaran siap dan ketentuan setempat diperiksa",
      expectedOutput: "Log uji yang memisahkan penawaran, respons, transaksi aktual, dan kendala; minat pelanggan tidak diperlakukan sebagai proyeksi penjualan.",
    },
    {
      sequence: 4,
      stage: GROWTH_ROADMAP_STAGES[3],
      action: "Tinjau umpan balik bersama catatan transaksi, diskon atau pengembalian jika terjadi, dan biaya aktual yang dapat ditelusuri. Jika catatan biaya atau penjualan tidak tersedia, kumpulkan bukti transaksi dan biaya yang benar-benar dikeluarkan sebelum menghitung margin; jangan mengisi angka perkiraan.",
      objective: "Menilai hasil uji dari bukti operasional yang tercatat dan menunjukkan dengan jelas bagian margin yang belum dapat dihitung.",
      timeline: "Setelah catatan uji dan dokumen biaya dapat ditinjau",
      expectedOutput: "Ringkasan umpan balik dan rekonsiliasi catatan aktual, atau daftar catatan transaksi dan biaya yang masih perlu dikumpulkan; tidak ada margin hasil estimasi.",
    },
    {
      sequence: 5,
      stage: GROWTH_ROADMAP_STAGES[4],
      action: "Pilih sendiri apakah penawaran akan diperluas, direvisi lalu diuji kembali, atau dihentikan dengan mempertimbangkan catatan pelanggan, transaksi, biaya aktual, dan kapasitas operasi yang tersedia.",
      objective: "Mendukung keputusan pemilik bisnis yang dapat dijelaskan berdasarkan hasil aktual dan informasi yang masih belum diketahui.",
      timeline: "Setelah evaluasi bukti uji selesai",
      expectedOutput: "Keputusan Rollout, Revise, atau Stop beserta bukti yang dipertimbangkan dan pertanyaan yang masih terbuka; bukan rekomendasi otomatis atau jaminan hasil.",
    },
  ].map((step) => roadmapStepSchema.parse(step));

  const generationContext: GrowthRoadmapGenerationContext = {
    version: GROWTH_ROADMAP_GENERATION_VERSION,
    method: GROWTH_ROADMAP_GENERATION_METHOD,
    contextMode: "LIMITED_CONTEXT",
    profileVersion: profile.profileVersion,
    profileInputs: {
      businessName: profile.businessName,
      businessCategory: profile.businessCategory,
      location,
      averagePriceRange: { min: profile.averagePriceMin, max: profile.averagePriceMax, currency: "IDR" },
      products: profile.products.map((product) => ({
        name: product.name,
        category: clean(product.category),
        listedPrice: product.price,
      })),
      customerSegments: profile.customerSegments,
      salesChannels: profile.salesChannels,
      businessDescription: clean(profile.businessDescription, 1000),
    },
    opportunity: {
      id: opportunity.id,
      name: opportunity.name,
      category: opportunity.categoryName,
      trendId: opportunity.trend.id,
      trendTitle: opportunity.trend.title,
      trendSummary: opportunity.trend.signalSummary,
    },
    evidence: evidence.data,
    availableSignals: { opportunityScore, fitScore, riskLevel },
    unavailableInputs,
    assumptions: [
      "Roadmap menyusun langkah uji dari Business Profile, Opportunity terpilih, dan konteks Trend yang tersimpan.",
      "Harga rata-rata pada profil adalah konteks yang dicatat pengguna, bukan harga produk uji atau dasar perhitungan margin.",
      "Trend terpublikasi dan evidence memberi konteks sumber, bukan validasi fakta, permintaan, atau hasil bisnis.",
      ...(opportunity.evidence.length === 0 ? ["Tidak ada evidence tersimpan yang dapat dirujuk untuk Opportunity ini."] : []),
    ],
    limitations: [
      "Roadmap dibuat dengan template deterministik berversi; tidak menggunakan LLM dan bukan prediksi.",
      "Data transaksi dan biaya operasional aktual tidak tersedia pada Business Profile, sehingga margin tidak dihitung.",
      "Score dan Risk tersimpan hanya menjadi konteks tambahan jika tersedia; data yang hilang tidak diganti dengan angka perkiraan.",
      ...(input.analysis ? [] : ["Analisis Opportunity Score, Fit Score, dan Risk belum tersedia untuk pengguna dan Opportunity ini."]),
    ],
  };

  return { generationContext, steps };
}
