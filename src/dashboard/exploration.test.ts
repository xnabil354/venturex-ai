import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/auth/current-user", () => ({ getCurrentUser: vi.fn() }));

import { parseUserId, type SafeUser } from "@/auth/user-types";
import type { PrivateOpportunityIdeaDto } from "@/opportunity/private-hypothesis";
import { loadDashboardExploration } from "./exploration";

const user: SafeUser = { id: parseUserId("80000000-0000-4000-8000-000000000011"), email: "unused@example.test", userType: "UMKM_EXISTING", onboardingStatus: "COMPLETED" };
function idea(id: string, saved = false, query = "kopi susu", geo = "ID"): PrivateOpportunityIdeaDto {
  return {
    id, saved, generatedAt: "2026-10-20T08:00:00.000Z", provider: "ninerouter", model: "test",
    hypothesis: { title: "Uji kopi susu", concept: "Coba konsep kopi susu dalam uji kecil di gerai.", targetCustomer: "Pelanggan sekitar", validationSteps: ["Tanyakan pilihan pelanggan", "Catat hasil uji rasa"], assumptions: ["Pelanggan tertarik mencoba"] },
    source: { transport: "SearchApi.io", provider: "SearchApi.io", publisher: "Google Trends", sourceType: "RELATED_QUERY_TOP", productQuery: "Kopi", query, geo, period: "24h", providerTime: "now 1-d", searchProperty: "web", retrievedAt: "2026-10-20T07:00:00.000Z", expiresAt: "2026-10-20T07:05:00.000Z", interestIndex: 80, growthLabel: null, growthPercent: null, isBreakout: false, position: 1, url: "https://trends.google.com/trends/explore?q=kopi", providerSourceUrl: null },
  };
}

describe("dashboard exploration", () => {
  it.each(["ENTREPRENEUR", "UMKM_EXISTING"] as const)("reads the authenticated %s account and keeps real hypothesis anchors", async userType => {
    const records = Array.from({ length: 5 }, (_, i) => idea(`id-${i}`, i === 0));
    const listIdeas = vi.fn(async (_id: string, _userType: "ENTREPRENEUR" | "UMKM_EXISTING", savedOnly?: boolean) => savedOnly ? [records[0]!] : records);
    const result = await loadDashboardExploration({ ...user, userType }, "Kopi", { listIdeas, listRoadmaps: async () => ({ totalCount: 1 }) });
    expect(listIdeas).toHaveBeenCalledWith(user.id, userType, false);
    expect(listIdeas).toHaveBeenCalledWith(user.id, userType, true);
    expect(result.opportunities.preview).toHaveLength(3);
    expect(result.opportunities.preview[0]?.href).toBe("/opportunities#hypothesis-id-0");
    expect(result.savedOpportunities.preview[0]?.href).toBe("/saved#hypothesis-id-0");
    expect(result.roadmap.status).toBe("AVAILABLE");
    expect(result.trends.preview).toHaveLength(1);
    expect(result.trends.preview[0]?.summary).toBe("Indeks minat 80/100");
    expect(result.trends.observedAt).toBe("2026-10-20T07:00:00.000Z");
  });

  it("does not mix regions, retrievals or another profile product", async () => {
    const older = idea("b", false, "older observation");
    const olderSource = { ...older.source, retrievedAt: "2026-10-19T07:00:00.000Z" };
    const records = [idea("a"), { ...older, source: olderSource }, idea("c", false, "coffee", "US")];
    const deps = { listIdeas: async () => records, listRoadmaps: async () => ({ totalCount: 0 }) };
    expect((await loadDashboardExploration(user, "Kopi", deps)).trends.preview).toHaveLength(1);
    expect((await loadDashboardExploration(user, "Soto", deps)).trends.status).toBe("EMPTY");
  });

  it("orders hypotheses by generation time instead of relying on repository order", async () => {
    const result = await loadDashboardExploration(user, "Kopi", {
      listIdeas: async () => [idea("old"), { ...idea("new"), generatedAt: "2026-10-21T07:00:00.000Z" }],
      listRoadmaps: async () => ({ totalCount: 0 }),
    });
    expect(result.opportunities.preview.map(item => item.id)).toEqual(["new", "old"]);
  });

  it("loads older saved ideas independently and isolates module failures", async () => {
    const result = await loadDashboardExploration(user, "Kopi", {
      listIdeas: async (_id, _userType, savedOnly) => savedOnly ? [idea("older-saved", true)] : Promise.reject(new Error("private database failure")),
      listRoadmaps: async () => ({ totalCount: 0 }),
    });
    expect(result.opportunities.status).toBe("ERROR");
    expect(result.savedOpportunities.status).toBe("AVAILABLE");
    expect(result.roadmap.status).toBe("EMPTY");
    expect(JSON.stringify(result)).not.toContain("private database failure");
  });

  it("keeps honest empty states without inventing previews", async () => {
    const result = await loadDashboardExploration(user, "Kopi", { listIdeas: async () => [], listRoadmaps: async () => ({ totalCount: 0 }) });
    expect(Object.values(result).every(module => module.status === "EMPTY")).toBe(true);
  });
});
