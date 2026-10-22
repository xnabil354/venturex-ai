import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildOpportunityAnalysisContext, type OpportunityAnalysisContext } from "./opportunity-analysis-context";
import { generatedOpportunityResultSchema, validateGeneratedOpportunityResult } from "./opportunity-analysis-validation";
import { privateOpportunityHypothesisSchema } from "./private-hypothesis";
import type { BuiltOpportunityProfileContext, OpportunityProfileContext } from "./opportunity-analysis-context";
import type { SearchApiOpportunityEvidence } from "./searchapi-evidence-contract";

const umkmProfile: BuiltOpportunityProfileContext & {
  profile: Extract<OpportunityProfileContext, { persona: "UMKM_EXISTING" }>;
} = {
  profile: {
    persona: "UMKM_EXISTING",
    businessName: "Kedai Kopi Uji",
    businessCategory: "Minuman",
    businessDescription: null,
    location: null,
    averagePrice: { min: 18_000, max: 30_000, currency: "IDR" },
    products: [
      { name: "Kopi Susu", category: "Minuman", price: 22_000 },
      { name: "Teh Lemon", category: "Minuman", price: null },
    ],
    customerSegments: ["Pelanggan lokal"],
    salesChannels: ["Pesan antar"],
    notes: null,
  },
  dataAvailability: {
    profileFieldsPresent: [
      "profile.businessName",
      "profile.businessCategory",
      "profile.averagePrice",
      "profile.products",
      "profile.products[].price",
      "profile.customerSegments",
      "profile.salesChannels",
    ],
    profileFieldsMissing: [],
  },
};

const evidence: SearchApiOpportunityEvidence = {
  sourceType: "RELATED_QUERY_TOP",
  productQuery: "kopi",
  query: "kopi susu",
  position: 1,
  interestIndex: 40,
  growthLabel: null,
  growthPercent: null,
  isBreakout: false,
  geo: "ID",
  period: "24 jam terakhir",
  providerTime: "now 1-d",
  searchProperty: "web",
  retrievedAt: "2026-10-18T04:00:00.000Z",
  expiresAt: "2026-10-18T04:05:00.000Z",
  publisher: "Google Trends",
  provider: "SearchApi.io",
  url: "https://trends.google.com/trends/explore?geo=ID&date=now+1-d&q=kopi",
  providerSourceUrl: null,
};

function contextFor(profile: BuiltOpportunityProfileContext = umkmProfile) {
  return buildOpportunityAnalysisContext(profile, evidence);
}

function ideaFor(
  context: OpportunityAnalysisContext,
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    title: "Uji kemasan kopi praktis",
    opportunityType: context.profile.persona === "ENTREPRENEUR" ? "BUSINESS_CONCEPT" : "NEW_VARIANT",
    concept: "Uji perubahan kemasan kopi yang praktis untuk dibawa pelanggan.",
    targetCustomer: "Pelanggan lokal yang mencari minuman praktis.",
    validationSteps: ["Tanyakan preferensi kemasan kepada pelanggan.", "Catat respons saat uji penawaran langsung."],
    assumptions: ["Minat pencarian belum membuktikan pembelian."],
    profileAlignment: [{
      rationale: "Selaras dengan segmen pelanggan yang tercatat.",
      supportingProfileRefs: ["profile.customerSegments"],
    }],
    profileReferences: ["profile.customerSegments"],
    evidenceInterpretation: "Minat pencarian terkait kopi tidak membuktikan pembelian.",
    evidenceReferences: [context.evidence.sourceId],
    evidenceGapIds: ["gap_customer_validation_required_target_customer"],
    limitations: ["Google Trends tidak mengukur pembelian atau keuntungan."],
    ...overrides,
  };
}

function outputFor(context: OpportunityAnalysisContext, overrides: Readonly<Record<string, unknown>> = {}) {
  return generatedOpportunityResultSchema.parse({
    outcome: "HYPOTHESES",
    ideas: [ideaFor(context, overrides)],
  });
}

function issuedRef(context: OpportunityAnalysisContext, id: string) {
  const reference = context.profileReferenceCatalog.find((item) => item.id === id);
  if (!reference) throw new Error("Expected synthetic server-issued profile reference.");
  return reference.id;
}

