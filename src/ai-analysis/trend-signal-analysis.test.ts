import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ONBOARDING_STATUSES, USER_TYPES, userIdSchema, type SafeUser } from "../auth/user-types";
import type { LiveTrendSignal } from "../trend/live-signals-contract";
import { LiveSignalsError } from "../trend/live-signals";
import { TrendSignalAnalysisError, TrendSignalAnalysisService, type TrendSignalAnalysisInput } from "./trend-signal-analysis";
import type { OpportunityAnalysis } from "./domain";

const env = {
  AI_ANALYSIS_TRENDS_USER_INFERENCE_ENABLED: "true",
  AI_PROVIDER: "ninerouter",
  NINEROUTER_BASE_URL: "https://router.example.test/v1",
  NINEROUTER_API_KEY: "test-key-not-a-credential",
  NINEROUTER_MODEL: "cx/gpt-6-luna-xhigh",
};

const analysis: OpportunityAnalysis = {
  summary: "Sinyal pencarian ini dapat menjadi titik awal untuk meninjau minat terhadap minuman kopi susu.",
  whyRelevant: "Kategori produk yang Anda pilih mencakup minuman; hubungan ini hanya kecocokan kategori, bukan bukti permintaan.",
  targetConsumer: "Segmen yang Anda pilih dapat menjadi kelompok awal untuk diwawancarai, tetapi belum teruji oleh sinyal ini.",
  competition: "Sumber ini tidak memuat peta pesaing atau pangsa pasar.",
  potential: "Kemungkinan produk tetap hipotesis sampai diuji dengan calon pelanggan dan kondisi usaha setempat.",
  risks: ["Pencarian tidak membuktikan pembelian.", "Periode observasi dan unit metrik tidak diketahui."],
  nextAction: "Tanyakan kepada beberapa calon pelanggan bagaimana mereka memilih minuman sejenis dan catat alasan mereka.",
};

const user = (userType: "ENTREPRENEUR" | "UMKM_EXISTING"): SafeUser => ({
  id: userIdSchema.parse(randomUUID()),
  email: "private-account@example.test",
  userType,
  onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
});

const request = {
  snapshotId: "80000000-0000-4000-8000-000000000001",
  signalId: "80000000-0000-4000-8000-000000000002",
  consent: true as const,
  disclosureVersion: "trends-ninerouter-profile-v2" as const,
};

function liveSignal(): LiveTrendSignal {
  return {
    id: request.signalId,
    title: "kopi susu",
    classification: "LIKELY_FNB",
    matchedKeywords: ["kopi susu"],
    screeningExplanation: "Heuristic keyword match.",
    observationCount: 1,
    source: {
      publisher: "Google Trends",
      url: "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1",
      geo: "ID",
      retrievedAt: "2026-10-14T04:00:00.000Z",
      providerStartedAtUnixSeconds: 1_765_000_000,
      timeWindowHours: 24,
    },
    metrics: {
      volume: { availability: "AVAILABLE", value: "2K+", unit: "UNSPECIFIED" },
      volumeChange: { availability: "AVAILABLE", value: "+350%", unit: "UNSPECIFIED" },
      active: { value: true, semantics: "PROVIDER_FLAG_UNVERIFIED" },
      categoriesCount: 1,
      relatedQueries: "AVAILABLE",
    },
    limitations: ["heuristic only"],
  };
}

function resolvedSignal() {
  const candidate = {
    query: "kopi susu",
    classification: "LIKELY_FNB" as const,
    matchedKeywords: ["kopi susu"],
    explanation: "Keyword match.",
    observations: [
      {
        startedAtUnixSeconds: 1_765_000_000,
        active: true,
        volume: "2K+",
        volumeChange: "+350%",
        categories: ["category"],
        relatedQueries: { availability: "AVAILABLE" as const },
        geo: "ID" as const,
        provenance: {
          retrievedAt: "2026-10-14T04:00:00.000Z",
          sourceUrl: "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1",
        },
      },
    ],
  };
  return { snapshotId: request.snapshotId, signal: liveSignal(), candidate, freshness: "CURRENT" as const };
}

function profileContext(userType: "ENTREPRENEUR" | "UMKM_EXISTING") {
  return {
    persona: userType,
    productCategories: ["Minuman"],
    customerSegments: ["Pekerja"],
    salesChannels: ["Penjualan langsung online"],
    ...(userType === "ENTREPRENEUR" ? { experienceLevel: "BEGINNER" as const, timeCommitment: "PART_TIME" as const } : {}),
  };
}

