import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), analyze: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/auth/current-user", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/opportunity/entrepreneur-analysis-service", () => ({
  EntrepreneurAnalysisError: class extends Error { constructor(readonly code: string) { super(code); } },
  EntrepreneurAnalysisService: class { analyze(...args: unknown[]) { return mocks.analyze(...args); } },
}));
import { POST } from "./route";
const id = "80000000-0000-4000-8000-000000000001";
const user = { id: "90000000-0000-4000-8000-000000000001", userType: "ENTREPRENEUR", onboardingStatus: "COMPLETED" };
function request(body = '{"consent":true}', origin = "http://localhost:3000") { return new Request(`http://localhost:3000/api/v1/opportunities/ideas/${id}/analysis`, { method: "POST", headers: { origin, "Content-Type": "application/json" }, body }); }
describe("private hypothesis deep-analysis route", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.user.mockResolvedValue(user); mocks.analyze.mockResolvedValue({ version: "entrepreneur-decision-v2" }); });
  it("blocks cross-origin and malformed-origin requests before reading identity", async () => {
    expect((await POST(request(undefined, "https://other.example"), { params: Promise.resolve({ id }) })).status).toBe(403);
    expect((await POST(request(undefined, "not a url"), { params: Promise.resolve({ id }) })).status).toBe(403);
    expect(mocks.user).not.toHaveBeenCalled(); expect(mocks.analyze).not.toHaveBeenCalled();
  });
  it("checks the actual request Host when Next uses an internal hostname", async () => {
    const valid = new Request(`http://localhost:3000/api/v1/opportunities/ideas/${id}/analysis`, { method: "POST", headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" }, body: '{"consent":true}' });
    expect((await POST(valid, { params: Promise.resolve({ id }) })).status).toBe(200);
    const invalid = new Request(valid.url, { method: "POST", headers: { host: "127.0.0.1:3000", origin: "http://attacker.example" }, body: '{"consent":true}' });
    expect((await POST(invalid, { params: Promise.resolve({ id }) })).status).toBe(403);
  });
  it("rejects unauthenticated and malformed-ID access without analysis", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await POST(request(), { params: Promise.resolve({ id }) })).status).toBe(401);
    expect((await POST(request(), { params: Promise.resolve({ id: "bad" }) })).status).toBe(400);
    expect(mocks.analyze).not.toHaveBeenCalled();
  });
  it("bounds chunked bodies and rejects invalid JSON", async () => {
    expect((await POST(request("{"), { params: Promise.resolve({ id }) })).status).toBe(400);
    expect((await POST(request(" ".repeat(2049)), { params: Promise.resolve({ id }) })).status).toBe(400);
    expect(mocks.analyze).not.toHaveBeenCalled();
  });
  it("passes only parsed input and authenticated identity to the analysis service", async () => {
    const response = await POST(request('{"consent":true,"capitalMin":500000}'), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(mocks.analyze).toHaveBeenCalledWith(user, id, { consent: true, capitalMin: 500000 }, expect.any(AbortSignal));
  });
});
