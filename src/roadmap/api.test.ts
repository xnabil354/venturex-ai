import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
}));

vi.mock("./service", () => ({
  StartupRoadmapService: class {
    generate = mocks.generate;
    listForCurrentUser = mocks.list;
    getForCurrentUser = mocks.get;
  },
  RoadmapUnauthenticatedError: class extends Error {},
  RoadmapForbiddenError: class extends Error {},
  RoadmapUserIncompleteError: class extends Error {},
  RoadmapProfileIncompleteError: class extends Error {},
  RoadmapInsufficientContextError: class extends Error {},
  RoadmapOpportunityNotFoundError: class extends Error {},
  RoadmapAnalysisNotFoundError: class extends Error {},
}));

import { GET, POST } from "../app/api/v1/roadmaps/route";
import { GET as GET_DETAIL } from "../app/api/v1/roadmaps/[roadmapId]/route";
import { RoadmapForbiddenError, RoadmapProfileIncompleteError, RoadmapInsufficientContextError } from "./service";

const id = "50000000-0000-4000-8000-000000000001";

describe("Roadmap API routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects malformed JSON, invalid UUIDs, and client-selected owner/type fields", async () => {
    const malformed = await POST(new Request("http://localhost/api/v1/roadmaps", { method: "POST", body: "{" }));
    const invalidUuid = await POST(new Request("http://localhost/api/v1/roadmaps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opportunityId: "not-a-uuid" }),
    }));
    const clientAuthority = await POST(new Request("http://localhost/api/v1/roadmaps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opportunityId: id, userId: "10000000-0000-4000-8000-000000000001", roadmapType: "GROWTH" }),
    }));

    expect(malformed.status).toBe(400);
    expect(invalidUuid.status).toBe(400);
    expect(clientAuthority.status).toBe(400);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("creates a roadmap with server-controlled ownership and returns 201", async () => {
    mocks.generate.mockResolvedValue({ id, roadmapType: "STARTUP" });
    const response = await POST(new Request("http://localhost/api/v1/roadmaps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opportunityId: id }),
    }));
    const body = await response.json() as { readonly success: boolean; readonly data: { readonly id: string } };

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(body).toMatchObject({ success: true, data: { id } });
    expect(mocks.generate).toHaveBeenCalledWith({ opportunityId: id });
  });

  it.each([
    [new RoadmapForbiddenError(), 403, "ROADMAP_NOT_ALLOWED"],
    [new RoadmapProfileIncompleteError(), 422, "PROFILE_INCOMPLETE"],
    [new RoadmapInsufficientContextError(), 422, "INSUFFICIENT_DATA"],
  ])("maps product errors to controlled API responses", async (error, status, code) => {
    mocks.generate.mockRejectedValue(error);
    const response = await POST(new Request("http://localhost/api/v1/roadmaps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opportunityId: id }),
    }));
    const body = await response.json() as { readonly error: { readonly code: string } };
    expect(response.status).toBe(status);
    expect(body.error.code).toBe(code);
  });

  it("lists the current user's page and rejects a userId filter", async () => {
    mocks.list.mockResolvedValue({ items: [], page: 2, pageSize: 5, totalCount: 0, totalPages: 1 });
    const response = await GET(new Request("http://localhost/api/v1/roadmaps?page=2&pageSize=5&type=STARTUP&sort=createdAt&order=ASC"));
    const forbiddenFilter = await GET(new Request("http://localhost/api/v1/roadmaps?userId=10000000-0000-4000-8000-000000000001"));

    expect(response.status).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith({ page: 2, pageSize: 5, type: "STARTUP", sort: "createdAt", order: "ASC" });
    expect(forbiddenFilter.status).toBe(400);
  });

  it("returns 404 for invalid IDs and owner-scoped missing detail", async () => {
    const invalid = await GET_DETAIL(new Request("http://localhost"), { params: Promise.resolve({ roadmapId: "bad" }) });
    mocks.get.mockResolvedValue(null);
    const missing = await GET_DETAIL(new Request("http://localhost"), { params: Promise.resolve({ roadmapId: id }) });

    expect(invalid.status).toBe(400);
    expect(mocks.get).toHaveBeenCalledWith(id);
    expect(missing.status).toBe(404);
  });
});
