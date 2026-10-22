import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  signingConfigured: vi.fn(),
  listForUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/auth/current-user", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("@/opportunity/searchapi-evidence-token", () => ({
  isSearchApiEvidenceTokenConfigured: mocks.signingConfigured,
  SearchApiEvidenceTokenError: class extends Error {},
}));
vi.mock("@/opportunity/searchapi-opportunity-signal-service", () => ({
  SearchApiOpportunitySignalError: class extends Error {
    constructor(readonly code: string) { super(code); }
  },
  SearchApiOpportunitySignalService: class {
    listForUser(...args: unknown[]) { return mocks.listForUser(...args); }
  },
}));
vi.mock("@/trend/searchapi-google-trends", () => ({
  SearchApiTrendsError: class extends Error {
    constructor(readonly code: string, readonly upstreamStatus: number | null = null) { super(code); }
  },
}));
vi.mock("@/trend/trend-radar-service", () => ({
  TrendRadarServiceError: class extends Error {
    constructor(readonly code: string) { super(code); }
  },
}));

import { ONBOARDING_STATUSES, USER_TYPES, userIdSchema, type SafeUser } from "@/auth/user-types";
import { SearchApiTrendsError } from "@/trend/searchapi-google-trends";
import { POST } from "./route";

const user: SafeUser = {
  id: userIdSchema.parse("80000000-0000-4000-8000-000000000021"),
  email: "founder@example.test",
  userType: USER_TYPES.ENTREPRENEUR,
  onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
};

function post(body: string, origin = "http://localhost:3000", host = "localhost:3000") {
  return new Request(`http://${host}/api/v1/opportunities/signals`, {
    method: "POST",
    headers: { host, origin, "content-type": "application/json" },
    body,
  });
}

describe("POST /api/v1/opportunities/signals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentUser.mockResolvedValue(user);
    mocks.signingConfigured.mockReturnValue(true);
    mocks.listForUser.mockResolvedValue({
      provider: "SearchApi.io",
      productQuery: "Kopi",
      retrievedAt: "2026-10-18T04:00:00.000Z",
      appliedFilters: { period: "24h", time: "now 1-d", property: "web", geo: "" },
      top: [],
      rising: [],
    });
  });

  it("requires a same-origin filter request", async () => {
    const response = await POST(post('{"period":"24h","property":"web"}', "https://attacker.example"));
    expect(response.status).toBe(403);
    expect(mocks.listForUser).not.toHaveBeenCalled();
  });

  it.each(["NINEROUTER_ALLOW_PUBLIC_HTTP_DEV_ONLY", "NINEROUTER_ALLOW_LOOPBACK_HTTP_DEV_ONLY"])("keeps %s restricted to loopback request hosts", async (flag) => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv(flag, "true");
    const response = await POST(post('{"period":"24h","property":"web"}', "http://venturex.example:3000", "venturex.example:3000"));
    vi.unstubAllEnvs();

    expect(response.status).toBe(403);
    expect(mocks.listForUser).not.toHaveBeenCalled();
  });

  it("does not spend SearchApi budget if safe source-token signing is unavailable", async () => {
    mocks.signingConfigured.mockReturnValue(false);
    const response = await POST(post('{"period":"24h","property":"web"}'));
    expect(response.status).toBe(503);
    expect(mocks.listForUser).not.toHaveBeenCalled();
  });

  it("resolves the authenticated owner and forwards only validated Trend Radar filters", async () => {
    const response = await POST(post('{"period":"24h","property":"web"}'));
    const body = await response.json() as { data: unknown };
    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ provider: "SearchApi.io", appliedFilters: { geo: "" } });
    expect(mocks.listForUser).toHaveBeenCalledWith(user.id, USER_TYPES.ENTREPRENEUR, { period: "24h", property: "web", geo: "" }, expect.any(Function));
  });

  it("forwards selected international geographies and rejects unsupported codes", async () => {
    const selectedResponse = await POST(post('{"period":"24h","property":"web","geo":"US-CA"}'));
    expect(selectedResponse.status).toBe(200);
    expect(mocks.listForUser).toHaveBeenCalledWith(user.id, USER_TYPES.ENTREPRENEUR, { period: "24h", property: "web", geo: "US-CA" }, expect.any(Function));

    mocks.listForUser.mockClear();
    const invalid = await POST(post('{"period":"24h","property":"web","geo":"INVALID"}'));
    expect(invalid.status).toBe(400);
    expect(mocks.listForUser).not.toHaveBeenCalled();
  });

  it("rejects unknown request fields", async () => {
    const response = await POST(post('{"period":"24h","property":"web","query":"forged"}'));
    expect(response.status).toBe(400);
    expect(mocks.listForUser).not.toHaveBeenCalled();
  });

  it("returns provider quota errors instead of an empty success", async () => {
    mocks.listForUser.mockRejectedValue(new SearchApiTrendsError("PROVIDER_QUOTA_EXCEEDED", 402));
    const response = await POST(post('{"period":"24h","property":"web"}'));
    const body = await response.json() as { error: { code: string } };

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("PROVIDER_QUOTA_EXCEEDED");
  });
});
