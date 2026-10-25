import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ user: vi.fn(), find: vi.fn(), progress: vi.fn(), update: vi.fn(), list: vi.fn(), dashboard: vi.fn(), pdf: vi.fn() }));
vi.mock("@/auth/current-user", () => ({ getCurrentUser: mocks.user }));
vi.mock("./repository", () => ({ JourneyStateError: class extends Error {}, JourneyRepository: class { find = mocks.find; progress = mocks.progress; update = mocks.update; list = mocks.list; } }));
vi.mock("@/dashboard/service", () => ({ DashboardQueryService: class { get = mocks.dashboard; } }));
vi.mock("./export", () => ({ exportPdf: mocks.pdf }));
import { journeyHttp } from "./http";
const id = "90000000-0000-4000-8000-000000000021";
const request = () => new Request(`https://venturex.test/api/v1/reports/journeys/${id}?format=pdf`);
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => { vi.clearAllMocks(); mocks.user.mockResolvedValue({ id: "owner", userType: "UMKM_EXISTING", onboardingStatus: "COMPLETED" }); mocks.find.mockResolvedValue({ id }); mocks.progress.mockResolvedValue({ complete: false }); });
describe("journey export authorization", () => {
  it.each([true, false])("persists a roadmap checkbox behind production HTTPS (completed=%s)", async completed => {
    vi.stubEnv("APP_URL", "https://venturex.web.id");
    mocks.user.mockResolvedValue({ id: "owner", userType: "ENTREPRENEUR", onboardingStatus: "COMPLETED" });
    mocks.update.mockResolvedValue(true);
    const input = { stage: 6, completed, fingerprint: "a".repeat(64) };
    const response = await journeyHttp(new Request(`https://0.0.0.0:3000/api/v1/reports/journeys/${id}/progress`, {
      method: "PATCH", headers: { origin: "https://venturex.web.id", host: "venturex.web.id" }, body: JSON.stringify(input),
    }), id, true);
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith("owner", "ENTREPRENEUR", id, input);
  });
  it("requires authentication", async () => { mocks.user.mockResolvedValue(null); expect((await journeyHttp(request(), id)).status).toBe(401); expect(mocks.find).not.toHaveBeenCalled(); });
  it("never exports partial completion even if called directly", async () => { expect((await journeyHttp(request(), id)).status).toBe(409); expect(mocks.pdf).not.toHaveBeenCalled(); });
  it("returns no data for another owner's opportunity", async () => { mocks.find.mockResolvedValue(null); expect((await journeyHttp(request(), id)).status).toBe(404); expect(mocks.find).toHaveBeenCalledWith("owner", "UMKM_EXISTING", id); expect(mocks.progress).not.toHaveBeenCalled(); });
  it("rejects forged origins before updating", async () => { const response = await journeyHttp(new Request(request().url, { method: "PATCH", headers: { origin: "https://evil.test" }, body: "{}" }), id, true); expect(response.status).toBe(403); expect(mocks.update).not.toHaveBeenCalled(); });
  it("bounds the stage contract and rejects extra properties", async () => { const response = await journeyHttp(new Request(request().url, { method: "PATCH", headers: { origin: "https://venturex.test" }, body: JSON.stringify({ stage: 7, completed: true, fingerprint: "a".repeat(64) }) }), id, true); expect(response.status).toBe(400); expect(mocks.update).not.toHaveBeenCalled(); });
});
