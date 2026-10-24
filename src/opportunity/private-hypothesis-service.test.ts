import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  readConfig: vi.fn(),
  transportAllowed: vi.fn(),
  buildProfile: vi.fn(),
  openEvidence: vi.fn(),
  createMany: vi.fn(),
  listForUser: vi.fn(),
  setSaved: vi.fn(),
  removeForUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../ai-analysis/ninerouter", async (importOriginal) => ({
  ...await importOriginal<typeof import("../ai-analysis/ninerouter")>(),
  generateNineRouterJson: mocks.generate,
  isLocalProfileNineRouterTransportAllowed: mocks.transportAllowed,
  readLocalProfileNineRouterConfig: mocks.readConfig,
}));

vi.mock("./private-hypothesis-repository", () => ({
  PrivateOpportunityHypothesisRepository: class {
    createMany(...args: unknown[]) { return mocks.createMany(...args); }
    listForUser(...args: unknown[]) { return mocks.listForUser(...args); }
    setSaved(...args: unknown[]) { return mocks.setSaved(...args); }
    removeForUser(...args: unknown[]) { return mocks.removeForUser(...args); }
  },
}));
vi.mock("./searchapi-evidence-token", () => ({
  openSearchApiOpportunityEvidence: mocks.openEvidence,
  SearchApiEvidenceTokenError: class extends Error {
    constructor(readonly code: string) { super(code); }
  },
}));

import { ONBOARDING_STATUSES, USER_TYPES, userIdSchema, type SafeUser } from "../auth/user-types";
import { NineRouterError } from "../ai-analysis/ninerouter";
import { OPPORTUNITY_SEARCHAPI_DISCLOSURE_VERSION, type SearchApiOpportunityEvidence } from "./searchapi-evidence-contract";
import { OPPORTUNITY_ANALYSIS_CONTEXT_VERSION, OPPORTUNITY_ANALYSIS_PROMPT_VERSION, type BuiltOpportunityProfileContext } from "./opportunity-analysis-context";
import { hybridGeneratedOpportunityResultSchema, hybridOpportunityDiagnosticContract, type HybridGeneratedOpportunityResult } from "./hybrid-opportunity-analysis";
import { privateOpportunityHypothesisSchema, privateOpportunitySourceSchema } from "./private-hypothesis";
import { PrivateOpportunityError, PrivateOpportunityHypothesisService } from "./private-hypothesis-service";
import type { PrivateOpportunityHypothesisRepository } from "./private-hypothesis-repository";

const now = new Date("2026-10-18T04:00:00.000Z");
const evidence: SearchApiOpportunityEvidence = {
  sourceType: "RELATED_QUERY_RISING",
  productQuery: "PRIVATE UMKM BUSINESS NAME",
  query: "soto ayam viral",
  position: 1,
  interestIndex: null,
  growthLabel: "Breakout",
  growthPercent: null,
  isBreakout: true,
  geo: "ID",
  period: "24 jam terakhir",
  providerTime: "now 1-d",
  searchProperty: "web",
  retrievedAt: now.toISOString(),
  expiresAt: new Date(now.getTime() + 300_000).toISOString(),
  publisher: "Google Trends",
  provider: "SearchApi.io",
  url: "https://trends.google.com/trends/explore?geo=ID&date=now+1-d&q=PRIVATE+UMKM+BUSINESS+NAME",
  providerSourceUrl: null,
};

const environment = {
  AI_ANALYSIS_TRENDS_USER_INFERENCE_ENABLED: "true",
  NINEROUTER_SEARCHAPI_PROCESSING_CONFIRMED: "true",
  AUTH_SECRET: "test-secret-with-more-than-thirty-two-characters-for-hmac",
};

const entrepreneurProfile: BuiltOpportunityProfileContext = {
  profile: {
    persona: "ENTREPRENEUR",
    preferredProductType: "Kopi 3-in-1",
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
    profileFieldsPresent: ["profile.preferredProductType", "profile.categories", "profile.customerSegments", "profile.salesChannels", "profile.budget", "profile.location", "profile.experienceLevel", "profile.timeCommitment", "profile.businessObjective"],
    profileFieldsMissing: ["profile.notes"],
  },
};

const defaultProfile: BuiltOpportunityProfileContext = {
  profile: {
    persona: "UMKM_EXISTING",
    businessName: "PRIVATE UMKM BUSINESS NAME",
    businessCategory: "Makanan",
    businessDescription: "Kedai yang menjual soto.",
    location: { text: "Bandung", city: "Bandung", province: "Jawa Barat" },
    averagePrice: { min: 15000, max: 30000, currency: "IDR" },
    products: [{ name: "Soto Ayam", category: "Makanan", price: 20000 }],
    customerSegments: ["Pelanggan lokal"],
    salesChannels: ["Pesan antar"],
    notes: "Uji kemasan yang mudah dibawa.",
  },
  dataAvailability: {
    profileFieldsPresent: ["profile.businessName", "profile.businessCategory", "profile.products", "profile.customerSegments", "profile.salesChannels", "profile.averagePrice", "profile.location", "profile.notes", "profile.businessDescription", "profile.products[].price", "profile.products[].category"],
    profileFieldsMissing: [],
  },
};

const config = {
  provider: "ninerouter" as const,
  baseURL: "https://9router.example/v1",
  apiKey: "test-only-secret",
  model: "cx/gpt-6-luna-xhigh" as const,
  timeoutMs: 20_000,
};

type PromptFact = Readonly<{
  ref: { catalogId: string; factId: string };
  sourceType: "PROFILE" | "SEARCHAPI";
  metric: string;
  value?: unknown;
  subject: { label: string };
}>;
type PromptGenerationContext = Readonly<{
  catalogId: string;
  persona: "ENTREPRENEUR" | "UMKM_EXISTING";
  profileAvailability: { missing: readonly string[] };
  facts: readonly PromptFact[];
  eligibleEvidenceGaps: readonly { ref: { catalogId: string; gapId: string }; code: string; metric: string; subjectId: string }[];
}>;

function generationContextFromPrompt(prompt: string): PromptGenerationContext {
  const marker = "HYBRID_FACT_CATALOG_CONTEXT_JSON\n";
  const start = prompt.lastIndexOf(marker);
  if (start < 0) throw new Error("Hybrid generation context is missing.");
  const compact = JSON.parse(prompt.slice(start + marker.length).split("\n\nPERBAIKAN RESPONS:")[0]!) as {
    catalogId: string;
    persona: PromptGenerationContext["persona"];
    profileAvailability: PromptGenerationContext["profileAvailability"];
    facts: {
      PROFILE: readonly [string, string, string, unknown][];
      SEARCHAPI: readonly [string, string, string, unknown][];
    };
    eligibleEvidenceGaps: readonly [string, string, string, string][];
  };
  return {
    catalogId: compact.catalogId,
    persona: compact.persona,
    profileAvailability: compact.profileAvailability,
    facts: [
      ...compact.facts.PROFILE.map(([factId, metric, subjectLabel, value]) => ({
        ref: { catalogId: compact.catalogId, factId }, sourceType: "PROFILE" as const, metric, subject: { label: subjectLabel }, value,
      })),
      ...compact.facts.SEARCHAPI.map(([factId, metric, subjectLabel, value]) => ({
        ref: { catalogId: compact.catalogId, factId }, sourceType: "SEARCHAPI" as const, metric, subject: { label: subjectLabel }, value,
      })),
    ],
    eligibleEvidenceGaps: compact.eligibleEvidenceGaps.map(([gapId, code, metric, subjectId]) => ({
      ref: { catalogId: compact.catalogId, gapId }, code, metric, subjectId,
    })),
  };
}

