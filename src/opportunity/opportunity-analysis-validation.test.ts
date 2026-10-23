import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildOpportunityAnalysisContext,
  type BuiltOpportunityProfileContext,
} from "./opportunity-analysis-context";
import type { SearchApiOpportunityEvidence } from "./searchapi-evidence-contract";
import {
  generatedOpportunityResultSchema,
  validateGeneratedOpportunityResult,
  type GeneratedOpportunityResult,
} from "./opportunity-analysis-validation";

const profile: BuiltOpportunityProfileContext = {
  profile: {
    persona: "UMKM_EXISTING",
    businessName: "Kedai Soto",
    businessCategory: "Makanan",
    businessDescription: "Warung makan keluarga.",
    location: { text: "Bandung", city: "Bandung", province: "Jawa Barat" },
    averagePrice: { min: 18000, max: 30000, currency: "IDR" },
    products: [{ name: "Soto Ayam", category: "Makanan", price: 22000 }],
    customerSegments: ["Pelanggan lokal"],
    salesChannels: ["Pesan antar"],
    notes: "Fokus pada kemasan yang praktis.",
  },
  dataAvailability: {
    profileFieldsPresent: ["profile.businessName", "profile.businessCategory", "profile.businessDescription", "profile.location", "profile.averagePrice", "profile.products", "profile.products[].category", "profile.products[].price", "profile.customerSegments", "profile.salesChannels", "profile.notes"],
    profileFieldsMissing: [],
  },
};

const evidence: SearchApiOpportunityEvidence = {
  sourceType: "RELATED_QUERY_RISING",
  productQuery: "Kedai Soto",
  query: "soto ayam kemasan",
  position: 2,
  interestIndex: null,
  growthLabel: "+450%",
  growthPercent: 450,
  isBreakout: false,
  geo: "ID",
  period: "24 jam terakhir",
  providerTime: "now 1-d",
  searchProperty: "web",
  retrievedAt: "2026-10-18T04:00:00.000Z",
  expiresAt: "2026-10-18T04:05:00.000Z",
  publisher: "Google Trends",
  provider: "SearchApi.io",
  url: "https://trends.google.com/trends/explore?geo=ID&date=now+1-d&q=soto+ayam",
  providerSourceUrl: null,
};

const context = buildOpportunityAnalysisContext(profile, evidence);

function idea(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    title: "Uji kemasan soto praktis",
    opportunityType: "NEW_VARIANT" as const,
    concept: "Uji varian kemasan soto yang lebih praktis untuk dibawa oleh pelanggan.",
    targetCustomer: "Pelanggan lokal yang ingin membawa makanannya saat bepergian.",
    profileAlignment: [{
      rationale: "Selaras dengan produk soto dan kanal pesan antar yang sudah dinyatakan.",
      supportingProfileRefs: ["profile.customerSegments"],
    }],
    profileReferences: ["profile.products", "profile.salesChannels"],
    evidenceInterpretation: "Kueri Rising terkait kemasan menunjukkan minat pencarian meningkat, bukan pembelian.",
    evidenceReferences: [context.evidence.sourceId],
    assumptions: ["Pelanggan yang ada mungkin tertarik pada kemasan praktis."],
    evidenceGapIds: ["gap_customer_validation_required_target_customer"],
    validationSteps: ["Tanyakan preferensi kemasan kepada pelanggan saat ini.", "Uji kemasan yang tersedia dan catat tanggapan langsung."],
    limitations: ["Google Trends tidak mengukur pembelian, permintaan pasar, atau keuntungan."],
    ...overrides,
  };
}

function schemaIdea(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    title: "Uji kemasan soto praktis",
    opportunityType: "NEW_VARIANT",
    concept: "Uji varian kemasan soto yang lebih praktis untuk dibawa oleh pelanggan.",
    targetCustomer: "Pelanggan lokal yang ingin membawa makanannya saat bepergian.",
    validationSteps: ["Tanyakan preferensi kemasan kepada pelanggan saat ini.", "Uji kemasan dan catat tanggapan langsung."],
    assumptions: ["Sebagian pelanggan mungkin tertarik pada kemasan praktis."],
    profileAlignment: [{
      rationale: "Selaras dengan produk dan kanal yang dinyatakan.",
      supportingProfileRefs: ["profile.customerSegments"],
    }],
    profileReferences: ["profile.products"],
    evidenceInterpretation: "Minat pencarian meningkat untuk kueri terkait, bukan pembelian.",
    evidenceReferences: ["searchapi_synthetic_source"],
    evidenceGapIds: ["gap_customer_validation_required_target_customer"],
    limitations: ["Google Trends tidak mengukur pembelian atau keuntungan."],
    ...overrides,
  };
}