describe("TrendSignalAnalysisService", () => {
  it.each([USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING])("uses the server-owned allowlist for %s", async (userType) => {
    const profileBuilder = { build: vi.fn(async () => profileContext(userType)) };
    let seenInput: TrendSignalAnalysisInput | undefined;
    const providerFactory = vi.fn(() => ({
      mode: "MOCK_TEST" as const,
      generate: vi.fn(async (input: TrendSignalAnalysisInput) => { seenInput = input; return analysis; }),
    }));
    const service = new TrendSignalAnalysisService({
      environment: env,
      profileBuilder,
      resolveSignal: () => resolvedSignal(),
      providerFactory,
      now: () => new Date("2026-10-14T04:05:00.000Z"),
    });
    const result = await service.generate(user(userType), request, "req_test");

    expect(result).toMatchObject({ provider: "ninerouter", model: "cx/gpt-6-luna-xhigh", mode: "MOCK_TEST", sourceReference: { title: "kopi susu" } });
    expect(seenInput?.profile).toEqual(profileContext(userType));
    expect(JSON.stringify(seenInput)).not.toContain("private-account@example.test");
    expect(JSON.stringify(seenInput)).not.toContain("location");
    expect(JSON.stringify(seenInput)).not.toContain("notes");
    expect(JSON.stringify(seenInput)).not.toContain("businessName");
    expect(JSON.stringify(seenInput)).not.toContain("productName");
    expect(JSON.stringify(seenInput)).not.toContain("budgetMin");
  });

  it("rejects unpaid or unverified data policy before profile lookup and provider invocation", async () => {
    for (const blockedEnv of [
      { ...env, AI_ANALYSIS_TRENDS_USER_INFERENCE_ENABLED: "false" },
      { ...env, NINEROUTER_BASE_URL: "http://72.62.247.63:20128/v1" },
    ]) {
      const profileBuilder = { build: vi.fn(async () => profileContext(USER_TYPES.ENTREPRENEUR)) };
      const providerFactory = vi.fn();
      const service = new TrendSignalAnalysisService({ environment: blockedEnv, profileBuilder, providerFactory });
      await expect(service.generate(user(USER_TYPES.ENTREPRENEUR), request, "req_blocked"))
        .rejects.toBeInstanceOf(TrendSignalAnalysisError);
      expect(profileBuilder.build).not.toHaveBeenCalled();
      expect(providerFactory).not.toHaveBeenCalled();
    }
  });

  it("requires explicit consent and a server-resolved snapshot owned by the caller", async () => {
    const providerFactory = vi.fn();
    const service = new TrendSignalAnalysisService({
      environment: env,
      resolveSignal: () => { throw new LiveSignalsError("SNAPSHOT_NOT_FOUND"); },
      providerFactory,
    });
    await expect(service.generate(user(USER_TYPES.ENTREPRENEUR), { ...request, consent: false } as never, "req_no_consent"))
      .rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
    await expect(service.generate(user(USER_TYPES.ENTREPRENEUR), request, "req_wrong_snapshot"))
      .rejects.toMatchObject({ code: "SNAPSHOT_NOT_FOUND" });
    expect(providerFactory).not.toHaveBeenCalled();
  });

  it("does not send stale provider observations to 9Router even if a client submits their IDs", async () => {
    const providerFactory = vi.fn();
    const profileBuilder = { build: vi.fn(async () => profileContext(USER_TYPES.ENTREPRENEUR)) };
    const service = new TrendSignalAnalysisService({
      environment: env,
      profileBuilder,
      resolveSignal: () => ({ ...resolvedSignal(), freshness: "STALE" }),
      providerFactory,
    });
    await expect(service.generate(user(USER_TYPES.ENTREPRENEUR), request, "req_stale"))
      .rejects.toMatchObject({ code: "INSUFFICIENT_DATA" });
    expect(profileBuilder.build).not.toHaveBeenCalled();
    expect(providerFactory).not.toHaveBeenCalled();
  });

  it("rejects invalid or unsupported numerical claims instead of returning them", async () => {
    const fabricated = { ...analysis, summary: "Sinyal ini membuktikan pertumbuhan 50% dan revenue tinggi." };
    const service = new TrendSignalAnalysisService({
      environment: env,
      profileBuilder: { build: async () => profileContext(USER_TYPES.ENTREPRENEUR) },
      resolveSignal: () => resolvedSignal(),
      providerFactory: () => ({ mode: "MOCK_TEST", generate: async () => fabricated }),
    });
    await expect(service.generate(user(USER_TYPES.ENTREPRENEUR), request, "req_invalid_output"))
      .rejects.toMatchObject({ code: "AI_RESPONSE_INVALID" });
  });

  it("requires a user action after a failed provider attempt and enforces the 60-second backoff", async () => {
    const providerFactory = vi.fn(() => ({
      mode: "MOCK_TEST" as const,
      generate: vi.fn(async () => { throw new TrendSignalAnalysisError("AI_UPSTREAM_UNAVAILABLE"); }),
    }));
    const testUser = user(USER_TYPES.UMKM_EXISTING);
    const service = new TrendSignalAnalysisService({
      environment: env,
      profileBuilder: { build: async () => profileContext(USER_TYPES.UMKM_EXISTING) },
      resolveSignal: () => resolvedSignal(),
      providerFactory,
      now: () => new Date("2026-10-14T06:00:00.000Z"),
    });

    await expect(service.generate(testUser, request, "req_first_failure"))
      .rejects.toMatchObject({ code: "AI_UPSTREAM_UNAVAILABLE" });
    await expect(service.generate(testUser, request, "req_early_manual_retry"))
      .rejects.toMatchObject({ code: "RATE_LIMITED", retryAfterSeconds: 60 });
    expect(providerFactory).toHaveBeenCalledOnce();
  });
});