function validTypedOutput(prompt: string): HybridGeneratedOpportunityResult {
  const context = generationContextFromPrompt(prompt);
  const profileFact = context.facts.find((fact) => fact.sourceType === "PROFILE" && fact.subject.label === "Pelanggan lokal")
    ?? context.facts.find((fact) => fact.sourceType === "PROFILE");
  const searchFact = context.facts.find((fact) => fact.sourceType === "SEARCHAPI");
  const customerGap = context.eligibleEvidenceGaps.find((gap) => gap.code === "CUSTOMER_VALIDATION_REQUIRED");
  if (!profileFact || !searchFact || !customerGap) throw new Error("Synthetic hybrid catalog is incomplete.");
  return hybridGeneratedOpportunityResultSchema.parse({
    outcome: "HYPOTHESES",
    ideas: [{
      narrative: {
        title: context.persona === "ENTREPRENEUR" ? "Konsep kopi lokal" : "Menu soto praktis",
        concept: "Uji konsep produk yang sesuai dengan profil dan sinyal pencarian terpilih.",
        targetCustomer: "Pelanggan lokal yang sesuai dengan segmen pada profil",
      },
      opportunityType: context.persona === "ENTREPRENEUR" ? "BUSINESS_CONCEPT" : "NEW_VARIANT",
      profileFit: [{ explanation: "Arah ini sesuai dengan segmen yang tercatat.", profileFactRefs: [profileFact.ref] }],
      evidenceInterpretation: [{ explanation: "Sinyal pencarian terkait dapat menjadi konteks untuk pengujian awal.", searchFactRefs: [searchFact.ref] }],
      experiments: [
        { action: "Wawancarai calon pelanggan untuk menilai penerimaan konsep", parameters: [{ status: "PROPOSED", kind: "INTERVIEW_COUNT", value: 10, unit: "PEOPLE", sourceRef: null }] },
        { action: "Uji konsep dalam waktu terbatas dan catat tanggapan", parameters: [{ status: "PROPOSED", kind: "DURATION", value: 7, unit: "DAYS", sourceRef: null }] },
      ],
      assumptions: ["Minat penelusuran belum menunjukkan minat untuk membeli."],
      limitations: ["Data pencarian tidak mengukur penjualan atau keuntungan."],
      evidenceGapRefs: [customerGap.ref],
    }],
  });
}

function withSecondIdea(output: HybridGeneratedOpportunityResult): HybridGeneratedOpportunityResult {
  if (output.outcome !== "HYPOTHESES") return output;
  const first = output.ideas[0]!;
  const second = {
    ...first,
    narrative: {
      ...first.narrative,
      title: `${first.narrative.title} alternatif`,
    },
  };
  return hybridGeneratedOpportunityResultSchema.parse({ ...output, ideas: [first, second] });
}

function useGenerated(
  transform: (output: HybridGeneratedOpportunityResult, context: PromptGenerationContext) => HybridGeneratedOpportunityResult = (output) => output,
) {
  mocks.generate.mockImplementation(async (input: { prompt: string }) => {
    const context = generationContextFromPrompt(input.prompt);
    return transform(validTypedOutput(input.prompt), context);
  });
}

function updateFirstIdea(
  output: HybridGeneratedOpportunityResult,
  update: (idea: Extract<HybridGeneratedOpportunityResult, { outcome: "HYPOTHESES" }>["ideas"][number]) => Extract<HybridGeneratedOpportunityResult, { outcome: "HYPOTHESES" }>["ideas"][number],
): HybridGeneratedOpportunityResult {
  if (output.outcome !== "HYPOTHESES") return output;
  return { ...output, ideas: [update(output.ideas[0]!)] };
}

function createService(
  userId = "80000000-0000-4000-8000-000000000011",
  env = environment,
  userType: SafeUser["userType"] = USER_TYPES.UMKM_EXISTING,
  clock: () => Date = () => now,
) {
  const repository = {
    createMany: mocks.createMany,
    listForUser: mocks.listForUser,
    setSaved: mocks.setSaved,
    removeForUser: mocks.removeForUser,
  } as unknown as PrivateOpportunityHypothesisRepository;
  const service = new PrivateOpportunityHypothesisService(repository, env, clock, { build: (...args: unknown[]) => mocks.buildProfile(...args) } as never);
  const user: SafeUser = {
    id: userIdSchema.parse(userId),
    email: "founder@example.test",
    userType,
    onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
  };
  return { service, user };
}

function request(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    sourceToken: "v1." + "x".repeat(100),
    consent: true,
    disclosureVersion: OPPORTUNITY_SEARCHAPI_DISCLOSURE_VERSION,
    ...overrides,
  };
}

