import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), create: vi.fn(), StateError: class extends Error {} }));
vi.mock("@/auth/current-user", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/opportunity/private-hypothesis-repository", () => ({ PrivateHypothesisStateError: mocks.StateError, PrivateOpportunityHypothesisRepository: class { createStartupRoadmap = mocks.create; } }));
import { POST } from "./route";

describe("private Startup Roadmap API", () => {
  const id = "90000000-0000-4000-8000-000000000021";
  const invoke = (body = "{}", origin: string | null = "http://localhost:3000", target = id) => POST(new Request(`http://localhost:3000/api/v1/opportunities/ideas/${target}/roadmap`, { method: "POST", headers: origin ? { Origin: origin } : {}, body }), { params: Promise.resolve({ id: target }) });
  beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: "owner", userType: "ENTREPRENEUR", onboardingStatus: "COMPLETED" }); });
  it("rejects missing/cross-origin, invalid IDs, unexpected fields and oversized bodies", async () => {
    for (const origin of [null, "https://other.example"]) expect((await invoke("{}", origin)).status).toBe(403);
    expect((await invoke("{}", "http://localhost:3000", "wrong")).status).toBe(400);
    for (const body of ['{"owner":"other"}', " ".repeat(257), "bad json"]) expect((await invoke(body)).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("authenticates and checks persona before repository work", async () => {
    mocks.user.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "owner", userType: "UMKM_EXISTING", onboardingStatus: "IN_PROGRESS" });
    expect((await invoke()).status).toBe(401);
    expect((await invoke()).status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("returns not found for another owner's row and conflict for unreviewed analysis", async () => {
    mocks.create.mockResolvedValueOnce(null).mockRejectedValueOnce(new mocks.StateError());
    expect((await invoke()).status).toBe(404);
    expect((await invoke()).status).toBe(409);
    expect(mocks.create).toHaveBeenCalledWith("owner", id);
  });
  it("returns the persisted roadmap with private caching headers", async () => {
    mocks.create.mockResolvedValue({ hypothesis: { startupRoadmap: { version: "private-startup-v1" } } });
    const response = await invoke();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ data: { version: "private-startup-v1" } });
  });
});
