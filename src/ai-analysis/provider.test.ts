import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildOpportunityAnalysisProviderContext, readAIAnalysisProviderConfig } from "./provider";
import { NINEROUTER_LOOPBACK_TUNNEL_FLAG, NINEROUTER_PROVIDER, NINEROUTER_REQUESTED_MODEL } from "./ninerouter";
import { testAnalysisContext } from "./test-fixtures";

const validEnv = {
  AI_PROVIDER: NINEROUTER_PROVIDER,
  NINEROUTER_BASE_URL: "https://router.example.test/v1",
  NINEROUTER_API_KEY: "synthetic-test-key",
  NINEROUTER_MODEL: NINEROUTER_REQUESTED_MODEL,
};

describe("9Router server configuration and context projection", () => {
  it("requires an exact selected provider/model and HTTPS endpoint", () => {
    expect(readAIAnalysisProviderConfig(validEnv)).toMatchObject({
      provider: NINEROUTER_PROVIDER,
      baseURL: "https://router.example.test/v1",
      model: NINEROUTER_REQUESTED_MODEL,
    });
    expect(readAIAnalysisProviderConfig({ ...validEnv, NINEROUTER_BASE_URL: "http://72.62.247.63:20128/v1" })).toBeNull();
    expect(readAIAnalysisProviderConfig({ ...validEnv, NINEROUTER_MODEL: "some-other-model" })).toBeNull();
    expect(readAIAnalysisProviderConfig({ ...validEnv, AI_PROVIDER: "gemini" })).toBeNull();
  });

  it("permits HTTP only on explicitly confirmed loopback tunnel", () => {
    const local = { ...validEnv, NINEROUTER_BASE_URL: "http://127.0.0.1:20128/v1" };
    expect(readAIAnalysisProviderConfig(local)).toBeNull();
    expect(readAIAnalysisProviderConfig({ ...local, [NINEROUTER_LOOPBACK_TUNNEL_FLAG]: "true" }))
      .toMatchObject({ baseURL: "http://127.0.0.1:20128/v1" });
    expect(readAIAnalysisProviderConfig({ ...local, [NINEROUTER_LOOPBACK_TUNNEL_FLAG]: "true", NINEROUTER_BASE_URL: "http://localhost:20128/v1" })).toBeNull();
  });

  it.each(["ENTREPRENEUR", "UMKM_EXISTING"] as const)("sends only approved profile fields for %s", (userType) => {
    const payload = JSON.stringify(buildOpportunityAnalysisProviderContext(testAnalysisContext(userType)));
    expect(payload).toContain(userType);
    expect(payload).toContain("Mahasiswa");
    expect(payload).toContain("Gerai");
    expect(payload).not.toContain("Kota Contoh");
    expect(payload).not.toContain("Deskripsi synthetic usaha");
    expect(payload).not.toContain("budgetIdr");
    expect(payload).not.toContain("averagePriceIdr");
    expect(payload).not.toContain("priceIdr");
    expect(payload).not.toContain("synthetic-user@example.test");
    expect(payload).not.toContain("10000000-0000");
  });

  it("does not mutate the trusted context while projecting it", () => {
    const context = testAnalysisContext();
    const before = structuredClone(context);
    buildOpportunityAnalysisProviderContext(context);
    expect(context).toEqual(before);
  });
});
