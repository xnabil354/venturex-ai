import { ONBOARDING_STATUSES, parseUserId, type SafeUser, type UserType } from "../auth/user-types";
import type { OpportunityAnalysisContext } from "./context";
import type { OpportunityAnalysis } from "./domain";

export const TEST_USER_ID = parseUserId("10000000-0000-4000-8000-000000000001");
export const OTHER_TEST_USER_ID = parseUserId("10000000-0000-4000-8000-000000000002");
export const TEST_OPPORTUNITY_ID = "60000000-0000-4000-8000-000000000001";

export function testUser(userType: UserType = "ENTREPRENEUR", id = TEST_USER_ID): SafeUser & { readonly userType: UserType } {
  return {
    id,
    email: "synthetic-user@example.test",
    userType,
    onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
  };
}

export function testAnalysisContext(userType: UserType = "ENTREPRENEUR"): OpportunityAnalysisContext {
  const profile = userType === "ENTREPRENEUR"
    ? {
        type: "ENTREPRENEUR" as const,
        profileVersion: 2,
        location: "Kota Contoh, Provinsi Contoh",
        budgetIdr: { minimum: 10, maximum: 100 },
        experienceLevel: "BEGINNER",
        timeCommitment: "PART_TIME",
        preferredProductType: "Minuman",
        interests: ["Minuman"],
        targetCustomers: ["Mahasiswa"],
        salesChannels: ["Gerai"],
      }
    : {
        type: "UMKM_EXISTING" as const,
        profileVersion: 3,
        location: "Kota Contoh, Provinsi Contoh",
        businessCategory: "Minuman",
        businessDescription: "Deskripsi synthetic usaha F&B.",
        averagePriceIdr: { minimum: 10, maximum: 100 },
        products: [{ category: "Minuman", priceIdr: 25 }],
        targetCustomers: ["Mahasiswa"],
        salesChannels: ["Gerai"],
      };

  return {
    userType,
    profileVersion: profile.profileVersion,
    profile,
    opportunity: {
      id: TEST_OPPORTUNITY_ID,
      name: "Peluang menu contoh",
      description: "Deskripsi opportunity contoh yang tersimpan.",
      category: "Minuman",
      type: "NEW_PRODUCT",
      targetConsumer: "Konsumen yang mencari pilihan praktis.",
      competitionLevel: "MEDIUM",
      competitionSummary: "Ringkasan kompetisi dari katalog.",
      requirements: { capitalMinIdr: "20", capitalMaxIdr: "80" },
    },
    trend: {
      title: "Trend pilihan minuman",
      signalSummary: "Ringkasan trend contoh.",
      signalDescription: "Deskripsi trend contoh yang dipublikasikan.",
      businessRelevanceExplanation: "Kaitan F&B tersimpan.",
      direction: "RISING",
      periodStart: "2026-01-01",
      periodEnd: "2026-06-30",
      evidence: [{ sourceName: "Sumber contoh", sourceReference: "Referensi contoh", supportingDetail: "Dukungan evidence contoh.", sourceDate: "2026-05-01", limitations: null }],
    },
    opportunityScore: { status: "INSUFFICIENT_DATA", score: null, reason: "CONFIGURATION_UNAVAILABLE" },
    fitScore: { status: "AVAILABLE", score: 75, policyVersion: "FIT_MVP_HEURISTIC_V1" },
    riskAssessment: { status: "INSUFFICIENT_DATA", level: null, reasons: [], reason: "CONFIGURATION_NOT_APPROVED" },
    evidence: { status: "AVAILABLE", limited: false, opportunity: [{ sourceName: "Sumber Opportunity", sourceType: "Open Data", sourceDate: "2026-05-01", sourceReference: "Tabel contoh", sourceUrl: "https://example.test/source", limitations: [] }], trend: [] },
    contextFingerprint: "a".repeat(64),
  };
}

export const testAnalysis: OpportunityAnalysis = {
  summary: "Peluang ini dapat dipertimbangkan sebagai hipotesis awal.",
  whyRelevant: "Kategori dan kanal yang tercatat selaras dengan profil Anda.",
  targetConsumer: "Gunakan segmen konsumen yang tercatat sebagai titik awal wawancara.",
  competition: "Ringkasan katalog menyebut kompetisi sedang; cakupan pesaing belum diverifikasi.",
  potential: "Bukti yang tersedia memberi konteks awal, sementara minat konsumen setempat masih perlu diuji.",
  risks: ["Evidence terbatas dan tidak membuktikan besarnya permintaan."],
  nextAction: "Wawancarai calon konsumen dan catat respons sebelum mengeluarkan biaya besar.",
};
