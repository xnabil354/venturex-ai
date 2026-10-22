import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildOpportunityAnalysisContext, type BuiltOpportunityProfileContext, type OpportunityProfileField } from "./opportunity-analysis-context";
import { materializeHybridOpportunityResult } from "./hybrid-opportunity-analysis";
import { userIdSchema } from "../auth/user-types";
import {
  buildOpportunityFactCatalog,
  createOpportunityFactReference,
  OpportunityFactCatalogError,
  opportunityFactSchema,
  proposedExperimentParameterSchema,
  resolveOpportunityEvidenceGaps,
  resolveOpportunityFactReferences,
} from "./opportunity-fact-catalog";
import { searchApiOpportunityEvidenceSchema, type SearchApiOpportunityEvidence } from "./searchapi-evidence-contract";

const OWNER_A = userIdSchema.parse("80000000-0000-4000-8000-000000000011");
const OWNER_B = userIdSchema.parse("80000000-0000-4000-8000-000000000012");

const entrepreneurProfile: BuiltOpportunityProfileContext = {
  profile: {
    persona: "ENTREPRENEUR", preferredProductType: "Kopi susu", categories: ["Minuman"],
    customerSegments: ["Pelanggan lokal"], salesChannels: ["Pesan antar"],
    budget: { min: 0, max: 2500000, currency: "IDR" }, location: null,
    experienceLevel: "BEGINNER", timeCommitment: "PART_TIME", businessObjective: null, notes: null,
  },
  dataAvailability: {
    profileFieldsPresent: ["profile.preferredProductType", "profile.categories", "profile.customerSegments", "profile.salesChannels", "profile.budget", "profile.experienceLevel", "profile.timeCommitment"],
    profileFieldsMissing: ["profile.location", "profile.businessObjective", "profile.notes"],
  },
};

const umkmProfile: BuiltOpportunityProfileContext = {
  profile: {
    persona: "UMKM_EXISTING", businessName: "Kedai Sintetis", businessCategory: "Minuman",
    businessDescription: "Usaha contoh untuk pengujian.", location: { text: "Bandung", city: "Bandung", province: "Jawa Barat" },
    averagePrice: { min: 10000, max: 25000, currency: "IDR" },
    products: [
      { name: "Kopi susu", category: "Minuman", price: 18000 },
      { name: "Teh lemon", category: null, price: null },
      { name: "Air mineral", category: "Minuman", price: 0 },
    ],
    customerSegments: ["Pelanggan lokal"], salesChannels: ["Pesan antar"], notes: null,
  },
  dataAvailability: {
    profileFieldsPresent: ["profile.businessName", "profile.businessCategory", "profile.businessDescription", "profile.location", "profile.averagePrice", "profile.products", "profile.products[].category", "profile.products[].price", "profile.customerSegments", "profile.salesChannels"],
    profileFieldsMissing: ["profile.notes"],
  },
};

function evidence(overrides: Partial<SearchApiOpportunityEvidence> = {}): SearchApiOpportunityEvidence {
  return {
    sourceType: "RELATED_QUERY_TOP", productQuery: "Kopi", query: "kopi susu", position: 1,
    interestIndex: 100, growthLabel: null, growthPercent: null, isBreakout: false,
    geo: "ID", period: "24 jam terakhir", providerTime: "now 1-d", searchProperty: "web",
    retrievedAt: "2026-10-19T00:00:00.000Z", expiresAt: "2026-10-19T00:05:00.000Z",
    publisher: "Google Trends", provider: "SearchApi.io",
    url: "https://trends.google.com/trends/explore?geo=ID&q=kopi", providerSourceUrl: null,
    ...overrides,
  };
}

function catalogFor(
  profile: BuiltOpportunityProfileContext = entrepreneurProfile,
  items: readonly SearchApiOpportunityEvidence[] = [evidence()],
  ownerId = OWNER_A,
) {
  return buildOpportunityFactCatalog({ ownerId, profile, evidence: items });
}

