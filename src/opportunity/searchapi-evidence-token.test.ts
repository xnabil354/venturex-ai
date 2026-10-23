import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  isSearchApiEvidenceTokenConfigured,
  openSearchApiOpportunityEvidence,
  sealSearchApiOpportunityEvidence,
  SearchApiEvidenceTokenError,
} from "./searchapi-evidence-token";
import type { SearchApiOpportunityEvidence } from "./searchapi-evidence-contract";

const now = new Date("2026-10-18T04:00:00.000Z");
const environment = { AUTH_SECRET: "test-auth-secret-for-searchapi-evidence-token-2026" };
const evidence: SearchApiOpportunityEvidence = {
  sourceType: "RELATED_QUERY_RISING",
  productQuery: "Kopi",
  query: "kopi susu gula aren",
  position: 1,
  interestIndex: null,
  growthLabel: "Breakout",
  growthPercent: null,
  isBreakout: true,
  geo: "US-CA",
  period: "24h",
  providerTime: "now 1-d",
  searchProperty: "web",
  retrievedAt: now.toISOString(),
  expiresAt: new Date(now.getTime() + 5 * 60_000).toISOString(),
  publisher: "Google Trends",
  provider: "SearchApi.io",
  url: "https://trends.google.com/trends/explore?geo=US-CA&date=now+1-d&q=Kopi",
  providerSourceUrl: null,
};

describe("SearchApi opportunity source token", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("encrypts normalized evidence and binds it to one owner", () => {
    const token = sealSearchApiOpportunityEvidence({ userId: "80000000-0000-4000-8000-000000000001", evidence, env: environment, now });

    expect(token).not.toContain(evidence.query);
    expect(openSearchApiOpportunityEvidence({ userId: "80000000-0000-4000-8000-000000000001", token, env: environment, now })).toEqual(evidence);
    expect(openSearchApiOpportunityEvidence({ userId: "80000000-0000-4000-8000-000000000002", token, env: environment, now })).toBeNull();
  });

  it("rejects modified, malformed, and expired tokens", () => {
    const token = sealSearchApiOpportunityEvidence({ userId: "80000000-0000-4000-8000-000000000001", evidence, env: environment, now });
    const altered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");

    expect(openSearchApiOpportunityEvidence({ userId: "80000000-0000-4000-8000-000000000001", token: altered, env: environment, now })).toBeNull();
    expect(openSearchApiOpportunityEvidence({ userId: "80000000-0000-4000-8000-000000000001", token: "not-a-token", env: environment, now })).toBeNull();
    expect(openSearchApiOpportunityEvidence({
      userId: "80000000-0000-4000-8000-000000000001",
      token,
      env: environment,
      now: new Date(now.getTime() + 5 * 60_000),
    })).toBeNull();
  });

  it("requires a non-template Auth.js secret before any source token can be issued", () => {
    expect(isSearchApiEvidenceTokenConfigured(environment)).toBe(true);
    expect(isSearchApiEvidenceTokenConfigured({ AUTH_SECRET: "replace-with-a-local-random-secret" })).toBe(false);
    expect(isSearchApiEvidenceTokenConfigured({ AUTH_SECRET: "short" })).toBe(false);
    expect(() => sealSearchApiOpportunityEvidence({
      userId: "80000000-0000-4000-8000-000000000001",
      evidence,
      env: { AUTH_SECRET: "replace-with-a-local-random-secret" },
      now,
    })).toThrow(SearchApiEvidenceTokenError);
  });
});
