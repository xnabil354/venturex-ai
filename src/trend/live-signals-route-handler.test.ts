import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ONBOARDING_STATUSES, USER_TYPES, userIdSchema, type SafeUser } from "@/auth/user-types";
import { TrendSignalAnalysisError } from "@/ai-analysis/trend-signal-analysis";
import { createLiveTrendSignalsAnalysisPOST, createLiveTrendSignalsRefreshPOST } from "./live-signals-route-handler";

const user: SafeUser = {
  id: userIdSchema.parse("80000000-0000-4000-8000-000000000010"),
  email: "test@example.test",
  userType: USER_TYPES.ENTREPRENEUR,
  onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
};

function post(path: string, body?: unknown): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("authenticated Trend live routes", () => {
  it("keeps upstream 9Router diagnosis sanitized and attributable to one request ID", async () => {
    const generate = vi.fn().mockRejectedValue(new TrendSignalAnalysisError("AI_UPSTREAM_UNAVAILABLE", 60, {
      category: "UPSTREAM_UNAVAILABLE",
      upstreamStatus: 503,
      outboundAttempted: true,
    }));
    const handler = createLiveTrendSignalsAnalysisPOST({
      resolveUser: async () => user,
      service: { generate },
    });
    const response = await handler(post("/api/v1/trends/live-signals/analysis", {
      snapshotId: "80000000-0000-4000-8000-000000000001",
      signalId: "80000000-0000-4000-8000-000000000002",
      consent: true,
      disclosureVersion: "trends-ninerouter-profile-v2",
    }));

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-request-id")).toMatch(/^req_/u);
    const payload = await response.json();
    expect(payload).toMatchObject({
      error: {
        code: "AI_UPSTREAM_UNAVAILABLE",
        providerDiagnostic: { category: "UPSTREAM_UNAVAILABLE", upstreamStatus: 503, outboundAttempted: true },
      },
    });
    expect(JSON.stringify(payload)).not.toMatch(/api.?key|authorization|prompt|private response/iu);
    expect(generate).toHaveBeenCalledOnce();
  });

  it("runs Trend Insight without a billing-credit wrapper", async () => {
    const generate = vi.fn().mockResolvedValue({ summary: "Sinyal siap ditinjau." });
    const handler = createLiveTrendSignalsAnalysisPOST({
      resolveUser: async () => user,
      service: { generate },
    });

    const response = await handler(post("/api/v1/trends/live-signals/analysis", {
      snapshotId: "80000000-0000-4000-8000-000000000001",
      signalId: "80000000-0000-4000-8000-000000000002",
      consent: true,
      disclosureVersion: "trends-ninerouter-profile-v2",
    }));

    expect(response.status).toBe(200);
    expect(generate).toHaveBeenCalledOnce();
    expect(generate).toHaveBeenCalledWith(user, expect.any(Object), expect.stringMatching(/^req_/u));
  });

  it("routes a user-authorized explicit refresh through the service only after origin and role checks", async () => {
    const refresh = vi.fn().mockResolvedValue({ snapshotId: "80000000-0000-4000-8000-000000000001" });
    const handler = createLiveTrendSignalsRefreshPOST({ resolveUser: async () => user, service: { refresh } });
    const response = await handler(post("/api/v1/trends/live-signals/refresh?hours=168"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(refresh).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledWith(user.id, 168);
  });

  it("rejects unsupported time windows before reaching the service", async () => {
    const refresh = vi.fn();
    const handler = createLiveTrendSignalsRefreshPOST({ resolveUser: async () => user, service: { refresh } });
    const response = await handler(post("/api/v1/trends/live-signals/refresh?hours=5"));

    expect(response.status).toBe(400);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("rejects cross-origin refresh before the provider service is reached", async () => {
    const refresh = vi.fn();
    const handler = createLiveTrendSignalsRefreshPOST({ resolveUser: async () => user, service: { refresh } });
    const request = post("/api/v1/trends/live-signals/refresh");
    const crossOrigin = new Request(request, { headers: { host: "localhost:3000", origin: "https://attacker.example" } });
    const response = await handler(crossOrigin);

    expect(response.status).toBe(403);
    expect(refresh).not.toHaveBeenCalled();
  });
});