describe("server-owned opportunity fact catalog", () => {
  it("rejects a different geographic code even when the display label is unchanged", () => {
    const selected = evidence();
    const catalog = catalogFor(entrepreneurProfile, [selected]);
    const context = buildOpportunityAnalysisContext(entrepreneurProfile, selected);
    const mismatched = { ...context, evidence: { ...context.evidence, geographicCode: "US" } };

    expect(() => materializeHybridOpportunityResult({
      outcome: "INSUFFICIENT_EVIDENCE",
      evidenceGapRefs: [{ catalogId: catalog.id, gapId: catalog.eligibleGaps[0]!.id }],
    }, catalog, mismatched, OWNER_A, new Date(selected.retrievedAt)))
      .toThrowError(expect.objectContaining({ code: "FACT_REFERENCE_MISMATCH" }));
  });

  it("builds Entrepreneur facts with declared IDR budget units and no exposed owner identifier", () => {
    const catalog = catalogFor(entrepreneurProfile, [], OWNER_A);
    const budget = catalog.facts.find((fact) => fact.metric === "BUDGET_RANGE");

    expect(catalog.persona).toBe("ENTREPRENEUR");
    expect(budget).toMatchObject({ value: { min: 0, max: 2500000 }, unit: "IDR_RANGE", sourceType: "PROFILE", availability: "KNOWN" });
    expect(JSON.stringify(catalog)).not.toContain(OWNER_A);
  });

  it.each([
    { experienceLevel: null, timeCommitment: "PART_TIME", unavailableFields: ["profile.experienceLevel"] },
    { experienceLevel: "BEGINNER", timeCommitment: null, unavailableFields: ["profile.timeCommitment"] },
    { experienceLevel: null, timeCommitment: null, unavailableFields: ["profile.experienceLevel", "profile.timeCommitment"] },
  ] as const)("treats nullable entrepreneur fields as unavailable when null", ({ experienceLevel, timeCommitment, unavailableFields }) => {
    const missingFields = new Set<OpportunityProfileField>(unavailableFields);
    const profile: BuiltOpportunityProfileContext = {
      profile: {
        ...(entrepreneurProfile.profile as Extract<BuiltOpportunityProfileContext["profile"], { persona: "ENTREPRENEUR" }>),
        experienceLevel,
        timeCommitment,
      },
      dataAvailability: {
        profileFieldsPresent: entrepreneurProfile.dataAvailability.profileFieldsPresent.filter((field) => !missingFields.has(field)),
        profileFieldsMissing: [...entrepreneurProfile.dataAvailability.profileFieldsMissing, ...unavailableFields],
      },
    };

    const catalog = catalogFor(profile, []);

    for (const field of unavailableFields) {
      expect(catalog.sources.some((source) => source.sourceType === "PROFILE" && source.profileField === field)).toBe(false);
      expect(catalog.availability.find((item) => item.domain === "PROFILE" && item.subjectId === field))
        .toMatchObject({ status: "UNKNOWN", sourceRef: null, reason: "NOT_PROVIDED" });
    }
  });

  it("keeps average business price separate from product prices and preserves partial, subject-specific values", () => {
    const catalog = catalogFor(umkmProfile, []);
    const productPrices = catalog.facts.filter((fact) => fact.metric === "PRODUCT_PRICE");
    const knownPriceSource = catalog.sources.find((source) => source.id === productPrices[0]?.sourceRef);
    const productAvailability = catalog.availability.filter((item) => item.domain === "FINANCIAL" && item.metric === "PRODUCT_PRICE");
    const productGaps = catalog.eligibleGaps.filter((gap) => gap.code === "EXISTING_PRODUCT_PRICE_UNKNOWN");

    expect(catalog.facts.find((fact) => fact.metric === "AVERAGE_BUSINESS_PRICE"))
      .toMatchObject({ subject: { kind: "BUSINESS", id: "business" }, value: { min: 10000, max: 25000 }, unit: "IDR_RANGE" });
    expect(productPrices.map((fact) => [fact.subject.id, fact.value])).toEqual([
      ["profile.products[0]", 18000], ["profile.products[2]", 0],
    ]);
    expect(knownPriceSource).toMatchObject({ sourceType: "PROFILE", profileField: "profile.products[].price", subjectId: "profile.products[0]" });
    expect(productAvailability.find((item) => item.subjectId === "profile.products")?.status).toBe("PARTIAL");
    expect(productAvailability.find((item) => item.subjectId === "profile.products[0]")?.status).toBe("KNOWN");
    expect(productAvailability.find((item) => item.subjectId === "profile.products[1]")?.status).toBe("UNKNOWN");
    expect(productGaps.map((gap) => gap.subjectId)).toEqual(["profile.products[1]"]);
    expect(catalog.eligibleGaps.some((gap) => gap.code === "PROPOSED_PRODUCT_PRICE_UNKNOWN" && gap.subjectId === "proposal")).toBe(true);
    expect(catalog.facts.some((fact) => fact.subject.label === "Teh lemon" && fact.metric === "PRODUCT_PRICE")).toBe(false);
  });

  it("represents Top query text, position, provenance, and valid 0-100 interest index", () => {
    const catalog = catalogFor(entrepreneurProfile, [evidence({ interestIndex: 0 })]);
    const interest = catalog.facts.find((fact) => fact.metric === "RELATED_QUERY_INTEREST_INDEX");
    const source = catalog.sources.find((item) => item.sourceType === "SEARCHAPI");

    expect(interest).toMatchObject({ value: 0, unit: "RELATIVE_INDEX_0_100", subject: { kind: "QUERY", label: "kopi susu" } });
    expect(source).toMatchObject({ query: "kopi susu", parentQuery: "Kopi", position: 1, geography: "ID", property: "web", provider: "SearchApi.io" });
    expect(catalogFor(entrepreneurProfile, [evidence({ interestIndex: 100 })]).facts.some((fact) => fact.value === 100)).toBe(true);
  });

  it("enforces the Top 0-100 typed boundary without changing SearchApi ingestion validation", () => {
    const outOfRange = evidence({ interestIndex: 100.5 });
    expect(searchApiOpportunityEvidenceSchema.safeParse(outOfRange).success).toBe(true);
    expect(() => catalogFor(entrepreneurProfile, [outOfRange])).toThrowError(
      expect.objectContaining({ code: "INVALID_TOP_INDEX" }),
    );
    expect(searchApiOpportunityEvidenceSchema.safeParse(evidence({ interestIndex: -0.1 })).success).toBe(false);
  });

  it("rejects profile availability claims that conflict with the validated projection", () => {
    const inconsistent = {
      ...entrepreneurProfile,
      profile: { ...entrepreneurProfile.profile, businessObjective: "Menguji produk baru." },
    } as BuiltOpportunityProfileContext;
    expect(() => catalogFor(inconsistent, [])).toThrowError(expect.objectContaining({ code: "INVALID_INPUT" }));
  });

  it("preserves Rising percentages and keeps Breakout categorical without manufacturing a percentage", () => {
    const rising = evidence({ sourceType: "RELATED_QUERY_RISING", interestIndex: null, growthLabel: "+450%", growthPercent: 450, query: "kopi naik" });
    const breakout = evidence({ sourceType: "RELATED_QUERY_RISING", interestIndex: null, growthLabel: "Breakout", growthPercent: null, isBreakout: true, query: "kopi breakout" });
    const catalog = catalogFor(entrepreneurProfile, [rising, breakout]);
    const risingFact = catalog.facts.find((fact) => fact.metric === "RELATED_QUERY_GROWTH_PERCENT");
    const breakoutFact = catalog.facts.find((fact) => fact.metric === "RELATED_QUERY_BREAKOUT");
    const breakoutAvailability = catalog.availability.find((item) => item.domain === "SEARCHAPI" && item.metric === "RELATED_QUERY_GROWTH_PERCENT" && item.subjectId.includes("kopi breakout"));

    expect(risingFact).toMatchObject({ value: 450, unit: "PERCENT", subject: { label: "kopi naik" } });
    expect(breakoutFact).toMatchObject({ value: "Breakout", unit: "SOURCE_LABEL", subject: { label: "kopi breakout" } });
    expect(catalog.facts.some((fact) => fact.subject.label === "kopi breakout" && fact.metric === "RELATED_QUERY_GROWTH_PERCENT")).toBe(false);
    expect(breakoutAvailability).toMatchObject({ status: "UNKNOWN", reason: "BREAKOUT_LABEL_ONLY" });
    expect(catalog.facts.some((fact) => ["SALES", "REVENUE", "CUSTOMERS", "CONVERSION_RATE", "CONFIRMED_DEMAND"].includes(fact.metric))).toBe(false);
    expect(() => catalogFor(entrepreneurProfile, [evidence({ sourceType: "RELATED_QUERY_RISING", interestIndex: null, growthLabel: "Breakout", growthPercent: null, isBreakout: false })])).toThrowError(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
  });

  it("distinguishes null SearchApi interest from numeric zero and rejects invalid fact units or values", () => {
    const catalog = catalogFor(entrepreneurProfile, [evidence({ interestIndex: null })]);
    const interestAvailability = catalog.availability.find((item) => item.domain === "SEARCHAPI" && item.metric === "RELATED_QUERY_INTEREST_INDEX");
    const invalidIndex = opportunityFactSchema.safeParse({
      id: "fact_0123456789abcdef01234567", sourceType: "SEARCHAPI", metric: "RELATED_QUERY_INTEREST_INDEX",
      subject: { kind: "QUERY", id: "q1", label: "kopi" }, value: 100.1, unit: "RELATIVE_INDEX_0_100", availability: "KNOWN", sourceRef: "src_0123456789abcdef01234567",
    });

    expect(catalog.facts.some((fact) => fact.metric === "RELATED_QUERY_INTEREST_INDEX")).toBe(false);
    expect(interestAvailability).toMatchObject({ status: "UNKNOWN", reason: "NOT_PROVIDED" });
    expect(invalidIndex.success).toBe(false);
    expect(() => catalogFor({ ...umkmProfile, profile: { ...umkmProfile.profile, averagePrice: { min: 30000, max: 10000, currency: "IDR" } } as BuiltOpportunityProfileContext["profile"] }, [])).toThrowError(OpportunityFactCatalogError);
  });

  it("resolves only catalog-issued references and rejects unknown, duplicate, cross-owner, stale, and mismatched refs", () => {
    const item = evidence();
    const catalogA = catalogFor(entrepreneurProfile, [item], OWNER_A);
    const catalogB = catalogFor(entrepreneurProfile, [item], OWNER_B);
    const fact = catalogA.facts.find((candidate) => candidate.metric === "RELATED_QUERY_INTEREST_INDEX");
    expect(fact).toBeDefined();
    const ref = createOpportunityFactReference(catalogA, fact!.id);
    const resolve = (references: readonly { catalogId: string; factId: string }[], options = {}) => resolveOpportunityFactReferences(catalogA, references, { ownerId: OWNER_A, ...options });

    expect(resolve([ref])).toEqual([fact]);
    expect(() => resolve([{ catalogId: catalogA.id, factId: "fact_ffffffffffffffffffffffff" }])).toThrowError(expect.objectContaining({ code: "INVALID_REFERENCE" }));
    expect(() => resolve([ref, ref])).toThrowError(expect.objectContaining({ code: "DUPLICATE_REFERENCE" }));
    expect(() => resolve([ref], { ownerId: OWNER_B })).toThrowError(expect.objectContaining({ code: "CROSS_CONTEXT_REFERENCE" }));
    expect(() => resolveOpportunityFactReferences(catalogB, [ref], { ownerId: OWNER_B })).toThrowError(expect.objectContaining({ code: "CROSS_CONTEXT_REFERENCE" }));
    expect(() => resolve([ref], { requireFresh: true, now: new Date("2026-10-19T00:05:00.000Z") })).toThrowError(expect.objectContaining({ code: "STALE_REFERENCE" }));
    expect(() => resolve([ref], { expected: { metric: "PRODUCT_PRICE" } })).toThrowError(expect.objectContaining({ code: "REFERENCE_MISMATCH" }));
    expect(() => resolve([ref], { expected: { unit: "IDR" } })).toThrowError(expect.objectContaining({ code: "REFERENCE_MISMATCH" }));
    expect(() => resolve([ref], { expected: { subjectKind: "BUSINESS" } })).toThrowError(expect.objectContaining({ code: "REFERENCE_MISMATCH" }));
    expect(() => resolve([ref], { expected: { subjectId: "unrelated-query" } })).toThrowError(expect.objectContaining({ code: "REFERENCE_MISMATCH" }));
  });

  it("resolves only eligible server-issued evidence gaps for the matching owner and subject", () => {
    const catalog = catalogFor(umkmProfile, [], OWNER_A);
    const missingPrice = catalog.eligibleGaps.find((gap) => gap.code === "EXISTING_PRODUCT_PRICE_UNKNOWN");
    expect(missingPrice).toBeDefined();
    expect(resolveOpportunityEvidenceGaps(catalog, [missingPrice!.id], { ownerId: OWNER_A, expected: { subjectId: "profile.products[1]" } })).toEqual([missingPrice]);
    expect(() => resolveOpportunityEvidenceGaps(catalog, ["unissued-gap"], { ownerId: OWNER_A })).toThrowError(expect.objectContaining({ code: "INVALID_REFERENCE" }));
    expect(() => resolveOpportunityEvidenceGaps(catalog, [missingPrice!.id, missingPrice!.id], { ownerId: OWNER_A })).toThrowError(expect.objectContaining({ code: "DUPLICATE_REFERENCE" }));
    expect(() => resolveOpportunityEvidenceGaps(catalog, [missingPrice!.id], { ownerId: OWNER_B })).toThrowError(expect.objectContaining({ code: "CROSS_CONTEXT_REFERENCE" }));
    expect(() => resolveOpportunityEvidenceGaps(catalog, [missingPrice!.id], { ownerId: OWNER_A, expected: { subjectScope: "BUSINESS" } })).toThrowError(expect.objectContaining({ code: "REFERENCE_MISMATCH" }));
  });

  it("keeps experiment parameters prospective, positive, and unit-checked", () => {
    expect(proposedExperimentParameterSchema.safeParse({ status: "PROPOSED", kind: "INTERVIEW_COUNT", value: 10, unit: "PEOPLE", sourceRef: null }).success).toBe(true);
    expect(proposedExperimentParameterSchema.safeParse({ status: "PROPOSED", kind: "DURATION", value: 7, unit: "DAYS", sourceRef: null }).success).toBe(true);
    expect(proposedExperimentParameterSchema.safeParse({ status: "PROPOSED", kind: "PRICE_TEST", min: 15000, max: 25000, unit: "IDR", sourceRef: null }).success).toBe(true);
    expect(proposedExperimentParameterSchema.safeParse({ status: "OBSERVED", kind: "INTERVIEW_COUNT", value: 10, unit: "PEOPLE", sourceRef: null }).success).toBe(false);
    expect(proposedExperimentParameterSchema.safeParse({ status: "PROPOSED", kind: "SAMPLE_SIZE", value: 0, unit: "PEOPLE", sourceRef: null }).success).toBe(false);
    expect(proposedExperimentParameterSchema.safeParse({ status: "PROPOSED", kind: "DURATION", value: 7, unit: "PEOPLE", sourceRef: null }).success).toBe(false);
    expect(proposedExperimentParameterSchema.safeParse({ status: "PROPOSED", kind: "PRICE_TEST", min: 25000, max: 15000, unit: "IDR", sourceRef: null }).success).toBe(false);
    expect(proposedExperimentParameterSchema.safeParse({ status: "PROPOSED", kind: "SAMPLE_SIZE", value: Number.MAX_SAFE_INTEGER + 1, unit: "PEOPLE", sourceRef: null }).success).toBe(false);
    expect(proposedExperimentParameterSchema.safeParse({ status: "PROPOSED", kind: "PRICE_TEST", min: 1, max: Number.MAX_SAFE_INTEGER + 1, unit: "IDR", sourceRef: null }).success).toBe(false);
  });

  it("is deterministic, does not mutate inputs, and survives JSON serialization", () => {
    const sourceProfile = structuredClone(umkmProfile);
    const sourceEvidence = [evidence({ sourceType: "RELATED_QUERY_RISING", interestIndex: null, growthLabel: "Breakout", growthPercent: null, isBreakout: true })];
    const snapshot = structuredClone({ sourceProfile, sourceEvidence });
    const first = catalogFor(sourceProfile, sourceEvidence, OWNER_A);
    const second = catalogFor(sourceProfile, sourceEvidence, OWNER_A);
    const roundTrip = JSON.parse(JSON.stringify(first)) as unknown;

    expect(first).toEqual(second);
    expect({ sourceProfile, sourceEvidence }).toEqual(snapshot);
    expect(JSON.stringify(first)).not.toContain("sourceToken");
    expect(() => JSON.stringify(first)).not.toThrow();
    expect(() => resolveOpportunityFactReferences(first, [], { ownerId: OWNER_A })).not.toThrow();
    expect(roundTrip).toEqual(first);
  });

  it("rejects duplicate evidence identities instead of ambiguously issuing references", () => {
    const duplicate = evidence();
    expect(() => catalogFor(entrepreneurProfile, [duplicate, duplicate])).toThrowError(
      expect.objectContaining({ code: "DUPLICATE_EVIDENCE" }),
    );
  });
});