describe("Private hybrid SearchApi opportunity flow", () => {
  it.skipIf(process.env.VENTUREX_LIVE_STRUCTURED_SMOKE !== "true").each([USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING])("live structured provider completes the synthetic %s service pipeline", async (persona) => {
    const actual = await vi.importActual<typeof import("../ai-analysis/ninerouter")>("../ai-analysis/ninerouter");
    const liveConfig = actual.readLocalProfileNineRouterConfig({ ...process.env, NODE_ENV: "development" });
    expect(liveConfig).not.toBeNull();
    mocks.readConfig.mockReturnValue(liveConfig);
    mocks.generate.mockImplementation(actual.generateNineRouterJson);
    const profile = persona === USER_TYPES.ENTREPRENEUR ? entrepreneurProfile : defaultProfile;
    mocks.buildProfile.mockResolvedValue(profile);
    const started = new Date();
    mocks.openEvidence.mockReturnValue({ ...evidence, retrievedAt: started.toISOString(), expiresAt: new Date(started.getTime() + 300_000).toISOString() });
    const { service, user } = createService(persona === USER_TYPES.ENTREPRENEUR ? "99000000-0000-4000-8000-000000000101" : "99000000-0000-4000-8000-000000000102", environment, persona, () => new Date());
    let result;
    try {
      result = await service.generateForUser(user, request());
    } catch (error) {
      if (error instanceof PrivateOpportunityError) throw new Error(JSON.stringify({ code: error.code, diagnostic: error.providerDiagnostic }));
      throw error;
    }
    expect(result).toMatchObject({ outcome: "HYPOTHESES" });
    expect(mocks.createMany).toHaveBeenCalledOnce();
    expect(mocks.generate).toHaveBeenCalledOnce();
    console.info("synthetic structured smoke", { persona, schemaAndGroundingPassed: true, repositoryBoundaryReached: true, durationMs: Date.now() - started.getTime() });
  }, 180_000);
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readConfig.mockReturnValue(config);
    mocks.transportAllowed.mockReturnValue(true);
    mocks.buildProfile.mockResolvedValue(defaultProfile);
    mocks.openEvidence.mockReturnValue(evidence);
    mocks.createMany.mockResolvedValue([]);
    useGenerated();
  });

  it("removes a private hypothesis through the authenticated owner's repository scope", async () => {
    const hypothesisId = "90000000-0000-4000-8000-000000000021";
    const { service, user } = createService("80000000-0000-4000-8000-000000000085");

    await service.removeForUser(user, hypothesisId);

    expect(mocks.removeForUser).toHaveBeenCalledWith(user.id, user.userType, hypothesisId);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("requires consent, feature gates, and an approved transport before inference", async () => {
    const first = createService("80000000-0000-4000-8000-000000000012");
    await expect(first.service.generateForUser(first.user, request({ consent: false }))).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
    const second = createService("80000000-0000-4000-8000-000000000013", { ...environment, NINEROUTER_SEARCHAPI_PROCESSING_CONFIRMED: "false" });
    await expect(second.service.generateForUser(second.user, request())).rejects.toMatchObject({ code: "SOURCE_PROCESSING_NOT_APPROVED" });
    const third = createService("80000000-0000-4000-8000-000000000014");
    mocks.transportAllowed.mockReturnValue(false);
    await expect(third.service.generateForUser(third.user, request())).rejects.toMatchObject({ code: "INSECURE_PROVIDER_TRANSPORT" });
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("uses one local gateway call with the server catalog and preserves private SearchApi provenance", async () => {
    const { service, user } = createService();
    await service.generateForUser(user, request());
    expect(mocks.generate).toHaveBeenCalledOnce();
    const input = mocks.generate.mock.calls[0]?.[0] as { system: string; prompt: string; config: typeof config; schema: unknown };
    const context = generationContextFromPrompt(input.prompt);
    expect(input.config.model).toBe("cx/gpt-6-luna-xhigh");
    expect(input.schema).toBeDefined();
    expect(mocks.generate.mock.calls[0]?.[0].structuredOutput).toBe(true);
    expect(input.prompt).toContain("HYBRID_FACT_CATALOG_CONTEXT_JSON");
    expect(input.prompt).toContain("soto ayam viral");
    expect(input.prompt).toContain("PRIVATE UMKM BUSINESS NAME");
    expect(input.prompt).toContain("kind tepat");
    expect(input.system).toContain("Jangan samakan periode pengamatan SearchApi dengan durasi uji");
    expect(input.system).toContain("Narrative, assumptions, limitations, dan experiment.action tidak memuat angka/jumlah");
    expect(input.system).toContain("Nama produk bernomor boleh disalin persis dari fakta profil yang dirujuk");
    expect(input.prompt).toContain("OUTPUT_JSON_SCHEMA");
    expect(input.system).toContain("hangat, santai, sopan");
    expect(input.system).toContain("bukan mengulang isi profil");
    expect(input.prompt).toContain("sourceRef:null");
    expect(input.prompt).toContain("PRICE_TEST memakai min/max, bukan value");
    expect(input.prompt).not.toContain("founder@example.test");
    expect(input.prompt).not.toContain("v1." + "x".repeat(60));
    expect(context.facts.some((fact) => fact.sourceType === "PROFILE")).toBe(true);
    expect(context.facts.some((fact) => fact.metric === "RELATED_QUERY_BREAKOUT")).toBe(true);
    expect(context.eligibleEvidenceGaps.some((gap) => gap.code === "CUSTOMER_VALIDATION_REQUIRED")).toBe(true);

    const rows = mocks.createMany.mock.calls[0]?.[0] as readonly { hypothesis: Record<string, unknown>; sourceReference: Record<string, unknown> }[];
    expect(privateOpportunityHypothesisSchema.safeParse(rows[0]?.hypothesis).success).toBe(true);
    expect(rows[0]?.hypothesis.evidenceInterpretation).toContain("label Breakout");
    expect(rows[0]?.hypothesis.evidenceInterpretation).not.toContain("Breakout%");
    expect(privateOpportunitySourceSchema.safeParse(rows[0]?.sourceReference).success).toBe(true);
    expect(rows[0]?.sourceReference).toMatchObject({
      sourceType: "RELATED_QUERY_RISING",
      query: "soto ayam viral",
      growthLabel: "Breakout",
      growthPercent: null,
      provider: "SearchApi.io",
      publisher: "Google Trends",
      transport: "SearchApi.io",
      sourceId: expect.stringMatching(/^searchapi_/u),
      analysisContextVersion: OPPORTUNITY_ANALYSIS_CONTEXT_VERSION,
      promptVersion: OPPORTUNITY_ANALYSIS_PROMPT_VERSION,
    });
    expect(JSON.stringify(rows[0]?.hypothesis)).not.toContain("catalogId");
  });

  it.each(
    [USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING].flatMap((persona, personaIndex) =>
      ["", "ID", "US", "ID-JK"].flatMap((geo, geoIndex) =>
        ["Es teh", "Kopi", "Soto ayam"].map((product, productIndex) => ({
          persona, geo, product, index: personaIndex * 12 + geoIndex * 3 + productIndex,
        })))),
  )("generates for $persona, region '$geo', and product $product", async ({ persona, geo, product, index }) => {
    const profile = persona === USER_TYPES.ENTREPRENEUR ? entrepreneurProfile : defaultProfile;
    mocks.buildProfile.mockResolvedValue({
      ...profile,
      profile: profile.profile.persona === "ENTREPRENEUR"
        ? { ...profile.profile, preferredProductType: product }
        : { ...profile.profile, products: [{ name: product, category: "F&B", price: 20000 }] },
    });
    mocks.openEvidence.mockReturnValue({
      ...evidence, sourceType: "RELATED_QUERY_TOP", productQuery: product, query: `${product} praktis`,
      interestIndex: 100, growthLabel: null, growthPercent: null, isBreakout: false, geo,
      url: `https://trends.google.com/trends/explore?geo=${geo}&q=${encodeURIComponent(product)}`,
    });
    const { service, user } = createService(
      `80000000-0000-4000-8000-${String(300 + index).padStart(12, "0")}`, environment, persona,
    );

    await service.generateForUser(user, request());

    expect(mocks.generate).toHaveBeenCalledOnce();
    expect(mocks.createMany).toHaveBeenCalledOnce();
    const rows = mocks.createMany.mock.calls[0]?.[0];
    expect(rows[0]?.sourceReference).toMatchObject({ geo, query: `${product} praktis` });
    expect(rows[0]?.userType).toBe(persona);
    expect(privateOpportunityHypothesisSchema.safeParse(rows[0]?.hypothesis).success).toBe(true);
  });

  it("uses the selected kopi hitam signal with only the matching server persona profile", async () => {
    const scenarios = [
      { userType: USER_TYPES.ENTREPRENEUR, profile: entrepreneurProfile, userId: "80000000-0000-4000-8000-000000000091", productQuery: "Kopi 3-in-1", profileText: "Kopi 3-in-1" },
      { userType: USER_TYPES.UMKM_EXISTING, profile: defaultProfile, userId: "80000000-0000-4000-8000-000000000092", productQuery: "PRIVATE UMKM BUSINESS NAME", profileText: "Soto Ayam" },
    ] as const;

    for (const scenario of scenarios) {
      mocks.openEvidence.mockReturnValue({
        ...evidence,
        sourceType: "RELATED_QUERY_TOP",
        productQuery: scenario.productQuery,
        query: "kopi hitam",
        interestIndex: 27,
        growthLabel: null,
        growthPercent: null,
        isBreakout: false,
      });
      mocks.buildProfile.mockResolvedValue(scenario.profile);
      const { service, user } = createService(scenario.userId, environment, scenario.userType);
      await service.generateForUser(user, request());

      const input = mocks.generate.mock.calls.at(-1)?.[0] as { prompt: string };
      const context = generationContextFromPrompt(input.prompt);
      expect(input.prompt).toContain("kopi hitam");
      expect(context.persona).toBe(scenario.userType);
      expect(context.facts.some((fact) => fact.sourceType === "PROFILE" && JSON.stringify(fact).includes(scenario.profileText))).toBe(true);
      expect(context.facts.some((fact) => fact.sourceType === "SEARCHAPI" && fact.metric === "RELATED_QUERY_INTEREST_INDEX" && fact.value === 27)).toBe(true);
      expect(mocks.createMany).toHaveBeenCalledTimes(scenarios.indexOf(scenario) + 1);
    }
  });

  it("persists multiple fully valid ideas through the existing offline pipeline", async () => {
    const { service, user } = createService("80000000-0000-4000-8000-000000000901");
    useGenerated((output) => withSecondIdea(output));

    await service.generateForUser(user, request());

    const rows = mocks.createMany.mock.calls[0]?.[0] as readonly { hypothesis: Record<string, unknown> }[];
    expect(mocks.generate).toHaveBeenCalledOnce();
    expect(mocks.createMany).toHaveBeenCalledOnce();
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => privateOpportunityHypothesisSchema.safeParse(row.hypothesis).success)).toBe(true);
  });

  it("rejects every idea when a later idea fails grounding and persists none", async () => {
    const { service, user } = createService("80000000-0000-4000-8000-000000000902");
    useGenerated((output) => {
      const validOutput = withSecondIdea(output);
      if (validOutput.outcome !== "HYPOTHESES") return validOutput;
      const first = validOutput.ideas[0]!;
      const second = validOutput.ideas[1]!;
      return hybridGeneratedOpportunityResultSchema.parse({
        ...validOutput,
        ideas: [first, {
          ...second,
          narrative: {
            ...second.narrative,
            concept: "Konsep ini menjamin laba Rp9.999.999 per hari.",
          },
        }],
      });
    });

    let rejection: unknown;
    try {
      await service.generateForUser(user, request());
    } catch (error) {
      rejection = error;
    }

    expect(rejection).toMatchObject({
      code: "AI_RESPONSE_INVALID",
      providerDiagnostic: {
        category: "CONTENT_POLICY_REJECTED",
        schemaValidationOutcome: "PASSED",
        groundingValidationOutcome: "FAILED",
        rejectedRule: "UNSUPPORTED_FINANCIAL_CLAIM",
      },
    });
    expect(mocks.createMany).not.toHaveBeenCalled();
    expect(mocks.openEvidence).toHaveBeenCalledOnce();
    const rejectionText = `${rejection instanceof Error ? rejection.message : ""} ${JSON.stringify(rejection)}`;
    expect(rejectionText).not.toContain("Rp9.999.999");
    expect(rejectionText).not.toContain("PRIVATE UMKM BUSINESS NAME");
  });

  it("keeps Top index and Rising growth semantics separate and preserves source timestamp", async () => {
    const { service, user } = createService("80000000-0000-4000-8000-000000000032");
    const topEvidence: SearchApiOpportunityEvidence = {
      ...evidence, sourceType: "RELATED_QUERY_TOP", productQuery: "kopi", query: "kopi hitam", position: 3,
      interestIndex: 25, growthLabel: null, growthPercent: null, isBreakout: false,
    };
    mocks.openEvidence.mockReturnValue(topEvidence);
    await service.generateForUser(user, request());
    const topPrompt = mocks.generate.mock.calls[0]?.[0].prompt as string;
    const topCatalog = generationContextFromPrompt(topPrompt);
    expect(topCatalog.facts.some((fact) => fact.metric === "RELATED_QUERY_INTEREST_INDEX" && fact.value === 25)).toBe(true);
    expect(topPrompt).toContain('"position":3');
    expect(topPrompt).toContain('"retrievedAt":"2026-10-18T04:00:00.000Z"');
    const topHypothesis = (mocks.createMany.mock.calls[0]?.[0] as readonly { hypothesis: { evidenceInterpretation: string } }[])[0]?.hypothesis;
    expect(topHypothesis?.evidenceInterpretation).toContain("indeks minat relatif sebesar 25");
    expect(topHypothesis?.evidenceInterpretation).not.toContain("pertumbuhan");

    vi.clearAllMocks();
    mocks.readConfig.mockReturnValue(config);
    mocks.transportAllowed.mockReturnValue(true);
    mocks.buildProfile.mockResolvedValue(defaultProfile);
    mocks.openEvidence.mockReturnValue({ ...evidence, growthLabel: "+450%", growthPercent: 450, isBreakout: false });
    mocks.createMany.mockResolvedValue([]);
    useGenerated();
    const rising = createService("80000000-0000-4000-8000-000000000033");
    await rising.service.generateForUser(rising.user, request());
    const risingPrompt = mocks.generate.mock.calls[0]?.[0].prompt as string;
    const risingCatalog = generationContextFromPrompt(risingPrompt);
    expect(risingCatalog.facts.some((fact) => fact.metric === "RELATED_QUERY_GROWTH_PERCENT" && fact.value === 450)).toBe(true);
    expect(risingCatalog.facts.some((fact) => fact.metric === "RELATED_QUERY_BREAKOUT")).toBe(false);
    const risingHypothesis = (mocks.createMany.mock.calls[0]?.[0] as readonly { hypothesis: { evidenceInterpretation: string } }[])[0]?.hypothesis;
    expect(risingHypothesis?.evidenceInterpretation).toContain("pertumbuhan kueri terkait sebesar 450%");
    expect(risingHypothesis?.evidenceInterpretation).not.toContain("penjualan sebesar");
  });

  it.each([
    { persona: USER_TYPES.UMKM_EXISTING, profile: defaultProfile, productQuery: "PRIVATE UMKM BUSINESS NAME" },
    { persona: USER_TYPES.ENTREPRENEUR, profile: entrepreneurProfile, productQuery: "Kopi 3-in-1" },
  ] as const)("materializes a typed experiment and persists for $persona", async ({ persona, profile, productQuery }) => {
    const id = persona === USER_TYPES.UMKM_EXISTING ? "80000000-0000-4000-8000-000000000051" : "80000000-0000-4000-8000-000000000052";
    const { service, user } = createService(id, environment, persona);
    mocks.buildProfile.mockResolvedValue(profile);
    mocks.openEvidence.mockReturnValue({ ...evidence, productQuery });
    const result = await service.generateForUser(user, request());
    expect(result).toMatchObject({ outcome: "HYPOTHESES" });
    expect(mocks.generate).toHaveBeenCalledOnce();
    expect(mocks.createMany).toHaveBeenCalledOnce();
    const rows = mocks.createMany.mock.calls[0]?.[0] as readonly { hypothesis: Record<string, unknown>; userId: string }[];
    expect(rows[0]?.userId).toBe(user.id);
    expect(privateOpportunityHypothesisSchema.safeParse(rows[0]?.hypothesis).success).toBe(true);
    expect((rows[0]?.hypothesis.validationSteps as string[]).some((step) => step.includes("10 calon pelanggan"))).toBe(true);
    expect((rows[0]?.hypothesis.validationSteps as string[]).some((step) => step.includes("7 hari"))).toBe(true);
    expect(JSON.stringify(rows[0]?.hypothesis)).not.toContain("sourceRef");
  });

  it("renders each structured experiment parameter as its own prospective action", async () => {
    const { service, user } = createService("80000000-0000-4000-8000-000000000053");
    useGenerated((output) => updateFirstIdea(output, (idea) => ({
      ...idea,
      experiments: [
        {
          action: "Amati tanggapan calon pelanggan terhadap konsep",
          parameters: [
            { status: "PROPOSED", kind: "SAMPLE_SIZE", value: 10, unit: "PEOPLE", sourceRef: null },
            { status: "PROPOSED", kind: "DURATION", value: 7, unit: "DAYS", sourceRef: null },
          ],
        },
        {
          action: "Bandingkan kemasan yang relevan dengan produk",
          parameters: [
            { status: "PROPOSED", kind: "PRODUCT_VARIANT_COUNT", value: 3, unit: "VARIANTS", sourceRef: null },
            { status: "PROPOSED", kind: "DURATION", value: 5, unit: "DAYS", sourceRef: null },
          ],
        },
      ],
    })));

    await service.generateForUser(user, request());

    const rows = mocks.createMany.mock.calls[0]?.[0] as readonly { hypothesis: { validationSteps: string[] } }[];
    expect(rows[0]?.hypothesis.validationSteps).toEqual([
      expect.stringContaining("Uji dengan target sampel 10 calon pelanggan. Lakukan pengujian selama 7 hari"),
      expect.stringContaining("Bandingkan 3 varian. Lakukan pengujian selama 5 hari"),
    ]);
    expect(mocks.createMany).toHaveBeenCalledOnce();
  });

  it("retains partial UMKM prices and does not treat null product price as zero", async () => {
    const business = defaultProfile.profile as Extract<BuiltOpportunityProfileContext["profile"], { persona: "UMKM_EXISTING" }>;
    const partialProfile: BuiltOpportunityProfileContext = {
      profile: { ...business, products: [
        { name: "Soto Ayam", category: "Makanan", price: 20000 },
        { name: "Es Teh", category: "Minuman", price: null },
      ] },
      dataAvailability: defaultProfile.dataAvailability,
    };
    const { service, user } = createService("80000000-0000-4000-8000-000000000055");
    mocks.buildProfile.mockResolvedValue(partialProfile);
    await service.generateForUser(user, request());
    const catalog = generationContextFromPrompt(mocks.generate.mock.calls[0]?.[0].prompt as string);
    expect(catalog.facts.some((fact) => fact.metric === "PRODUCT_PRICE" && fact.value === 20000)).toBe(true);
    expect(catalog.facts.some((fact) => fact.metric === "PRODUCT_PRICE" && fact.value === 0)).toBe(false);
    expect(catalog.eligibleEvidenceGaps.some((gap) => gap.code === "EXISTING_PRODUCT_PRICE_UNKNOWN" && gap.subjectId.endsWith("[1]") === true)).toBe(true);
  });

  it.each([USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING])("sends validator array bounds for %s and distinguishes eligible gaps from selected gaps", async (persona) => {
    const { service, user } = createService(persona === USER_TYPES.ENTREPRENEUR ? "99000000-0000-4000-8000-000000000001" : "99000000-0000-4000-8000-000000000002", environment, persona);
    if (persona === USER_TYPES.ENTREPRENEUR) mocks.buildProfile.mockResolvedValue(entrepreneurProfile);
    await service.generateForUser(user, request());
    const prompt = mocks.generate.mock.calls[0]?.[0].prompt as string;
    const context = generationContextFromPrompt(prompt);
    expect(context.eligibleEvidenceGaps.length).toBeGreaterThan(5);
    for (const field of hybridOpportunityDiagnosticContract.fields) {
      if (field.typeCategory !== "array") continue;
      expect(prompt).toContain(JSON.stringify([field.path, field.minItems, field.maxItems]));
    }
    expect(prompt).toContain("daftar pilihan, bukan daftar yang harus disalin seluruhnya");
    expect(mocks.generate).toHaveBeenCalledOnce();
  });

  it.each([5, 6])("validates a response selecting %i real catalog gaps without truncation or schema retries", async (count) => {
    const { service, user } = createService(count === 5 ? "99000000-0000-4000-8000-000000000003" : "99000000-0000-4000-8000-000000000004");
    useGenerated((output, context) => {
      const refs = context.eligibleEvidenceGaps.slice(0, count).map((gap) => gap.ref);
      expect(refs).toHaveLength(count);
      const candidate = updateFirstIdea(output, (idea) => ({ ...idea, evidenceGapRefs: refs }));
      const parsed = hybridGeneratedOpportunityResultSchema.safeParse(candidate);
      expect(parsed.success).toBe(count === 5);
      if (!parsed.success) expect(parsed.error.issues).toContainEqual(expect.objectContaining({ code: "too_big", path: ["ideas", 0, "evidenceGapRefs"], maximum: 5 }));
      return candidate;
    });
    if (count === 5) {
      await service.generateForUser(user, request());
      const rows = mocks.createMany.mock.calls[0]?.[0] as readonly { hypothesis: { evidenceGaps: string[] } }[];
      expect(rows[0]?.hypothesis.evidenceGaps).toHaveLength(5);
    } else {
      await expect(service.generateForUser(user, request())).rejects.toMatchObject({
        code: "AI_RESPONSE_INVALID", providerDiagnostic: { failure: "SCHEMA_VALIDATION_FAILED" },
      });
      expect(mocks.createMany).not.toHaveBeenCalled();
    }
    expect(mocks.generate).toHaveBeenCalledOnce();
  });

  it("keeps a large synthetic profile within the one-request byte limit", async () => {
    const business = defaultProfile.profile as Extract<BuiltOpportunityProfileContext["profile"], { persona: "UMKM_EXISTING" }>;
    const present = defaultProfile.dataAvailability.profileFieldsPresent.filter((field) => field !== "profile.products[].price");
    const expandedProfile: BuiltOpportunityProfileContext = {
      profile: {
        ...business,
        businessDescription: "Usaha makanan keluarga. ".repeat(35),
        notes: "Catatan profil sintetis. ".repeat(35),
        products: Array.from({ length: 20 }, (_, index) => ({ name: `Produk ${index + 1} ${"menu lokal ".repeat(5)}`, category: "Makanan", price: null })),
      },
      dataAvailability: {
        profileFieldsPresent: present,
        profileFieldsMissing: [...defaultProfile.dataAvailability.profileFieldsMissing, "profile.products[].price"],
      },
    };
    const { service, user } = createService("80000000-0000-4000-8000-000000000081");
    mocks.buildProfile.mockResolvedValue(expandedProfile);
    await service.generateForUser(user, request());
    const input = mocks.generate.mock.calls[0]?.[0] as { system: string; prompt: string };
    expect(Buffer.byteLength(input.system, "utf8") + Buffer.byteLength(input.prompt, "utf8")).toBeLessThanOrEqual(16 * 1024);
  });

  it("rejects a Top index outside the provider contract as a typed source error before inference", async () => {
    const { service, user } = createService("80000000-0000-4000-8000-000000000056");
    mocks.openEvidence.mockReturnValue({ ...evidence, sourceType: "RELATED_QUERY_TOP", interestIndex: 101, growthLabel: null, growthPercent: null, isBreakout: false });
    await expect(service.generateForUser(user, request())).rejects.toMatchObject({ name: "OpportunityFactCatalogError", code: "INVALID_TOP_INDEX" });
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it.each([
    { name: "fabricated fact", userId: "80000000-0000-4000-8000-000000000072", transform: (output: HybridGeneratedOpportunityResult, context: PromptGenerationContext) => updateFirstIdea(output, (idea) => ({
      ...idea, profileFit: [{ ...idea.profileFit[0]!, profileFactRefs: [{ catalogId: idea.profileFit[0]!.profileFactRefs[0]!.catalogId, factId: "fact_ffffffffffffffffffffffff" }] }],
    })) },
    { name: "cross-user catalog", userId: "80000000-0000-4000-8000-000000000073", transform: (output: HybridGeneratedOpportunityResult) => updateFirstIdea(output, (idea) => ({
      ...idea, evidenceInterpretation: [{ ...idea.evidenceInterpretation[0]!, searchFactRefs: [{ ...idea.evidenceInterpretation[0]!.searchFactRefs[0]!, catalogId: "catalog_aaaaaaaaaaaaaaaaaaaaaaaa" }] }],
    })) },
    { name: "duplicate fact", userId: "80000000-0000-4000-8000-000000000074", transform: (output: HybridGeneratedOpportunityResult) => updateFirstIdea(output, (idea) => ({
      ...idea, profileFit: [{ ...idea.profileFit[0]!, profileFactRefs: [...idea.profileFit[0]!.profileFactRefs, ...idea.profileFit[0]!.profileFactRefs] }],
    })) },
    { name: "profile/search source mismatch", userId: "80000000-0000-4000-8000-000000000075", transform: (output: HybridGeneratedOpportunityResult) => updateFirstIdea(output, (idea) => ({
      ...idea, profileFit: [{ ...idea.profileFit[0]!, profileFactRefs: idea.evidenceInterpretation[0]!.searchFactRefs }],
    })) },
  ])("rejects $name and persists nothing", async ({ transform, userId }) => {
    const { service, user } = createService(userId);
    useGenerated((output, context) => transform(output, context));
    await expect(service.generateForUser(user, request())).rejects.toMatchObject({
      code: "AI_RESPONSE_INVALID",
      providerDiagnostic: { category: "CONTENT_POLICY_REJECTED", groundingValidationOutcome: "FAILED" },
    });
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("rejects invalid and duplicate evidence-gap refs without partial acceptance", async () => {
    const { service, user } = createService("80000000-0000-4000-8000-000000000058");
    useGenerated((output) => updateFirstIdea(output, (idea) => ({
      ...idea,
      evidenceGapRefs: [idea.evidenceGapRefs[0]!, { ...idea.evidenceGapRefs[0]!, gapId: "gapref_ffffffffffffffffffffffff" }],
    })));
    await expect(service.generateForUser(user, request())).rejects.toMatchObject({
      code: "AI_RESPONSE_INVALID",
      providerDiagnostic: { failure: "INVALID_EVIDENCE_GAP_REFERENCE", rejectedRule: "INVALID_EVIDENCE_GAP_REFERENCE" },
    });
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it.each([
    { code: "PROPOSED_PRODUCT_PRICE_UNKNOWN", expectedText: "Harga jual produk usulan belum ditentukan", userId: "80000000-0000-4000-8000-000000000076" },
    { code: "COMPETITOR_PRICE_UNKNOWN", expectedText: "Harga produk pesaing belum tersedia", userId: "80000000-0000-4000-8000-000000000077" },
  ])("materializes only the server-owned $code gap", async ({ code, expectedText, userId }) => {
    const { service, user } = createService(userId);
    useGenerated((output, context) => {
      const gap = context.eligibleEvidenceGaps.find((candidate) => candidate.code === code);
      if (!gap) throw new Error(`Missing synthetic ${code} gap.`);
      return updateFirstIdea(output, (idea) => ({ ...idea, evidenceGapRefs: [gap.ref] }));
    });
    await service.generateForUser(user, request());
    const rows = mocks.createMany.mock.calls[0]?.[0] as readonly { hypothesis: { evidenceGaps: string[] } }[];
    expect(rows[0]?.hypothesis.evidenceGaps).toHaveLength(1);
    expect(rows[0]?.hypothesis.evidenceGaps[0]).toContain(expectedText);
    expect(rows[0]?.hypothesis.evidenceGaps[0]).not.toContain("gapref_");
  });

  it("rejects an unsupported revenue claim even when other profile and trend facts are valid", async () => {
    const { service, user } = createService("80000000-0000-4000-8000-000000000059");
    useGenerated((output) => updateFirstIdea(output, (idea) => ({
      ...idea,
      narrative: { ...idea.narrative, concept: "Konsep ini diperkirakan menghasilkan omzet Rp500.000 setiap hari untuk pelanggan lokal." },
    })));
    await expect(service.generateForUser(user, request())).rejects.toMatchObject({
      code: "AI_RESPONSE_INVALID",
      providerDiagnostic: {
        category: "CONTENT_POLICY_REJECTED",
        rejectedRule: "UNSUPPORTED_FINANCIAL_CLAIM",
        semanticCategory: "UNSUPPORTED_FINANCIAL_CLAIM",
        financialMetric: "REVENUE",
        financialEvidenceAvailable: false,
      },
    });
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("materializes declared product prices only from the cited product fact", async () => {
    const { service, user } = createService("80000000-0000-4000-8000-000000000061");
    useGenerated((output, context) => {
      const price = context.facts.find((fact) => fact.sourceType === "PROFILE" && fact.metric === "PRODUCT_PRICE");
      if (!price) throw new Error("Missing synthetic price fact.");
      return updateFirstIdea(output, (idea) => ({
        ...idea,
        profileFit: [{ explanation: "Produk yang tercatat sesuai untuk menguji perubahan menu.", profileFactRefs: [price.ref] }],
      }));
    });
    await service.generateForUser(user, request());
    const rows = mocks.createMany.mock.calls[0]?.[0] as readonly { hypothesis: Record<string, unknown> }[];
    expect(rows[0]?.hypothesis.profileAlignment).toEqual([expect.stringContaining("Soto Ayam tercatat dengan harga Rp20.000")]);
    expect(rows[0]?.hypothesis.profileReferences).toContain("profile.products[].price");
    expect(privateOpportunityHypothesisSchema.safeParse(rows[0]?.hypothesis).success).toBe(true);
  });

  it("replaces model-authored numeric price text with only the cited server price", async () => {
    const { service, user } = createService("80000000-0000-4000-8000-000000000062");
    useGenerated((output, context) => {
      const price = context.facts.find((fact) => fact.sourceType === "PROFILE" && fact.metric === "PRODUCT_PRICE");
      if (!price) throw new Error("Missing synthetic price fact.");
      return updateFirstIdea(output, (idea) => ({
        ...idea,
        profileFit: [{ explanation: "Produk Soto Ayam tercatat dengan harga Rp21.000.", profileFactRefs: [price.ref] }],
      }));
    });
    await service.generateForUser(user, request());
    const rows = mocks.createMany.mock.calls[0]?.[0] as readonly { hypothesis: { profileAlignment: string[] } }[];
    const rationale = rows[0]?.hypothesis.profileAlignment.join(" ");
    expect(rationale).toContain("20.000");
    expect(rationale).not.toContain("21.000");
    expect(mocks.createMany).toHaveBeenCalledOnce();
  });

  it("rejects a contradiction that calls a known product price missing", async () => {
    const { service, user } = createService("80000000-0000-4000-8000-000000000078");
    useGenerated((output, context) => {
      const price = context.facts.find((fact) => fact.sourceType === "PROFILE" && fact.metric === "PRODUCT_PRICE");
      if (!price) throw new Error("Missing synthetic price fact.");
      return updateFirstIdea(output, (idea) => ({
        ...idea,
        profileFit: [{ explanation: "Harga produk Soto Ayam belum tercatat dalam profil.", profileFactRefs: [price.ref] }],
      }));
    });
    await expect(service.generateForUser(user, request())).rejects.toMatchObject({
      code: "AI_RESPONSE_INVALID",
      providerDiagnostic: { rejectedRule: "UNSUPPORTED_FINANCIAL_CLAIM", groundingValidationOutcome: "FAILED" },
    });
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("allows a proposed price range only as a typed prospective experiment", async () => {
    const { service, user } = createService("80000000-0000-4000-8000-000000000079");
    useGenerated((output) => updateFirstIdea(output, (idea) => ({
      ...idea,
      experiments: [
        { action: "Uji rentang harga usulan untuk melihat respons calon pelanggan", parameters: [{ status: "PROPOSED", kind: "PRICE_TEST", min: 15000, max: 25000, unit: "IDR", sourceRef: null }] },
        idea.experiments[1]!,
      ],
    })));
    await service.generateForUser(user, request());
    const rows = mocks.createMany.mock.calls[0]?.[0] as readonly { hypothesis: { validationSteps: string[] } }[];
    expect(rows[0]?.hypothesis.validationSteps[0]).toContain("rentang harga usulan Rp15.000 sampai Rp25.000");
    expect(mocks.createMany).toHaveBeenCalledOnce();
  });

  it("renders a matching numeric experiment action from the structured parameter", async () => {
    const { service, user } = createService("80000000-0000-4000-8000-000000000063");
    useGenerated((output) => updateFirstIdea(output, (idea) => ({
      ...idea,
      experiments: [{ ...idea.experiments[0]!, action: "Wawancarai 10 calon pelanggan untuk mengukur minat" }, idea.experiments[1]!],
    })));
    await service.generateForUser(user, request());
    const rows = mocks.createMany.mock.calls[0]?.[0] as readonly { hypothesis: { validationSteps: string[] } }[];
    expect(rows[0]?.hypothesis.validationSteps[0]).toContain("10 calon pelanggan");
    expect(mocks.createMany).toHaveBeenCalledOnce();
  });

  it("rejects unsupported profit claims even when valid trend references are present", async () => {
    const { service, user } = createService("80000000-0000-4000-8000-000000000080");
    useGenerated((output) => updateFirstIdea(output, (idea) => ({
      ...idea,
      narrative: { ...idea.narrative, concept: "Konsep ini akan menghasilkan margin laba 40% secara konsisten untuk usaha." },
    })));
    await expect(service.generateForUser(user, request())).rejects.toMatchObject({
      code: "AI_RESPONSE_INVALID",
      providerDiagnostic: { rejectedRule: "UNSUPPORTED_FINANCIAL_CLAIM", groundingValidationOutcome: "FAILED" },
    });
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("rejects a malformed typed response before persistence", async () => {
    const { service, user } = createService("80000000-0000-4000-8000-000000000064");
    mocks.generate.mockResolvedValue({ outcome: "HYPOTHESES", ideas: [{}] });
    await expect(service.generateForUser(user, request())).rejects.toMatchObject({
      code: "AI_RESPONSE_INVALID",
      providerDiagnostic: { failure: "SCHEMA_VALIDATION_FAILED", schemaValidationOutcome: "FAILED", groundingValidationOutcome: "NOT_RUN" },
    });
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("retries valid insufficiency once when profile and search facts exist", async () => {
    const { service, user } = createService("80000000-0000-4000-8000-000000000065");
    mocks.generate.mockImplementationOnce(async (input: { prompt: string }) => {
      const gap = generationContextFromPrompt(input.prompt).eligibleEvidenceGaps.find((item) => item.code === "CUSTOMER_VALIDATION_REQUIRED");
      if (!gap) throw new Error("Synthetic hybrid catalog is missing the expected gap.");
      return hybridGeneratedOpportunityResultSchema.parse({ outcome: "INSUFFICIENT_EVIDENCE", evidenceGapRefs: [gap.ref] });
    });
    await expect(service.generateForUser(user, request())).resolves.toMatchObject({ outcome: "HYPOTHESES" });
    const prompt = mocks.generate.mock.calls[0]?.[0].prompt as string;
    expect(prompt).toContain("INSUFFICIENT_EVIDENCE: { outcome, evidenceGapRefs: [{ catalogId, gapId }] }");
    expect(prompt).toContain("server membentuk reason dan limitations dari gap yang tervalidasi");
    expect(mocks.generate).toHaveBeenCalledTimes(2);
    expect(mocks.createMany).toHaveBeenCalledOnce();
  });

  it("rejects legacy model-authored insufficiency text without persistence", async () => {
    const { service, user } = createService("80000000-0000-4000-8000-000000000082");
    mocks.generate.mockResolvedValue({
      outcome: "INSUFFICIENT_EVIDENCE",
      reason: "Kueri terpilih belum cukup terkait dengan produk dan segmen usaha.",
      limitations: ["Nilai 25 menggambarkan potensi untuk usaha ini."],
    } as unknown as HybridGeneratedOpportunityResult);

    await expect(service.generateForUser(user, request())).rejects.toMatchObject({
      code: "AI_RESPONSE_INVALID",
      providerDiagnostic: {
        failure: "SCHEMA_VALIDATION_FAILED",
        schemaValidationOutcome: "FAILED",
        groundingValidationOutcome: "NOT_RUN",
      },
    });
    expect(mocks.generate).toHaveBeenCalledOnce();
    expect(mocks.openEvidence).toHaveBeenCalledOnce();
    expect(mocks.openEvidence.mock.results[0]?.value).toEqual(evidence);
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("rejects duplicate insufficient-evidence gap references without persistence", async () => {
    const { service, user } = createService("80000000-0000-4000-8000-000000000083");
    mocks.generate.mockImplementationOnce(async (input: { prompt: string }) => {
      const gap = generationContextFromPrompt(input.prompt).eligibleEvidenceGaps.find((item) => item.code === "CUSTOMER_VALIDATION_REQUIRED");
      if (!gap) throw new Error("Synthetic hybrid catalog is missing the expected gap.");
      return hybridGeneratedOpportunityResultSchema.parse({ outcome: "INSUFFICIENT_EVIDENCE", evidenceGapRefs: [gap.ref, gap.ref] });
    });

    await expect(service.generateForUser(user, request())).rejects.toMatchObject({
      code: "AI_RESPONSE_INVALID",
      providerDiagnostic: { rejectedRule: "INVALID_EVIDENCE_GAP_REFERENCE", groundingValidationOutcome: "FAILED", schemaValidationOutcome: "PASSED" },
    });
    expect(mocks.generate).toHaveBeenCalledOnce();
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("rejects an unknown insufficient-evidence gap reference without persistence", async () => {
    const { service, user } = createService("80000000-0000-4000-8000-000000000084");
    mocks.generate.mockImplementationOnce(async (input: { prompt: string }) => {
      const context = generationContextFromPrompt(input.prompt);
      return hybridGeneratedOpportunityResultSchema.parse({
        outcome: "INSUFFICIENT_EVIDENCE",
        evidenceGapRefs: [{ catalogId: context.catalogId, gapId: "gapref_ffffffffffffffffffffffff" }],
      });
    });

    await expect(service.generateForUser(user, request())).rejects.toMatchObject({
      code: "AI_RESPONSE_INVALID",
      providerDiagnostic: { rejectedRule: "INVALID_EVIDENCE_GAP_REFERENCE", groundingValidationOutcome: "FAILED", schemaValidationOutcome: "PASSED" },
    });
    expect(mocks.generate).toHaveBeenCalledOnce();
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("rejects evidence that expires while inference is in progress", async () => {
    let currentTime = now;
    const { service, user } = createService("80000000-0000-4000-8000-000000000066", environment, USER_TYPES.UMKM_EXISTING, () => currentTime);
    mocks.generate.mockImplementationOnce(async (input: { prompt: string }) => {
      currentTime = new Date(evidence.expiresAt);
      return validTypedOutput(input.prompt);
    });
    await expect(service.generateForUser(user, request())).rejects.toMatchObject({
      code: "AI_RESPONSE_INVALID",
      providerDiagnostic: { failure: "STALE_EVIDENCE_REFERENCE", rejectedRule: "STALE_EVIDENCE_REFERENCE" },
    });
    expect(mocks.createMany).not.toHaveBeenCalled();
    expect(mocks.openEvidence).toHaveBeenCalledOnce();
  });

  it("keeps the selected source available after a grounding rejection", async () => {
    const { service, user } = createService("80000000-0000-4000-8000-000000000067");
    useGenerated((output) => updateFirstIdea(output, (idea) => ({
      ...idea,
      narrative: { ...idea.narrative, concept: "Konsep ini akan menjamin keuntungan dan pasti laris." },
    })));
    await expect(service.generateForUser(user, request())).rejects.toMatchObject({ code: "AI_RESPONSE_INVALID" });
    expect(mocks.openEvidence).toHaveBeenCalledOnce();
    expect(mocks.openEvidence.mock.results[0]?.value).toEqual(evidence);
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("preserves the existing timeout and no-retry behavior", async () => {
    const { service, user } = createService("80000000-0000-4000-8000-000000000068");
    mocks.generate.mockRejectedValue(new NineRouterError("TIMEOUT", null, true));
    await expect(service.generateForUser(user, request())).rejects.toMatchObject({
      code: "AI_UPSTREAM_UNAVAILABLE",
      providerDiagnostic: { category: "TIMEOUT", outboundAttempted: true, groundingValidationOutcome: "NOT_RUN" },
    });
    expect(mocks.generate).toHaveBeenCalledOnce();
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("blocks concurrent generation for one owner while the first inference is pending", async () => {
    const { service, user } = createService("80000000-0000-4000-8000-000000000069");
    let resolveGeneration!: (value: HybridGeneratedOpportunityResult) => void;
    mocks.generate.mockReturnValueOnce(new Promise<HybridGeneratedOpportunityResult>((resolve) => { resolveGeneration = resolve; }));
    const first = service.generateForUser(user, request());
    await vi.waitFor(() => expect(mocks.generate).toHaveBeenCalledOnce());
    await expect(service.generateForUser(user, request())).rejects.toMatchObject({ code: "AI_RATE_LIMITED" });
    const prompt = mocks.generate.mock.calls[0]?.[0].prompt as string;
    resolveGeneration(validTypedOutput(prompt));
    await first;
    expect(mocks.createMany).toHaveBeenCalledOnce();
  });

  it("rejects an expired source token before provider work", async () => {
    const { service, user } = createService("80000000-0000-4000-8000-000000000070");
    mocks.openEvidence.mockReturnValue({ ...evidence, retrievedAt: new Date(now.getTime() - 60_000).toISOString(), expiresAt: now.toISOString() });
    await expect(service.generateForUser(user, request())).rejects.toMatchObject({ code: "SOURCE_SIGNAL_UNAVAILABLE" });
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("keeps profile availability aligned for nullable entrepreneur fields", async () => {
    const entrepreneur = entrepreneurProfile.profile as Extract<BuiltOpportunityProfileContext["profile"], { persona: "ENTREPRENEUR" }>;
    const profileWithNulls: BuiltOpportunityProfileContext = {
      profile: { ...entrepreneur, experienceLevel: null, timeCommitment: null },
      dataAvailability: {
        profileFieldsPresent: entrepreneurProfile.dataAvailability.profileFieldsPresent.filter((field) => field !== "profile.experienceLevel" && field !== "profile.timeCommitment"),
        profileFieldsMissing: ["profile.notes", "profile.experienceLevel", "profile.timeCommitment"],
      },
    };
    const { service, user } = createService("80000000-0000-4000-8000-000000000071", environment, USER_TYPES.ENTREPRENEUR);
    mocks.buildProfile.mockResolvedValue(profileWithNulls);
    await service.generateForUser(user, request());
    const context = generationContextFromPrompt(mocks.generate.mock.calls[0]?.[0].prompt as string);
    expect(context.profileAvailability.missing).toEqual(expect.arrayContaining(["profile.experienceLevel", "profile.timeCommitment"]));
    expect(context.facts.some((fact) => fact.subject.label === "Pengalaman")).toBe(false);
    expect(context.facts.some((fact) => fact.subject.label === "Komitmen waktu")).toBe(false);
  });
});