describe("Opportunity hypothesis grounding validation", () => {
  it("accepts profile-supported financial values and exact evidence metrics while preserving their meaning", () => {
    const result: GeneratedOpportunityResult = {
      outcome: "HYPOTHESES",
      ideas: [idea({
        concept: "Uji varian kemasan soto dengan acuan harga Soto Ayam tercatat Rp22.000, lalu bandingkan penerimaan pelanggan.",
        profileReferences: ["profile.products[].price"],
        evidenceInterpretation: "Kueri Rising tercatat +450%; ini menunjukkan pencarian, bukan pembelian.",
      }) as never],
    };
    expect(validateGeneratedOpportunityResult(result, context)).toBeNull();
  });

  it("accepts only a cited Entrepreneur budget amount and normalizes Indonesian number words", () => {
    const entrepreneur: BuiltOpportunityProfileContext = {
      profile: {
        persona: "ENTREPRENEUR",
        preferredProductType: "Kopi susu",
        categories: ["Kopi"],
        customerSegments: ["Pekerja sekitar"],
        salesChannels: ["Pesan antar"],
        budget: { min: 250_000, max: 400_000, currency: "IDR" },
        location: { text: "Bandung", city: "Bandung", province: "Jawa Barat" },
        experienceLevel: "BEGINNER",
        timeCommitment: "PART_TIME",
        businessObjective: "Memulai usaha kecil",
        notes: null,
      },
      dataAvailability: {
        profileFieldsPresent: ["profile.budget", "profile.categories", "profile.preferredProductType"],
        profileFieldsMissing: [],
      },
    };
    const entrepreneurContext = buildOpportunityAnalysisContext(entrepreneur, evidence);
    const supportedBudget = {
      outcome: "HYPOTHESES" as const,
      ideas: [idea({
        opportunityType: "BUSINESS_CONCEPT",
        concept: "Rancang uji konsep dengan modal dua ratus lima puluh ribu rupiah sesuai batas awal yang dinyatakan.",
        profileReferences: ["profile.budget"],
        profileAlignment: [{ rationale: "Modal yang dinyatakan menjadi batas awal pengujian.", supportingProfileRefs: ["profile.budget"] }],
        evidenceReferences: [entrepreneurContext.evidence.sourceId],
      }) as never],
    };

    expect(entrepreneurContext.financialEvidenceAvailability.inventory).toEqual(expect.arrayContaining([
      expect.objectContaining({ metric: "BUDGET", subjectScope: "BUSINESS", status: "KNOWN", trustedSourceReference: "profile.budget" }),
      expect.objectContaining({ metric: "PROPOSED_PRODUCT_PRICE", subjectScope: "PROPOSED_PRODUCT", status: "UNKNOWN" }),
      expect.objectContaining({ metric: "COMPETITOR_PRICE", subjectScope: "COMPETITOR", status: "UNKNOWN" }),
    ]));
    expect(entrepreneurContext.financialEvidenceAvailability.inventory.some((item) => item.metric === "AVERAGE_BUSINESS_PRICE")).toBe(false);
    expect(validateGeneratedOpportunityResult(supportedBudget, entrepreneurContext)).toBeNull();
    expect(validateGeneratedOpportunityResult({
      outcome: "HYPOTHESES",
      ideas: [idea({
        opportunityType: "BUSINESS_CONCEPT",
        profileReferences: ["profile.budget"],
        profileAlignment: [{ rationale: "Anggaran yang dinyatakan menjadi batas konsep usaha.", supportingProfileRefs: ["profile.budget"] }],
        evidenceReferences: [entrepreneurContext.evidence.sourceId],
        evidenceGapIds: ["gap_proposed_product_price_unknown_proposal"],
      }) as never],
    }, entrepreneurContext)).toBeNull();
  });

  it("normalizes Indonesian decimal and thousands separators without changing the source unit", () => {
    const decimalProfile: BuiltOpportunityProfileContext = {
      profile: {
        persona: "UMKM_EXISTING",
        businessName: "Kedai Soto",
        businessCategory: "Makanan",
        businessDescription: "Warung makan keluarga.",
        location: { text: "Bandung", city: "Bandung", province: "Jawa Barat" },
        averagePrice: { min: 18_000, max: 30_000, currency: "IDR" },
        products: [{ name: "Soto Ayam", category: "Makanan", price: 20_000.5 }],
        customerSegments: ["Pelanggan lokal"],
        salesChannels: ["Pesan antar"],
        notes: "Fokus pada kemasan yang praktis.",
      },
      dataAvailability: {
        ...profile.dataAvailability,
      },
    };
    const decimalContext = buildOpportunityAnalysisContext(decimalProfile, evidence);
    const result = {
      outcome: "HYPOTHESES" as const,
      ideas: [idea({
        concept: "Uji kemasan dengan harga Soto Ayam tercatat Rp20.000,50 dan tanyakan penerimaan pelanggan.",
        profileReferences: ["profile.products[].price"],
        evidenceReferences: [decimalContext.evidence.sourceId],
      }) as never],
    };

    expect(validateGeneratedOpportunityResult(result, decimalContext)).toBeNull();
  });

  it("grounds an existing product price to the named product rather than another product with the same price field", () => {
    if (profile.profile.persona !== "UMKM_EXISTING") throw new Error("Expected synthetic UMKM profile.");
    const scopedProfile: BuiltOpportunityProfileContext = {
      ...profile,
      profile: {
        ...profile.profile,
        products: [
          { name: "Teh", category: "Minuman", price: 5000 },
          { name: "Teh Botol", category: "Minuman", price: 8000 },
        ],
      },
    };
    const scopedContext = buildOpportunityAnalysisContext(scopedProfile, evidence);
    const exactProductPrice = {
      outcome: "HYPOTHESES" as const,
      ideas: [idea({
        concept: "Uji penawaran dengan harga produk Teh Botol Rp8.000 sesuai catatan profil.",
        profileReferences: ["profile.products[].price"],
      }) as never],
    };
    const mismatchedProductPrice = {
      outcome: "HYPOTHESES" as const,
      ideas: [idea({
        concept: "Uji penawaran dengan harga produk Teh Rp8.000 sesuai catatan profil.",
        profileReferences: ["profile.products[].price"],
      }) as never],
    };

    expect(validateGeneratedOpportunityResult(exactProductPrice, scopedContext)).toBeNull();
    expect(validateGeneratedOpportunityResult(mismatchedProductPrice, scopedContext)?.rejectedRule).toBe("UNSUPPORTED_FINANCIAL_CLAIM");
  });

  it("accepts a documented time range in an evidence-gap statement without treating it as sales volume", () => {
    const insufficient: GeneratedOpportunityResult = {
      outcome: "INSUFFICIENT_EVIDENCE",
      reason: "Kueri yang dipilih belum cukup terkait dengan produk dan segmen usaha ini.",
      limitations: [
        "SearchApi hanya menunjukkan minat pencarian.",
        "Belum ada data pembelian untuk menilai penerimaan produk.",
        "Data penjualan untuk periode 24 jam belum tersedia.",
      ],
    };

    expect(validateGeneratedOpportunityResult(insufficient, context)).toBeNull();
  });

  it("reproduces an ambiguous numeric restatement despite a matching Top-query interest index", () => {
    const topContext = buildOpportunityAnalysisContext(profile, {
      ...evidence,
      sourceType: "RELATED_QUERY_TOP",
      productQuery: "kopi",
      query: "kopi hitam",
      position: 1,
      interestIndex: 25,
      growthLabel: null,
      growthPercent: null,
      isBreakout: false,
    });
    const rejected = validateGeneratedOpportunityResult({
      outcome: "HYPOTHESES",
      ideas: [idea({
        evidenceReferences: [topContext.evidence.sourceId],
        evidenceInterpretation: "Kueri kopi hitam tercatat dengan nilai 25 dan patut diteliti lebih lanjut.",
      }) as never],
    }, topContext);

    expect(rejected).toMatchObject({
      rejectedRule: "UNSUPPORTED_NUMBER",
      semanticCategory: "AMBIGUOUS_NUMERIC_STATEMENT",
      numericDiagnostics: [{
        fieldPath: "ideas[0].evidenceInterpretation",
        verifiedSourceMatch: false,
        unitClassification: "OTHER",
        expectedMetricCategory: "OTHER_CONTEXTUAL_NUMBER",
        reason: "AMBIGUOUS_NUMERIC_MEANING",
      }],
    });
  });

  it("accepts the exact top-interest index with evidence provenance and rejects reuse as a customer count", () => {
    const topContext = buildOpportunityAnalysisContext(profile, {
      ...evidence,
      sourceType: "RELATED_QUERY_TOP",
      interestIndex: 31,
      growthLabel: null,
      growthPercent: null,
      isBreakout: false,
    });
    const supported = {
      outcome: "HYPOTHESES" as const,
      ideas: [idea({
        evidenceReferences: [topContext.evidence.sourceId],
        evidenceInterpretation: "Indeks minat pencarian untuk kueri terpilih tercatat 31, bukan jumlah pembelian.",
      }) as never],
    };
    const unsupportedReuse = {
      outcome: "HYPOTHESES" as const,
      ideas: [idea({
        evidenceReferences: [topContext.evidence.sourceId],
        concept: "Uji produk yang dapat menarik 31 pelanggan baru melalui kanal pesan antar.",
        evidenceInterpretation: "Indeks minat pencarian bukan bukti pembelian.",
      }) as never],
    };

    expect(validateGeneratedOpportunityResult(supported, topContext)).toBeNull();
    expect(validateGeneratedOpportunityResult(unsupportedReuse, topContext)?.rejectedRule).toBe("UNSUPPORTED_METRIC_CLAIM");
  });

  it("accepts a retrieval date only when it matches the selected evidence date", () => {
    const dated = {
      outcome: "HYPOTHESES" as const,
      ideas: [idea({
        evidenceInterpretation: "Bukti kueri yang dipilih diambil pada 2026-10-18; hasil ini tetap hanya menunjukkan minat pencarian.",
      }) as never],
    };
    const inventedDate = {
      outcome: "HYPOTHESES" as const,
      ideas: [idea({
        evidenceInterpretation: "Bukti kueri yang dipilih diambil pada 2026-10-19; hasil ini tetap hanya menunjukkan minat pencarian.",
      }) as never],
    };

    expect(validateGeneratedOpportunityResult(dated, context)).toBeNull();
    expect(validateGeneratedOpportunityResult(inventedDate, context)?.rejectedRule).toBe("UNSUPPORTED_NUMBER");
  });

  it("does not reuse the same digits across evidence units or turn Breakout into a percentage", () => {
    const breakoutContext = buildOpportunityAnalysisContext(profile, {
      ...evidence,
      growthLabel: "Breakout",
      growthPercent: null,
      isBreakout: true,
    });
    const inventedGrowth = {
      outcome: "HYPOTHESES" as const,
      ideas: [idea({
        evidenceReferences: [breakoutContext.evidence.sourceId],
        evidenceInterpretation: "Kueri Breakout menunjukkan pertumbuhan penjualan sebesar 450%.",
      }) as never],
    };

    expect(validateGeneratedOpportunityResult(inventedGrowth, breakoutContext)?.rejectedRule)
      .toBe("UNSUPPORTED_FINANCIAL_CLAIM");
  });

  it("rejects unsupported numbers, profit claims, and guarantees", () => {
    expect(validateGeneratedOpportunityResult({ outcome: "HYPOTHESES", ideas: [idea({ concept: "Uji menu yang diperkirakan menghasilkan omzet Rp500.000 setiap hari untuk pelanggan lokal.", evidenceInterpretation: "Kueri hanya menunjukkan minat pencarian.", }) as never] }, context)?.rejectedRule).toBe("UNSUPPORTED_FINANCIAL_CLAIM");
    expect(validateGeneratedOpportunityResult({ outcome: "HYPOTHESES", ideas: [idea({ concept: "Uji varian yang dapat melayani 50 pelanggan baru dengan menu yang praktis.", evidenceInterpretation: "Kueri hanya menunjukkan minat pencarian.", }) as never] }, context)?.rejectedRule).toBe("UNSUPPORTED_METRIC_CLAIM");
    expect(validateGeneratedOpportunityResult({ outcome: "HYPOTHESES", ideas: [idea({ concept: "Varian ini dijamin pasti laris untuk pelanggan lokal dan mudah dibuat.", evidenceInterpretation: "Kueri hanya menunjukkan minat pencarian.", }) as never] }, context)?.rejectedRule).toBe("UNSUPPORTED_GUARANTEE");
    expect(validateGeneratedOpportunityResult({ outcome: "HYPOTHESES", ideas: [idea({ concept: "Konsep ini dapat meningkatkan omzet tanpa ada data penjualan yang mendukung klaim tersebut.", }) as never] }, context)?.rejectedRule).toBe("UNSUPPORTED_FINANCIAL_CLAIM");
    expect(validateGeneratedOpportunityResult({ outcome: "HYPOTHESES", ideas: [idea({ concept: "Konsep ini diperkirakan menarik bagi lima puluh pelanggan baru.", }) as never] }, context)?.rejectedRule).toBe("UNSUPPORTED_METRIC_CLAIM");
    expect(validateGeneratedOpportunityResult({ outcome: "HYPOTHESES", ideas: [idea({ concept: "Uji konsep ini dengan sepuluh sampel sebelum menentukan langkah berikutnya.", }) as never] }, context)).toBeNull();
    expect(validateGeneratedOpportunityResult({ outcome: "HYPOTHESES", ideas: [idea({ concept: "Gunakan modal satu juta rupiah untuk memulai usaha.", }) as never] }, context)?.rejectedRule).toBe("UNSUPPORTED_FINANCIAL_CLAIM");
    expect(validateGeneratedOpportunityResult({ outcome: "HYPOTHESES", ideas: [idea({ concept: "Konsep ini diperkirakan menghasilkan laba Rp500.000 untuk usaha.", }) as never] }, context)?.rejectedRule).toBe("UNSUPPORTED_FINANCIAL_CLAIM");
    expect(validateGeneratedOpportunityResult({ outcome: "HYPOTHESES", ideas: [idea({ concept: "Pertumbuhan pasar naik 450% sehingga produk ini pasti banyak dicari.", }) as never] }, context)?.rejectedRule).toBe("UNSUPPORTED_FINANCIAL_CLAIM");
  });

  it("builds financial evidence gaps from metric- and subject-scoped availability", () => {
    const inventory = context.financialEvidenceAvailability.inventory;
    const eligibleCodes = context.financialEvidenceAvailability.eligibleGaps.map((item) => item.code);

    expect(inventory).toEqual(expect.arrayContaining([
      expect.objectContaining({ metric: "AVERAGE_BUSINESS_PRICE", subjectScope: "BUSINESS", status: "KNOWN", trustedSourceReference: "profile.averagePrice" }),
      expect.objectContaining({ metric: "PRODUCT_PRICE", subjectScope: "EXISTING_PRODUCT", subjectId: "profile.products[0]", status: "KNOWN", trustedSourceReference: "profile.products[0].price" }),
      expect.objectContaining({ metric: "PROPOSED_PRODUCT_PRICE", subjectScope: "PROPOSED_PRODUCT", status: "UNKNOWN" }),
      expect.objectContaining({ metric: "COMPETITOR_PRICE", subjectScope: "COMPETITOR", status: "UNKNOWN" }),
    ]));
    expect(eligibleCodes).toContain("PROPOSED_PRODUCT_PRICE_UNKNOWN");
    expect(eligibleCodes).toContain("COMPETITOR_PRICE_UNKNOWN");
    expect(eligibleCodes).toContain("COST_OF_GOODS_UNKNOWN");
    expect(eligibleCodes).toContain("CUSTOMER_WILLINGNESS_TO_PAY_UNKNOWN");
    expect(eligibleCodes).not.toContain("EXISTING_PRODUCT_PRICE_UNKNOWN");
  });

  it("keeps existing-product prices separate when only some profile products have a price", () => {
    if (profile.profile.persona !== "UMKM_EXISTING") throw new Error("Expected synthetic UMKM profile.");
    const partialProfile: BuiltOpportunityProfileContext = {
      ...profile,
      profile: {
        ...profile.profile,
        products: [
          { name: "Soto Ayam", category: "Makanan", price: 22000 },
          { name: "Es Teh", category: "Minuman", price: null },
        ],
      },
    };
    const partialContext = buildOpportunityAnalysisContext(partialProfile, evidence);
    const availability = partialContext.financialEvidenceAvailability;
    const unknownProductGapId = "gap_existing_product_price_unknown_profile.products[1]";

    expect(availability.inventory).toEqual(expect.arrayContaining([
      expect.objectContaining({ metric: "PRODUCT_PRICE", subjectScope: "PRODUCT_SET", status: "PARTIAL" }),
      expect.objectContaining({ metric: "PRODUCT_PRICE", subjectScope: "EXISTING_PRODUCT", subjectId: "profile.products[0]", status: "KNOWN" }),
      expect.objectContaining({ metric: "PRODUCT_PRICE", subjectScope: "EXISTING_PRODUCT", subjectId: "profile.products[1]", status: "UNKNOWN" }),
    ]));
    expect(availability.eligibleGaps.map((item) => item.id)).toContain(unknownProductGapId);
    expect(availability.eligibleGaps.map((item) => item.id)).not.toContain("gap_existing_product_price_unknown_profile.products[0]");
    expect(validateGeneratedOpportunityResult({
      outcome: "HYPOTHESES",
      ideas: [idea({ evidenceGapIds: [unknownProductGapId] }) as never],
    }, partialContext)).toBeNull();
  });

  it("keeps proposed price, production cost, and customer willingness gaps independent of known prices", () => {
    const validGapSets = [
      ["gap_proposed_product_price_unknown_proposal"],
      ["gap_cost_of_goods_unknown_business_products"],
      ["gap_customer_willingness_to_pay_unknown_target_customer"],
    ];

    for (const evidenceGapIds of validGapSets) {
      expect(validateGeneratedOpportunityResult({
        outcome: "HYPOTHESES",
        ideas: [idea({ evidenceGapIds }) as never],
      }, context), evidenceGapIds[0]).toBeNull();
    }
  });

  it("reports missing product and operating financial values as unknown without hiding declared average price", () => {
    if (profile.profile.persona !== "UMKM_EXISTING") throw new Error("Expected synthetic UMKM profile.");
    const noProductPriceProfile: BuiltOpportunityProfileContext = {
      ...profile,
      profile: { ...profile.profile, products: [{ name: "Soto Ayam", category: "Makanan", price: null }] },
    };
    const noProductPriceContext = buildOpportunityAnalysisContext(noProductPriceProfile, evidence);
    const inventory = noProductPriceContext.financialEvidenceAvailability.inventory;
    expect(inventory.find((item) => item.metric === "AVERAGE_BUSINESS_PRICE")?.status).toBe("KNOWN");
    expect(inventory.find((item) => item.metric === "PRODUCT_PRICE" && item.subjectScope === "PRODUCT_SET")?.status).toBe("UNKNOWN");
    expect(inventory.find((item) => item.metric === "PRODUCT_PRICE" && item.subjectScope === "EXISTING_PRODUCT")?.status).toBe("UNKNOWN");
    expect(noProductPriceContext.financialEvidenceAvailability.eligibleGaps.map((item) => item.code)).toContain("EXISTING_PRODUCT_PRICE_UNKNOWN");
    expect(inventory.filter((item) => ["PRODUCTION_COST", "OPERATING_COST", "REVENUE", "MARGIN", "SALES_VOLUME"].includes(item.metric)))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ metric: "PRODUCTION_COST", status: "UNKNOWN" }),
        expect.objectContaining({ metric: "OPERATING_COST", status: "UNKNOWN" }),
        expect.objectContaining({ metric: "REVENUE", status: "UNKNOWN" }),
        expect.objectContaining({ metric: "MARGIN", status: "UNKNOWN" }),
        expect.objectContaining({ metric: "SALES_VOLUME", status: "UNKNOWN" }),
      ]));
  });

  it.each([
    { field: "concept", value: "Uji dua varian kopi hitam." },
    { field: "validationSteps", value: "Wawancarai 10 calon pelanggan tentang pilihan kemasan." },
    { field: "validationSteps", value: "Lakukan pengujian selama 7 hari dan catat tanggapan." },
    { field: "concept", value: "Bandingkan 3 alternatif kemasan untuk produk soto." },
    { field: "validationSteps", value: "Kumpulkan data transaksi selama 30 hari dan catat hasilnya." },
    { field: "validationSteps", value: "Uji 2-3 varian kemasan bersama pelanggan yang sudah dijangkau." },
    { field: "validationSteps", value: "Uji dua sampai tiga varian kemasan bersama pelanggan yang sudah dijangkau." },
    { field: "validationSteps", value: "Langkah 1: Wawancarai 10 calon pelanggan tentang pilihan kemasan." },
  ] as const)("accepts a proposed experiment or missing-data period: $value", ({ field, value }) => {
    const result: GeneratedOpportunityResult = {
      outcome: "HYPOTHESES",
      ideas: [idea({ [field]: field === "concept" ? value : [value] }) as never],
    };
    expect(validateGeneratedOpportunityResult(result, context), value).toBeNull();
  });

  it("accepts a numeric product label only when its full identity and profile reference match", () => {
    if (profile.profile.persona !== "UMKM_EXISTING") throw new Error("Expected synthetic UMKM profile.");
    const baseProfile = profile.profile;
    const labelledProfile: BuiltOpportunityProfileContext = {
      ...profile,
      profile: {
        ...baseProfile,
        products: [{ name: "Kopi 3-in-1", category: "Minuman", price: 22000 }],
      },
    };
    const labelledContext = buildOpportunityAnalysisContext(labelledProfile, evidence);
    const validLabel = {
      outcome: "HYPOTHESES" as const,
      ideas: [idea({
        title: "Kopi 3-in-1 dengan kemasan praktis",
        concept: "Uji kemasan untuk Kopi 3-in-1 yang tercatat pada profil usaha.",
        profileReferences: ["profile.products"],
      }) as never],
    };
    const unverifiedLabel = {
      outcome: "HYPOTHESES" as const,
      ideas: [idea({
        title: "Kopi 4-in-1 dengan kemasan praktis",
        concept: "Uji kemasan untuk Kopi 4-in-1 yang tercatat pada profil usaha.",
        profileReferences: ["profile.products"],
      }) as never],
    };
    const unreferencedLabel = {
      outcome: "HYPOTHESES" as const,
      ideas: [idea({
        title: "Kopi 3-in-1 dengan kemasan praktis",
        concept: "Uji kemasan untuk Kopi 3-in-1 yang tercatat pada profil usaha.",
        profileReferences: ["profile.businessCategory"],
      }) as never],
    };

    expect(validateGeneratedOpportunityResult(validLabel, labelledContext)).toBeNull();
    expect(validateGeneratedOpportunityResult(unverifiedLabel, labelledContext)).toMatchObject({
      rejectedRule: "UNSUPPORTED_NUMBER",
      semanticCategory: "AMBIGUOUS_NUMERIC_STATEMENT",
    });
    expect(validateGeneratedOpportunityResult(unreferencedLabel, labelledContext)).toMatchObject({
      rejectedRule: "UNSUPPORTED_NUMBER",
      semanticCategory: "AMBIGUOUS_NUMERIC_STATEMENT",
    });
    const labelWithUnsupportedProfit = {
      outcome: "HYPOTHESES" as const,
      ideas: [idea({
        concept: "Uji Kopi 3-in-1 yang diproyeksikan menghasilkan laba Rp500.000.",
        profileReferences: ["profile.products"],
      }) as never],
    };
    expect(validateGeneratedOpportunityResult(labelWithUnsupportedProfit, labelledContext)?.rejectedRule)
      .toBe("UNSUPPORTED_FINANCIAL_CLAIM");
  });

  it("accepts an ordinal only when its value matches that validation step", () => {
    const outOfOrder: GeneratedOpportunityResult = {
      outcome: "HYPOTHESES",
      ideas: [idea({
        validationSteps: ["Langkah 2: Wawancarai 10 calon pelanggan tentang pilihan kemasan.", "Uji kemasan yang tersedia dan catat tanggapan langsung."],
      }) as never],
    };

    expect(validateGeneratedOpportunityResult(outOfOrder, context)).toMatchObject({
      rejectedRule: "UNSUPPORTED_NUMBER",
      numericDiagnostics: [expect.objectContaining({
        fieldPath: "ideas[0].validationSteps[0]",
        unitClassification: "ORDINAL",
        semanticCategory: "AMBIGUOUS_NUMERIC_STATEMENT",
        spanIndex: 0,
      })],
    });
  });

  it("keeps experiment parameters separate from unsupported finance and assigns a stable identity to each numeric span", () => {
    const mixed: GeneratedOpportunityResult = {
      outcome: "HYPOTHESES",
      ideas: [idea({
        validationSteps: ["Wawancarai 10 pelanggan karena omzet Rp10 juta dan laba naik 40%.", "Catat tanggapan tanpa menganggapnya sebagai penjualan."],
      }) as never],
    };
    const rejected = validateGeneratedOpportunityResult(mixed, context);

    expect(rejected).toMatchObject({
      rejectedRule: "UNSUPPORTED_FINANCIAL_CLAIM",
      semanticCategory: "UNSUPPORTED_FINANCIAL_CLAIM",
      numericDiagnostics: [
        expect.objectContaining({ fieldPath: "ideas[0].validationSteps[0]", spanIndex: 1 }),
        expect.objectContaining({ fieldPath: "ideas[0].validationSteps[0]", spanIndex: 2 }),
      ],
    });
    expect(rejected?.numericDiagnostics).toHaveLength(2);
  });

  it("keeps an unsupported empirical claim rejected when it shares a field with a valid experiment target", () => {
    const mixed: GeneratedOpportunityResult = {
      outcome: "HYPOTHESES",
      ideas: [idea({
        validationSteps: ["Wawancarai 10 pelanggan karena penjualan sudah meningkat 40%.", "Catat tanggapan tanpa menganggapnya sebagai penjualan."],
      }) as never],
    };

    expect(validateGeneratedOpportunityResult(mixed, context)).toMatchObject({
      rejectedRule: "UNSUPPORTED_FINANCIAL_CLAIM",
      fields: expect.arrayContaining(["ideas[0].validationSteps[0]"]),
      numericDiagnostics: expect.arrayContaining([expect.objectContaining({
        fieldPath: "ideas[0].validationSteps[0]",
        unitClassification: "PERCENT",
        futureAction: false,
        verifiedSourceMatch: false,
        spanIndex: 1,
      })]),
    });
  });

  it("does not let a data collection duration authorize an unsupported market count", () => {
    const mixed: GeneratedOpportunityResult = {
      outcome: "HYPOTHESES",
      ideas: [idea({
        validationSteps: ["Kumpulkan data transaksi selama 30 hari, sementara pasar memiliki 10.000 pembeli.", "Catat tanggapan tanpa menganggapnya sebagai penjualan."],
      }) as never],
    };

    expect(validateGeneratedOpportunityResult(mixed, context)).toMatchObject({
      rejectedRule: "UNSUPPORTED_METRIC_CLAIM",
      semanticCategory: "UNSUPPORTED_EMPIRICAL_CLAIM",
      numericDiagnostics: [expect.objectContaining({
        fieldPath: "ideas[0].validationSteps[0]",
        unitClassification: "COUNT",
        futureAction: false,
        spanIndex: 1,
      })],
    });
  });

  it("rejects a completed experiment count when no verified evidence supports it", () => {
    const completed: GeneratedOpportunityResult = {
      outcome: "HYPOTHESES",
      ideas: [idea({ validationSteps: ["Wawancarai 10 pelanggan sudah dilakukan bulan lalu.", "Catat evaluasi dari uji kemasan berikutnya."] }) as never],
    };

    expect(validateGeneratedOpportunityResult(completed, context)).toMatchObject({
      rejectedRule: "UNSUPPORTED_METRIC_CLAIM",
      fields: ["ideas[0].validationSteps[0]"],
      numericDiagnostics: [expect.objectContaining({ futureAction: false, verifiedSourceMatch: false })],
    });
  });

  it("rejects decimal empirical claims and ungrounded numeric predictions", () => {
    const decimalSales: GeneratedOpportunityResult = {
      outcome: "HYPOTHESES",
      ideas: [idea({ concept: "Penjualan kopi meningkat 12,5% dalam sebulan." }) as never],
    };
    const decimalRevenue: GeneratedOpportunityResult = {
      outcome: "HYPOTHESES",
      ideas: [idea({ concept: "Usaha menghasilkan omzet Rp1,5 juta setiap bulan." }) as never],
    };

    expect(validateGeneratedOpportunityResult(decimalSales, context)?.rejectedRule).toBe("UNSUPPORTED_FINANCIAL_CLAIM");
    expect(validateGeneratedOpportunityResult(decimalRevenue, context)?.rejectedRule).toBe("UNSUPPORTED_FINANCIAL_CLAIM");
  });

  it("rejects a gap reference for a known product price and unsupported financial amounts", () => {
    const knownProductPriceGap: GeneratedOpportunityResult = {
      outcome: "HYPOTHESES",
      ideas: [idea({ evidenceGapIds: ["gap_existing_product_price_unknown_profile.products[0]"] }) as never],
    };
    const inventedAmount: GeneratedOpportunityResult = {
      outcome: "HYPOTHESES",
      ideas: [idea({ assumptions: ["Margin keuntungan Rp50 juta per bulan belum terbukti."] }) as never],
    };

    expect(validateGeneratedOpportunityResult(knownProductPriceGap, context)).toMatchObject({
      rejectedRule: "INVALID_EVIDENCE_GAP_REFERENCE",
      fields: ["ideas[0].evidenceGapIds"],
    });
    expect(validateGeneratedOpportunityResult(inventedAmount, context)?.rejectedRule).toBe("UNSUPPORTED_FINANCIAL_CLAIM");
  });

  it("rejects an explicit claim that a named known product price is missing", () => {
    const claim: GeneratedOpportunityResult = {
      outcome: "HYPOTHESES",
      ideas: [idea({ assumptions: ["Harga produk Soto Ayam belum tersedia dalam profil usaha."] }) as never],
    };

    expect(validateGeneratedOpportunityResult(claim, context)).toMatchObject({
      rejectedRule: "UNSUPPORTED_FINANCIAL_CLAIM",
      fields: ["ideas[0].assumptions[0]"],
      financialMetric: "PRODUCT_PRICE",
      financialEvidenceAvailable: true,
      isMissingDataDescription: true,
      claimClassification: "PROFILE_VALUE_MISSTATED_AS_MISSING",
    });
  });

  it("accepts a competitor-price gap when only the business's own prices are known", () => {
    const competitorPriceGap: GeneratedOpportunityResult = {
      outcome: "HYPOTHESES",
      ideas: [idea({ evidenceGapIds: ["gap_competitor_price_unknown_market"] }) as never],
    };

    expect(validateGeneratedOpportunityResult(competitorPriceGap, context)).toBeNull();
  });

  it("does not report business prices as available evidence for a competitor-price claim", () => {
    const unsupportedCompetitorAmount: GeneratedOpportunityResult = {
      outcome: "HYPOTHESES",
      ideas: [idea({ concept: "Harga produk pesaing Rp24.000 belum tersedia untuk dibandingkan." }) as never],
    };

    expect(validateGeneratedOpportunityResult(unsupportedCompetitorAmount, context)).toMatchObject({
      rejectedRule: "UNSUPPORTED_FINANCIAL_CLAIM",
      financialMetric: "COMPETITOR_PRICE",
      financialEvidenceAvailable: false,
      isMissingDataDescription: true,
    });
  });

  it("keeps SearchApi Top and Rising evidence semantics separate from financial availability", () => {
    const topContext = buildOpportunityAnalysisContext(profile, {
      ...evidence,
      sourceType: "RELATED_QUERY_TOP",
      interestIndex: 62,
      growthLabel: null,
      growthPercent: null,
      isBreakout: false,
    });
    const topGap: GeneratedOpportunityResult = {
      outcome: "HYPOTHESES",
      ideas: [idea({
        evidenceGapIds: ["gap_competitor_price_unknown_market"],
        evidenceReferences: [topContext.evidence.sourceId],
      }) as never],
    };

    expect(validateGeneratedOpportunityResult(topGap, topContext)).toBeNull();
    expect(topContext.financialEvidenceAvailability).toEqual(context.financialEvidenceAvailability);
    expect(topContext.evidence.interestIndex).toBe(62);
    expect(context.evidence.growthPercent).toBe(450);
  });

  it("accepts a proposed-product price gap when only existing-product and average prices are known", () => {
    const proposedProductPriceGap: GeneratedOpportunityResult = {
      outcome: "HYPOTHESES",
      ideas: [idea({ evidenceGapIds: ["gap_proposed_product_price_unknown_proposal"] }) as never],
    };

    expect(validateGeneratedOpportunityResult(proposedProductPriceGap, context)).toBeNull();
  });

  it("accepts the declared average-price range and rejects unsupported ROI, sales forecasts, and unrelated Trends indices", () => {
    const averagePrice: GeneratedOpportunityResult = {
      outcome: "HYPOTHESES",
      ideas: [idea({
        concept: "Gunakan rentang harga rata-rata tercatat Rp18.000 sampai Rp30.000 sebagai acuan uji penawaran.",
        profileReferences: ["profile.averagePrice"],
      }) as never],
    };
    const topContext = buildOpportunityAnalysisContext(profile, {
      ...evidence,
      sourceType: "RELATED_QUERY_TOP",
      interestIndex: 23,
      growthLabel: null,
      growthPercent: null,
      isBreakout: false,
    });
    const trendAsFinance: GeneratedOpportunityResult = {
      outcome: "HYPOTHESES",
      ideas: [idea({
        concept: "Indeks minat Google Trends 23 membuktikan pendapatan akan naik Rp23 juta.",
        evidenceReferences: [topContext.evidence.sourceId],
      }) as never],
    };
    const priceAsRevenue: GeneratedOpportunityResult = {
      outcome: "HYPOTHESES",
      ideas: [idea({
        concept: "Harga jual Soto Ayam Rp22.000 menjadi acuan, tetapi omzet Rp22.000 belum didukung data penjualan.",
        profileReferences: ["profile.products[].price"],
      }) as never],
    };

    expect(validateGeneratedOpportunityResult(averagePrice, context)).toBeNull();
    expect(validateGeneratedOpportunityResult({
      outcome: "HYPOTHESES",
      ideas: [idea({ concept: "ROI bisnis ini akan mencapai 200%.", }) as never],
    }, context)?.rejectedRule).toBe("UNSUPPORTED_FINANCIAL_CLAIM");
    expect(validateGeneratedOpportunityResult({
      outcome: "HYPOTHESES",
      ideas: [idea({ concept: "Penjualan akan meningkat 30% bulan depan.", }) as never],
    }, context)?.rejectedRule).toBe("UNSUPPORTED_FINANCIAL_CLAIM");
    expect(validateGeneratedOpportunityResult(trendAsFinance, topContext)).toMatchObject({
      rejectedRule: "UNSUPPORTED_FINANCIAL_CLAIM",
      financialMetric: "REVENUE",
      financialEvidenceAvailable: false,
      sourceCategory: "RELATED_QUERY_TOP",
    });
    expect(validateGeneratedOpportunityResult(priceAsRevenue, context)).toMatchObject({
      rejectedRule: "UNSUPPORTED_FINANCIAL_CLAIM",
      financialMetric: "REVENUE",
      financialEvidenceAvailable: false,
    });
    expect(validateGeneratedOpportunityResult({
      outcome: "HYPOTHESES",
      ideas: [idea({ assumptions: ["Belum terbukti keuntungan mencapai Rp50 juta per bulan."] }) as never],
    }, context)?.rejectedRule).toBe("UNSUPPORTED_FINANCIAL_CLAIM");
  });

  it("rejects unsupported personas and forged evidence or unavailable profile references", () => {
    expect(validateGeneratedOpportunityResult({ outcome: "HYPOTHESES", ideas: [idea({ opportunityType: "BUSINESS_CONCEPT" }) as never] }, context)?.rejectedRule).toBe("PERSONA_MISMATCH");
    expect(validateGeneratedOpportunityResult({ outcome: "HYPOTHESES", ideas: [idea({ evidenceReferences: ["forged-source-id"] }) as never] }, context)?.rejectedRule).toBe("INVALID_EVIDENCE_REFERENCE");
    expect(validateGeneratedOpportunityResult({ outcome: "HYPOTHESES", ideas: [idea({ profileReferences: ["profile.experienceLevel"] }) as never] }, context)?.rejectedRule).toBe("INVALID_PROFILE_REFERENCE");
  });

  it("requires a meaningful change before an existing product can be proposed as a new menu", () => {
    const rejected = validateGeneratedOpportunityResult({
      outcome: "HYPOTHESES",
      ideas: [idea({ opportunityType: "NEW_MENU", title: "Soto Ayam baru", concept: "Soto Ayam menjadi menu baru yang menarik untuk pelanggan yang menyukai makanan hangat." }) as never],
    }, context);
    expect(rejected?.rejectedRule).toBe("EXISTING_PRODUCT_AS_NEW_MENU");

    const accepted = validateGeneratedOpportunityResult({
      outcome: "HYPOTHESES",
      ideas: [idea({ opportunityType: "NEW_MENU", title: "Soto Ayam kemasan praktis", concept: "Soto Ayam dengan kemasan praktis untuk dibawa menjadi perubahan penyajian yang dapat diuji bersama pelanggan." }) as never],
    }, context);
    expect(accepted).toBeNull();
  });

  it("supports insufficient evidence as a valid, non-persisted outcome", () => {
    const insufficient: GeneratedOpportunityResult = {
      outcome: "INSUFFICIENT_EVIDENCE",
      reason: "Kueri yang dipilih terlalu ambigu untuk menghubungkannya dengan produk atau segmen usaha ini.",
      limitations: ["Data pencarian tidak menunjukkan pembelian atau permintaan aktual."],
    };
    expect(validateGeneratedOpportunityResult(insufficient, context)).toBeNull();
  });
});

