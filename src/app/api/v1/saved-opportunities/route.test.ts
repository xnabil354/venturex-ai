import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listPage: vi.fn() }));
vi.mock("@/opportunity/saved-service", () => ({
  SavedOpportunityAccessContextError: class extends Error {},
  SavedOpportunityInvalidQueryError: class extends Error {},
  SavedOpportunityUnauthenticatedError: class extends Error {},
  SavedOpportunityService: class {
    listPageForCurrentUser(...args: unknown[]) { return mocks.listPage(...args); }
  },
}));

import {
  SavedOpportunityAccessContextError,
  SavedOpportunityInvalidQueryError,
  SavedOpportunityUnauthenticatedError,
} from "@/opportunity/saved-service";
import { GET } from "./route";

describe("GET /api/v1/saved-opportunities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listPage.mockResolvedValue({
      status: "AVAILABLE",
      items: [],
      page: 2,
      pageSize: 5,
      totalCount: 8,
      totalPages: 2,
      sort: "createdAt",
      order: "asc",
    });
  });

  it("validates and passes documented pagination and sorting", async () => {
    const response = await GET(new Request("http://localhost/api/v1/saved-opportunities?page=2&pageSize=5&sort=createdAt&order=asc"));

    expect(response.status).toBe(200);
    expect(mocks.listPage).toHaveBeenCalledWith({ page: 2, pageSize: 5, sort: "createdAt", order: "asc" });
    expect((await response.json()).data).toMatchObject({ totalCount: 8, totalPages: 2 });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("uses the shared documented pagination defaults", async () => {
    await GET(new Request("http://localhost/api/v1/saved-opportunities"));

    expect(mocks.listPage).toHaveBeenCalledWith({ page: 1, pageSize: 20, sort: "createdAt", order: "desc" });
  });

  it.each([
    "?page=0",
    "?pageSize=101",
    "?sort=name",
    "?order=up",
    "?page=1&page=2",
    "?unexpected=true",
  ])("rejects unsupported or ambiguous query %s", async (query) => {
    const response = await GET(new Request(`http://localhost/api/v1/saved-opportunities${query}`));

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    expect(mocks.listPage).not.toHaveBeenCalled();
  });

  it.each([
    [new SavedOpportunityUnauthenticatedError(), 401, "UNAUTHORIZED"],
    [new SavedOpportunityAccessContextError(), 422, "PROFILE_INCOMPLETE"],
    [new SavedOpportunityInvalidQueryError(), 400, "VALIDATION_ERROR"],
  ] as const)("maps sanitized service failures to HTTP %i", async (error, status, code) => {
    mocks.listPage.mockRejectedValueOnce(error);

    const response = await GET(new Request("http://localhost/api/v1/saved-opportunities"));
    const payload = await response.json();

    expect(response.status).toBe(status);
    expect(payload.error.code).toBe(code);
  });
});