function generatedIdea(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    title: "Uji kemasan kopi praktis",
    opportunityType: "NEW_VARIANT",
    concept: "Uji perubahan kemasan kopi yang praktis untuk dibawa pelanggan.",
    targetCustomer: "Pelanggan lokal yang mencari minuman praktis.",
    validationSteps: ["Tanyakan preferensi kemasan kepada pelanggan.", "Catat respons saat uji penawaran langsung."],
    assumptions: ["Minat pencarian belum membuktikan pembelian."],
    profileAlignment: [{
      rationale: "Harga rata-rata tercatat dan produk Kopi Susu memiliki harga profil yang dapat dijadikan konteks.",
      supportingProfileRefs: ["profile-ref-average", "profile-ref-product-0"],
    }],
    profileReferences: ["profile.averagePrice", "profile.products[].price"],
    evidenceInterpretation: "Minat pencarian terkait kopi tidak membuktikan pembelian.",
    evidenceReferences: ["searchapi_synthetic_source"],
    evidenceGapIds: ["gap_customer_validation_required_target_customer"],
    limitations: ["Google Trends tidak mengukur pembelian atau keuntungan."],
    ...overrides,
  };
}

describe("Profile alignment grounding contract", () => {
  it("accepts structured profile-alignment rationales with per-statement server references", () => {
    const result = generatedOpportunityResultSchema.safeParse({
      outcome: "HYPOTHESES",
      ideas: [generatedIdea()],
    });

    expect(result.success).toBe(true);
  });

  it("issues subject-specific financial references only for populated authenticated profile fields", () => {
    const context = contextFor();

    expect(context.profileReferenceCatalog).toEqual(expect.arrayContaining([
      expect.objectContaining({ profileField: "profile.averagePrice", metric: "AVERAGE_BUSINESS_PRICE", subjectCategory: "BUSINESS" }),
      expect.objectContaining({ profileField: "profile.products[].price", metric: "PRODUCT_PRICE", subjectCategory: "EXISTING_PRODUCT", subjectId: "profile.products[0]" }),
    ]));
    expect(context.profileReferenceCatalog.some((reference) => reference.subjectId === "profile.products[1]")).toBe(false);
    expect(new Set(context.profileReferenceCatalog.map((reference) => reference.id)).size).toBe(context.profileReferenceCatalog.length);
  });

  it("accepts a verified product price and reports availability, subject, and reference separately", () => {
    const context = contextFor();
    const result = validateGeneratedOpportunityResult(outputFor(context, {
      profileAlignment: [{
        rationale: "Produk Kopi Susu tercatat dengan harga Rp22.000.",
        supportingProfileRefs: [issuedRef(context, "profile.products[0].price")],
      }],
      profileReferences: ["profile.products[].price"],
    }), context);

    expect(result).toBeNull();
  });

  it("rejects an invented price even when the model cites the correct product source", () => {
    const context = contextFor();
    const result = validateGeneratedOpportunityResult(outputFor(context, {
      profileAlignment: [{
        rationale: "Produk Kopi Susu tercatat dengan harga Rp25.000.",
        supportingProfileRefs: [issuedRef(context, "profile.products[0].price")],
      }],
      profileReferences: ["profile.products[].price"],
    }), context);

    expect(result).toMatchObject({
      rejectedRule: "UNSUPPORTED_FINANCIAL_CLAIM",
      fields: ["ideas[0].profileAlignment[0]"],
      numericDiagnostics: [expect.objectContaining({
        expectedMetricCategory: "PROFILE_PRODUCT_PRICE",
        verifiedSourceMatch: false,
        unitClassification: "PROFILE_AMOUNT",
        subjectCategory: "EXISTING_PRODUCT",
        expectedSourceFieldExists: true,
        matchingSourceReferenceExists: true,
        validationResult: "REJECTED_NO_MATCHING_PROFILE_SOURCE",
      })],
    });
  });

  it("rejects a product price source reference for the wrong named product", () => {
    const profileWithTwoPrices: BuiltOpportunityProfileContext = {
      ...umkmProfile,
      profile: {
        ...umkmProfile.profile,
        products: [
          { name: "Kopi Susu", category: "Minuman", price: 22_000 },
          { name: "Teh Lemon", category: "Minuman", price: 8_000 },
        ],
      },
    };
    const context = contextFor(profileWithTwoPrices);
    const result = validateGeneratedOpportunityResult(outputFor(context, {
      profileAlignment: [{
        rationale: "Produk Kopi Susu tercatat dengan harga Rp8.000.",
        supportingProfileRefs: [issuedRef(context, "profile.products[1].price")],
      }],
      profileReferences: ["profile.products[].price"],
    }), context);

    expect(result).toMatchObject({ rejectedRule: "UNSUPPORTED_FINANCIAL_CLAIM", fields: ["ideas[0].profileAlignment[0]"] });
    expect(result?.numericDiagnostics?.[0]).toMatchObject({
      subjectCategory: "EXISTING_PRODUCT",
      expectedSourceFieldExists: true,
      matchingSourceReferenceExists: false,
      verifiedSourceMatch: false,
    });
  });

  it("rejects a claimed price when an UMKM has no populated product prices", () => {
    const unpricedProfile: BuiltOpportunityProfileContext = {
      ...umkmProfile,
      profile: {
        ...umkmProfile.profile,
        products: umkmProfile.profile.products.map((product) => ({ ...product, price: null })),
      },
      dataAvailability: {
        ...umkmProfile.dataAvailability,
        profileFieldsPresent: umkmProfile.dataAvailability.profileFieldsPresent.filter((field) => field !== "profile.products[].price"),
      },
    };
    const context = contextFor(unpricedProfile);
    const result = validateGeneratedOpportunityResult(outputFor(context, {
      profileAlignment: [{
        rationale: "Produk Kopi Susu tercatat dengan harga Rp22.000.",
        supportingProfileRefs: ["profile.products[0].price"],
      }],
      profileReferences: ["profile.products[].price"],
    }), context);

    expect(context.profileReferenceCatalog.some((reference) => reference.metric === "PRODUCT_PRICE")).toBe(false);
    expect(result).toMatchObject({ rejectedRule: "UNSUPPORTED_FINANCIAL_CLAIM" });
    expect(result?.numericDiagnostics?.[0]).toMatchObject({
      expectedSourceFieldExists: false,
      matchingSourceReferenceExists: false,
      verifiedSourceMatch: false,
    });
  });

  it("distinguishes a value in the profile projection from a missing availability declaration", () => {
    const incompleteAvailability: BuiltOpportunityProfileContext = {
      ...umkmProfile,
      dataAvailability: {
        ...umkmProfile.dataAvailability,
        profileFieldsPresent: umkmProfile.dataAvailability.profileFieldsPresent.filter((field) => field !== "profile.averagePrice"),
        profileFieldsMissing: [...umkmProfile.dataAvailability.profileFieldsMissing, "profile.averagePrice"],
      },
    };
    const context = contextFor(incompleteAvailability);
    const result = validateGeneratedOpportunityResult(outputFor(context, {
      profileAlignment: [{
        rationale: "Harga rata-rata usaha tercatat Rp18.000.",
        supportingProfileRefs: ["profile.averagePrice"],
      }],
      profileReferences: ["profile.averagePrice"],
    }), context);

    expect(result).toMatchObject({
      rejectedRule: "UNSUPPORTED_FINANCIAL_CLAIM",
      financialMetric: "AVERAGE_BUSINESS_PRICE",
      financialEvidenceAvailable: true,
    });
    expect(result?.numericDiagnostics?.[0]).toMatchObject({
      expectedSourceFieldExists: false,
      matchingSourceReferenceExists: false,
      verifiedSourceMatch: false,
    });
  });

  it("does not use an average business price as the price of a proposed product", () => {
    const context = contextFor();
    const result = validateGeneratedOpportunityResult(outputFor(context, {
      profileAlignment: [{
        rationale: "Harga produk usulan tercatat Rp24.000 sesuai rata-rata usaha.",
        supportingProfileRefs: [issuedRef(context, "profile.averagePrice")],
      }],
      profileReferences: ["profile.averagePrice"],
    }), context);

    expect(result).toMatchObject({ rejectedRule: "UNSUPPORTED_FINANCIAL_CLAIM", financialMetric: "PROPOSED_PRODUCT_PRICE", financialEvidenceAvailable: false });
  });

  it("grounds multiple financial values to their own metrics in one alignment statement", () => {
    const context = contextFor();
    const result = validateGeneratedOpportunityResult(outputFor(context, {
      profileAlignment: [{
        rationale: "Rentang harga rata-rata usaha Rp18.000 sampai Rp30.000. Harga Kopi Susu tercatat Rp22.000.",
        supportingProfileRefs: [
          issuedRef(context, "profile.averagePrice"),
          issuedRef(context, "profile.products[0].price"),
        ],
      }],
      profileReferences: ["profile.averagePrice", "profile.products[].price"],
    }), context);

    expect(result).toBeNull();
  });

  it("allows a prospective price experiment in validation steps without treating it as a profile fact", () => {
    const context = contextFor();
    const result = validateGeneratedOpportunityResult(outputFor(context, {
      validationSteps: ["Uji rentang harga Rp20.000 sampai Rp24.000 bersama pelanggan.", "Catat respons pelanggan sebelum memilih harga."],
      profileReferences: ["profile.customerSegments"],
    }), context);

    expect(result).toBeNull();
  });

  it("does not accept profile references copied from another user's different product projection", () => {
    const otherUserProfile: BuiltOpportunityProfileContext = {
      ...umkmProfile,
      profile: {
        ...umkmProfile.profile,
        products: [{ name: "Teh Lemon", category: "Minuman", price: 5_000 }],
      },
    };
    const otherUserContext = contextFor(otherUserProfile);
    const copiedReference = "profile.products[0].price";
    const result = validateGeneratedOpportunityResult(outputFor(otherUserContext, {
      profileAlignment: [{
        rationale: "Produk Kopi Susu tercatat dengan harga Rp22.000.",
        supportingProfileRefs: [copiedReference],
      }],
      profileReferences: ["profile.products[].price"],
    }), otherUserContext);

    expect(result).toMatchObject({ rejectedRule: "UNSUPPORTED_FINANCIAL_CLAIM" });
    expect(result?.numericDiagnostics?.[0]?.verifiedSourceMatch).toBe(false);
  });

  it("preserves the legacy stored hypothesis shape for historical rows", () => {
    const historical = privateOpportunityHypothesisSchema.safeParse({
      title: "Menu kopi praktis",
      concept: "Uji kemasan kopi yang praktis bersama pelanggan sebelum diluncurkan.",
      targetCustomer: "Pelanggan lokal yang mencari minuman praktis.",
      validationSteps: ["Tanyakan preferensi pelanggan.", "Catat tanggapan uji produk."],
      assumptions: ["Pelanggan mungkin tertarik pada kemasan praktis."],
      profileAlignment: ["Selaras dengan profil pelanggan yang tersimpan."],
      profileReferences: ["profile.customerSegments"],
      evidenceInterpretation: "Kueri menunjukkan minat pencarian, bukan pembelian.",
      evidenceReferences: ["searchapi_historical_reference"],
      evidenceGaps: ["Harga pesaing belum diverifikasi."],
      limitations: ["Tren pencarian tidak mengukur transaksi."],
    });

    expect(historical.success).toBe(true);
  });

  it("keeps entrepreneur declared capital budget distinct from UMKM prices", () => {
    const entrepreneur: BuiltOpportunityProfileContext = {
      profile: {
        persona: "ENTREPRENEUR",
        preferredProductType: "Kopi",
        categories: ["Minuman"],
        customerSegments: ["Pekerja sekitar"],
        salesChannels: ["Pesan antar"],
        budget: { min: 2_000_000, max: 5_000_000, currency: "IDR" },
        location: null,
        experienceLevel: "BEGINNER",
        timeCommitment: "PART_TIME",
        businessObjective: "Mencoba usaha minuman.",
        notes: null,
      },
      dataAvailability: {
        profileFieldsPresent: ["profile.preferredProductType", "profile.categories", "profile.customerSegments", "profile.salesChannels", "profile.budget", "profile.experienceLevel", "profile.timeCommitment", "profile.businessObjective"],
        profileFieldsMissing: ["profile.location", "profile.notes"],
      },
    };
    const context = contextFor(entrepreneur);
    const result = validateGeneratedOpportunityResult(outputFor(context, {
      profileAlignment: [{
        rationale: "Modal yang dinyatakan mulai dari Rp2.000.000 untuk usaha kopi.",
        supportingProfileRefs: [issuedRef(context, "profile.budget")],
      }],
      profileReferences: ["profile.budget", "profile.preferredProductType"],
    }), context);

    expect(result).toBeNull();
    expect(context.financialEvidenceAvailability.inventory.some((item) => item.metric === "AVERAGE_BUSINESS_PRICE")).toBe(false);
  });
});
