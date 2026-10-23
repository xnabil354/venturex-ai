import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ONBOARDING_STATUSES, USER_TYPES, userIdSchema, type SafeUser } from "@/auth/user-types";
import { SearchApiTrendsError } from "./searchapi-google-trends";
import { createTrendRadarInterestPOST, createTrendRadarRelatedQueriesPOST } from "./trend-radar-route-handler";

const user: SafeUser = {
  id: userIdSchema.parse("80000000-0000-4000-8000-000000000010"),
  email: "test@example.test",
  userType: USER_TYPES.ENTREPRENEUR,
  onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
};
const successData = {
  provider: "SearchApi.io",
  retrievedAt: "2026-10-17T12:00:00.000Z",
  cacheStatus: "NETWORK",
  appliedFilters: {
    period: "24h",
    time: "now 1-d",
    property: "web",
    geo: "",
    category: 0,
    timezoneOffsetMinutes: -420,
    timezone: "Asia/Jakarta",
  },
  productQuery: "Soto Ayam",
  top: [],
  rising: [],
  omittedInvalidRows: { top: 0, rising: 0 },
  requestId: "req_test",
};

function post(body: unknown, origin = "http://localhost:3000"): Request {
  return new Request("http://localhost:3000/api/v1/trend-radar/related-queries", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/trend-radar/related-queries handler", () => {
  it("requires authentication and completed onboarding before service access", async () => {
    const service = { getRelatedQueries: vi.fn().mockResolvedValue(successData) };
    const unauthenticated = createTrendRadarRelatedQueriesPOST({ resolveUser: async () => null, service });
    expect((await unauthenticated(post({ period: "24h", property: "web" }))).status).toBe(401);
    expect(service.getRelatedQueries).not.toHaveBeenCalled();

    const incomplete = createTrendRadarRelatedQueriesPOST({
      resolveUser: async () => ({ ...user, onboardingStatus: ONBOARDING_STATUSES.PROFILE_IN_PROGRESS }),
      service,
    });
    const response = await incomplete(post({ period: "24h", property: "web" }));
    expect(response.status).toBe(422);
    expect(service.getRelatedQueries).not.toHaveBeenCalled();
  });

  it("rejects cross-origin requests and any client supplied q or identity", async () => {
    const service = { getRelatedQueries: vi.fn().mockResolvedValue(successData) };
    const handler = createTrendRadarRelatedQueriesPOST({ resolveUser: async () => user, service });
    expect((await handler(post({ period: "24h", property: "web" }, "https://attacker.example"))).status).toBe(403);
    expect((await handler(post({ period: "24h", property: "web", q: "client keyword" }))).status).toBe(400);
    expect((await handler(post({ period: "24h", property: "web", userId: user.id }))).status).toBe(400);
    expect(service.getRelatedQueries).not.toHaveBeenCalled();
  });

  it("uses only the authenticated user identity, validates the request, and returns the shared error envelope", async () => {
    const service = { getRelatedQueries: vi.fn().mockResolvedValue(successData) };
    const handler = createTrendRadarRelatedQueriesPOST({ resolveUser: async () => user, service });
    const response = await handler(post({ period: "24h", property: "shopping" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-request-id")).toMatch(/^req_/u);
    expect(service.getRelatedQueries).toHaveBeenCalledOnce();
    expect(service.getRelatedQueries).toHaveBeenCalledWith(user.id, USER_TYPES.ENTREPRENEUR, { period: "24h", property: "shopping", geo: "" }, expect.stringMatching(/^req_/u));
    expect(await response.json()).toMatchObject({ success: true, data: successData, requestId: expect.stringMatching(/^req_/u) });

    const invalid = await handler(post({ period: "24h", property: "unknown" }));
    expect(invalid.status).toBe(400);
    expect(service.getRelatedQueries).toHaveBeenCalledOnce();

    const unsupportedGeo = await handler(post({ period: "24h", property: "web", geo: "INVALID" }));
    expect(unsupportedGeo.status).toBe(400);
    expect(service.getRelatedQueries).toHaveBeenCalledOnce();
  });

  it("maps provider quota and timeout errors without exposing provider details", async () => {
    const quota = createTrendRadarRelatedQueriesPOST({
      resolveUser: async () => user,
      service: { getRelatedQueries: vi.fn().mockRejectedValue(new SearchApiTrendsError("PROVIDER_QUOTA_EXCEEDED")) },
    });
    const quotaResponse = await quota(post({ period: "24h", property: "web" }));
    expect(quotaResponse.status).toBe(503);
    expect(JSON.stringify(await quotaResponse.json())).not.toMatch(/api.?key|authorization|secret/iu);

    const timeout = createTrendRadarRelatedQueriesPOST({
      resolveUser: async () => user,
      service: { getRelatedQueries: vi.fn().mockRejectedValue(new SearchApiTrendsError("PROVIDER_TIMEOUT")) },
    });
    expect((await timeout(post({ period: "24h", property: "web" }))).status).toBe(504);
  });
});

describe("POST /api/v1/trend-radar/interest handler", () => {
  it("shares same-origin, authenticated, strict-filter behavior and allows per-dataset failures in a success envelope", async () => {
    const data = {
      provider: "SearchApi.io",
      productQuery: "Soto Ayam",
      appliedFilters: { period: "24h", time: "now 1-d", property: "web", geo: "", category: 0, timezoneOffsetMinutes: -420, timezone: "Asia/Jakarta" },
      timeSeries: null,
      regionalInterest: null,
      availability: { timeSeries: "failed", regionalInterest: "failed" },
      datasets: {
        timeSeries: { status: null, retrievedAt: null, error: { code: "REQUEST_BUDGET_EXCEEDED", message: "Batas permintaan tercapai." } },
        regionalInterest: { status: null, retrievedAt: null, error: { code: "REQUEST_BUDGET_EXCEEDED", message: "Batas permintaan tercapai." } },
      },
      requestId: "req_interest",
    };
    const service = { getInterest: vi.fn().mockResolvedValue(data) };
    const handler = createTrendRadarInterestPOST({ resolveUser: async () => user, service });
    const response = await handler(post({ period: "24h", property: "web" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { availability: { timeSeries: "failed", regionalInterest: "failed" } } });
    expect(service.getInterest).toHaveBeenCalledWith(user.id, USER_TYPES.ENTREPRENEUR, { period: "24h", property: "web", geo: "" }, expect.stringMatching(/^req_/u));
    expect((await handler(post({ period: "24h", property: "web", q: "other" }))).status).toBe(400);
    expect((await handler(post({ period: "24h", property: "web" }, "https://attacker.example"))).status).toBe(403);
    expect(service.getInterest).toHaveBeenCalledOnce();
  });
});
