import { entrepreneurAnalysisSchema } from "../entrepreneur-analysis-contract";
import { privateOpportunityIdeaResponseSchema } from "../private-hypothesis";

export function privateEntrepreneurFixture() {
  const factor = (key: string, weight: number) => ({ key, label: key, value: 80, weight, basis: "MARKET", reason: "Bukti pengujian terkontrol." });
  const analysis = entrepreneurAnalysisSchema.parse({
    version: "entrepreneur-decision-v2", generatedAt: "2026-10-21T01:00:00.000Z", inputFingerprint: "a".repeat(64), model: null,
    requirements: { categoryId: null, customerSegmentIds: [], salesChannelIds: [], requiredExperience: "BEGINNER", requiredTime: "PART_TIME", complexity: "STANDARD", summary: "Konsep untuk diuji.", rationale: "Perlu validasi pelanggan.", initialNeeds: ["Bahan prototipe dan pencatatan biaya."], assumptions: ["Respons pelanggan belum diketahui."] },
    capitalMin: 500000,
    opportunity: { score: 80, coverage: 100, status: "PRELIMINARY", factors: [factor("trendMomentum", .25), factor("demandSignal", .2), factor("competition", .15), factor("consumerRelevance", .15), factor("executionFeasibility", .15), factor("marketSustainability", .1)] },
    fit: { score: 80, coverage: 100, status: "PRELIMINARY", factors: [factor("budgetFit", .3), factor("interestFit", .2), factor("channelFit", .2), factor("experienceFit", .15), factor("timeFit", .15)] },
    targetConsumer: "Keluarga di sekitar lokasi uji.", competition: "Sampel lokal terbatas untuk ditinjau.", risks: ["Respons pembeli perlu diuji."], trend: null, competitors: null, warnings: [],
  });
  return privateOpportunityIdeaResponseSchema.parse({ id: "90000000-0000-4000-8000-000000000021", saved: true, generatedAt: analysis.generatedAt, provider: "ninerouter", model: "test-model",
    hypothesis: { title: "Uji bakso ayam keluarga", concept: "Uji konsep bakso ayam untuk keluarga sebelum menentukan langkah usaha berikutnya.", targetCustomer: analysis.targetConsumer, validationSteps: ["Tanyakan kebutuhan calon pelanggan.", "Catat tanggapan terhadap prototipe."], assumptions: ["Penerimaan pembeli belum diketahui."], analysis },
    source: { snapshotId: "80000000-0000-4000-8000-000000000031", signalId: "80000000-0000-4000-8000-000000000032", title: "Bakso ayam", publisher: "Google Trends", transport: "Bright Data SERP API", url: "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1", retrievedAt: analysis.generatedAt, classification: "REVIEW_REQUIRED" },
  });
}
