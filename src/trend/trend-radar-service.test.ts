import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  entrepreneurProfile: vi.fn(),
  businessProfile: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/profile/service", () => ({
  EntrepreneurProfileService: class {
    getForEdit(userId: string) { return mocks.entrepreneurProfile(userId); }
  },
}));
vi.mock("@/profile/business-service", () => ({
  BusinessProfileService: class {
    getForEdit(userId: string) { return mocks.businessProfile(userId); }
  },
}));

import { USER_TYPES, userIdSchema } from "@/auth/user-types";
import { SearchApiTrendsError, type SearchApiGoogleTrendsAdapter } from "./searchapi-google-trends";
import { resolveTrendRadarProfileQuery, TrendRadarService } from "./trend-radar-service";

const userId = userIdSchema.parse("80000000-0000-4000-8000-000000000011");

describe("TrendRadarService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses EntrepreneurProfileService.preferredProductType for entrepreneurs", async () => {
    mocks.entrepreneurProfile.mockResolvedValue({ preferredProductType: "  Soto   Ayam " });
    expect(await resolveTrendRadarProfileQuery(userId, USER_TYPES.ENTREPRENEUR)).toBe("Soto Ayam");
    expect(mocks.entrepreneurProfile).toHaveBeenCalledWith(userId);
    expect(mocks.businessProfile).not.toHaveBeenCalled();
  });

  it("uses BusinessProfileService.businessName for UMKM, never products[0].name", async () => {
    mocks.businessProfile.mockResolvedValue({
      businessName: "Kopi",
      products: [{ name: "Matcha Latte" }],
    });
    expect(await resolveTrendRadarProfileQuery(userId, USER_TYPES.UMKM_EXISTING)).toBe("Kopi");
    expect(mocks.businessProfile).toHaveBeenCalledWith(userId);
    expect(mocks.entrepreneurProfile).not.toHaveBeenCalled();
  });
  it("resolves an explicitly selected current product without accepting arbitrary query text", async () => {
    mocks.businessProfile.mockResolvedValue({ businessName: "Kedai", products: [{ name: "Matcha Latte" }] });
    expect(await resolveTrendRadarProfileQuery(userId, USER_TYPES.UMKM_EXISTING, "product:0")).toBe("Matcha Latte");
    await expect(resolveTrendRadarProfileQuery(userId, USER_TYPES.UMKM_EXISTING, "product:19")).rejects.toMatchObject({ code: "PROFILE_INCOMPLETE" });
    await expect(resolveTrendRadarProfileQuery(userId, USER_TYPES.ENTREPRENEUR, "product:0")).rejects.toMatchObject({ code: "PROFILE_INCOMPLETE" });
  });

  it("passes the authenticated profile query and server-owned request to SearchApi", async () => {
    const relatedQueries = vi.fn().mockResolvedValue({
      top: [],
      rising: [],
      retrievedAt: "2026-10-17T12:00:00.000Z",
      cacheStatus: "NETWORK",
      time: "now 1-d",
      omittedInvalidRows: { top: 0, rising: 0 },
    });
    const provider = { relatedQueries } as unknown as SearchApiGoogleTrendsAdapter;
    const service = new TrendRadarService(provider, async () => "Kopi", () => new Date("2026-10-17T12:00:00.000Z"));
    const result = await service.getRelatedQueries(userId, USER_TYPES.UMKM_EXISTING, {
      period: "24h",
      property: "web",
    }, "req_profile");

    expect(relatedQueries).toHaveBeenCalledWith("Kopi", { period: "24h", property: "web" }, "now 1-d");
    expect(result).toMatchObject({
      provider: "SearchApi.io",
      productQuery: "Kopi",
      requestId: "req_profile",
      appliedFilters: { time: "now 1-d", timezone: "Asia/Jakarta", timezoneOffsetMinutes: -420 },
    });
  });

  it("fails closed for a missing persisted profile keyword", async () => {
    const provider = { relatedQueries: vi.fn() } as unknown as SearchApiGoogleTrendsAdapter;
    const service = new TrendRadarService(provider, async () => "  ");
    await expect(service.getRelatedQueries(userId, USER_TYPES.ENTREPRENEUR, { period: "24h", property: "web" }, "req_empty"))
      .rejects.toMatchObject({ code: "PROFILE_INCOMPLETE" });
    expect(provider.relatedQueries).not.toHaveBeenCalled();
  });

  it("keeps partial interest results and reports each dataset availability separately", async () => {
    const interestOverTime = vi.fn().mockResolvedValue({
      query: "Kopi",
      points: [],
      averageInterest: null,
      omittedInvalidPoints: 0,
      retrievedAt: "2026-10-17T12:00:00.000Z",
      time: "now 1-d",
      cacheStatus: "NETWORK",
    });
    const interestByRegion = vi.fn().mockRejectedValue(new SearchApiTrendsError("REQUEST_BUDGET_EXCEEDED"));
    const provider = { interestOverTime, interestByRegion } as unknown as SearchApiGoogleTrendsAdapter;
    const service = new TrendRadarService(provider, async () => "Kopi", () => new Date("2026-10-17T12:00:00.000Z"));
    const result = await service.getInterest(userId, USER_TYPES.UMKM_EXISTING, { period: "24h", property: "web" }, "req_partial");

    expect(interestOverTime).toHaveBeenCalledWith("Kopi", { period: "24h", property: "web" }, "now 1-d");
    expect(interestByRegion).toHaveBeenCalledWith("Kopi", { period: "24h", property: "web" }, "now 1-d");
    expect(result).toMatchObject({
      productQuery: "Kopi",
      requestId: "req_partial",
      availability: { timeSeries: "empty", regionalInterest: "failed" },
      timeSeries: { points: [], query: "Kopi" },
      regionalInterest: null,
      datasets: {
        timeSeries: { status: "NETWORK", retrievedAt: "2026-10-17T12:00:00.000Z", error: null },
        regionalInterest: { status: null, retrievedAt: null, error: { code: "REQUEST_BUDGET_EXCEEDED" } },
      },
    });
  });
});