describe("generated Opportunity Finder schema contract", () => {
  it("accepts a valid HYPOTHESES outcome and rejects unsupported enum values", () => {
    const valid = generatedOpportunityResultSchema.safeParse({ outcome: "HYPOTHESES", ideas: [schemaIdea()] });
    const invalidEnum = generatedOpportunityResultSchema.safeParse({
      outcome: "HYPOTHESES",
      ideas: [schemaIdea({ opportunityType: "SIDE_HUSTLE" })],
    });

    expect(valid.success).toBe(true);
    expect(invalidEnum.success).toBe(false);
    if (!invalidEnum.success) {
      expect(invalidEnum.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: ["ideas", 0, "opportunityType"], code: "invalid_value" }),
      ]));
    }
  });

  it("rejects wrong types, nulls, omitted required fields, excessive lengths, and arrays", () => {
    const wrongType = generatedOpportunityResultSchema.safeParse({
      outcome: "HYPOTHESES",
      ideas: [schemaIdea({ targetCustomer: 12 })],
    });
    const nullValue = generatedOpportunityResultSchema.safeParse({
      outcome: "HYPOTHESES",
      ideas: [schemaIdea({ evidenceInterpretation: null })],
    });
    const omittedRequired = schemaIdea() as Record<string, unknown>;
    delete omittedRequired.evidenceReferences;
    const missingValue = generatedOpportunityResultSchema.safeParse({ outcome: "HYPOTHESES", ideas: [omittedRequired] });
    const overlongText = generatedOpportunityResultSchema.safeParse({
      outcome: "HYPOTHESES",
      ideas: [schemaIdea({ title: "x".repeat(141) })],
    });
    const overlongArray = generatedOpportunityResultSchema.safeParse({
      outcome: "HYPOTHESES",
      ideas: [schemaIdea({ validationSteps: ["Langkah pertama yang cukup panjang.", "Langkah kedua yang cukup panjang.", "Langkah tiga yang cukup panjang.", "Langkah empat yang cukup panjang.", "Langkah lima yang cukup panjang.", "Langkah enam yang cukup panjang."] })],
    });

    expect(wrongType.success).toBe(false);
    expect(nullValue.success).toBe(false);
    expect(missingValue.success).toBe(false);
    expect(overlongText.success).toBe(false);
    expect(overlongArray.success).toBe(false);
    if (!overlongText.success) expect(overlongText.error.issues[0]?.code).toBe("too_big");
    if (!overlongArray.success) expect(overlongArray.error.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ["ideas", 0, "validationSteps"], code: "too_big" }),
    ]));
  });

  it("accepts a valid insufficient-evidence outcome and rejects extra fields or a non-empty ideas field", () => {
    const valid = generatedOpportunityResultSchema.safeParse({
      outcome: "INSUFFICIENT_EVIDENCE",
      reason: "Kueri yang dipilih belum cukup terkait dengan usaha dan segmen pelanggan.",
      limitations: ["Minat pencarian tidak membuktikan pembelian aktual."],
    });
    const invalidWithIdeas = generatedOpportunityResultSchema.safeParse({
      outcome: "INSUFFICIENT_EVIDENCE",
      reason: "Kueri yang dipilih belum cukup terkait dengan usaha dan segmen pelanggan.",
      limitations: ["Minat pencarian tidak membuktikan pembelian aktual."],
      ideas: [],
    });
    const invalidExtra = generatedOpportunityResultSchema.safeParse({
      outcome: "HYPOTHESES",
      ideas: [schemaIdea({ privateExtra: "synthetic" })],
    });

    expect(valid.success).toBe(true);
    expect(invalidWithIdeas.success).toBe(false);
    expect(invalidExtra.success).toBe(false);
  });
});
