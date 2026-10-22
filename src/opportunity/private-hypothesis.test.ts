import { describe, expect, it } from "vitest";

import {
  privateOpportunityGenerationResponseSchema,
  privateOpportunityHypothesisSchema,
  privateOpportunitySourceSchema,
  generatedOpportunityHypothesisSchema,
} from "./private-hypothesis";

describe("private Opportunity hypothesis compatibility", () => {
  it("continues to accept historical hypothesis rows without enrichment fields", () => {
    const legacy = privateOpportunityHypothesisSchema.safeParse({
      title: "Uji menu kopi",
      concept: "Uji satu konsep minuman kopi dengan pelanggan sekitar sebelum menentukan langkah usaha.",
      targetCustomer: "Pelanggan sekitar yang tertarik pada kopi.",
      validationSteps: ["Tanyakan minat kepada pelanggan.", "Catat tanggapan setelah uji coba."],
      assumptions: ["Sebagian pelanggan mungkin tertarik."]
    });

    expect(legacy.success).toBe(true);
    if (legacy.success) expect(legacy.data.profileAlignment).toBeUndefined();
  });

  it("keeps persisted legacy evidenceGaps strings while reserving IDs for new provider output", () => {
    const legacySaved = privateOpportunityHypothesisSchema.safeParse({
      title: "Uji menu kopi",
      concept: "Uji satu konsep minuman kopi dengan pelanggan sekitar sebelum menentukan langkah usaha.",
      targetCustomer: "Pelanggan sekitar yang tertarik pada kopi.",
      validationSteps: ["Tanyakan minat kepada pelanggan.", "Catat tanggapan setelah uji coba."],
      assumptions: ["Sebagian pelanggan mungkin tertarik."],
      evidenceGaps: ["Harga produk pesaing belum diverifikasi."],
    });
    const modelFreeTextGap = generatedOpportunityHypothesisSchema.safeParse({
      title: "Uji menu kopi",
      opportunityType: "PRODUCT_CONCEPT",
      concept: "Uji satu konsep minuman kopi dengan pelanggan sekitar sebelum menentukan langkah usaha.",
      targetCustomer: "Pelanggan sekitar yang tertarik pada kopi.",
      validationSteps: ["Tanyakan minat kepada pelanggan.", "Catat tanggapan setelah uji coba."],
      assumptions: ["Sebagian pelanggan mungkin tertarik."],
      profileAlignment: ["Selaras dengan minat produk yang dinyatakan."],
      profileReferences: ["profile.preferredProductType"],
      evidenceInterpretation: "Kueri terpilih menunjukkan minat pencarian, bukan pembelian.",
      evidenceReferences: ["searchapi_synthetic_source"],
      evidenceGaps: ["Harga produk pesaing belum diverifikasi."],
      limitations: ["Google Trends tidak mengukur transaksi atau penjualan."],
    });

    expect(legacySaved.success).toBe(true);
    if (legacySaved.success) expect(legacySaved.data.evidenceGaps).toEqual(["Harga produk pesaing belum diverifikasi."]);
    expect(modelFreeTextGap.success).toBe(false);
  });

  it("accepts an insufficient-evidence API response only when its data list is empty", () => {
    const result = privateOpportunityGenerationResponseSchema.safeParse({
      data: [],
      outcome: "INSUFFICIENT_EVIDENCE",
      reason: "Bukti yang dipilih terlalu umum untuk membuat hipotesis yang dapat diuji.",
      limitations: ["Google Trends tidak menunjukkan pembelian atau penjualan."],
      requestId: "req_synthetic",
    });
    const inconsistent = privateOpportunityGenerationResponseSchema.safeParse({
      data: [{ title: "Tidak diharapkan" }],
      outcome: "INSUFFICIENT_EVIDENCE",
      reason: "Bukti yang dipilih terlalu umum untuk membuat hipotesis yang dapat diuji.",
      limitations: ["Google Trends tidak menunjukkan pembelian atau penjualan."],
    });

    expect(result.success).toBe(true);
    expect(inconsistent.success).toBe(false);
  });
});

describe("private Opportunity source compatibility", () => {
  it("continues to accept persisted Bright Data source references", () => {
    const legacy = privateOpportunitySourceSchema.safeParse({
      snapshotId: "80000000-0000-4000-8000-000000000031",
      signalId: "80000000-0000-4000-8000-000000000032",
      title: "Kopi kenangan",
      publisher: "Google Trends",
      transport: "Bright Data SERP API",
      url: "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1",
      retrievedAt: "2026-10-18T04:00:00.000Z",
      classification: "LIKELY_FNB",
    });

    expect(legacy.success).toBe(true);
    if (legacy.success) expect(legacy.data.transport).toBe("Bright Data SERP API");
  });

  it("accepts SearchApi provenance without adding an F&B classification", () => {
    const source = privateOpportunitySourceSchema.safeParse({
      sourceType: "RELATED_QUERY_RISING",
      productQuery: "Kopi",
      query: "kopi oat milk",
      position: 1,
      interestIndex: null,
      growthLabel: "Breakout",
      growthPercent: null,
      isBreakout: true,
      geo: "ID",
      period: "24 jam terakhir",
      providerTime: "now 1-d",
      searchProperty: "web",
      retrievedAt: "2026-10-18T04:00:00.000Z",
      expiresAt: "2026-10-18T04:05:00.000Z",
      publisher: "Google Trends",
      provider: "SearchApi.io",
      transport: "SearchApi.io",
      url: "https://trends.google.com/trends/explore?geo=ID&date=now+1-d&q=Kopi",
      providerSourceUrl: null,
    });

    expect(source.success).toBe(true);
    if (source.success) {
      expect(source.data).not.toHaveProperty("classification");
      expect(source.data.transport).toBe("SearchApi.io");
    }
  });
});
