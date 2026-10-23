import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

const mocks = vi.hoisted(() => ({ compare: vi.fn() }));
vi.mock("@/opportunity/compare-service", () => ({
  OpportunityComparisonAccessContextError: class extends Error { constructor(message?: string) { super(message); } },
  OpportunityComparisonInvalidRequestError: class extends Error { constructor(message?: string) { super(message); } },
  OpportunityComparisonResourceNotFoundError: class extends Error { constructor(message?: string) { super(message); } },
  OpportunityComparisonUnauthenticatedError: class extends Error { constructor(message?: string) { super(message); } },
  OpportunityComparisonService: class {
    compare(...args: unknown[]) { return mocks.compare(...args); }
  },
}));

import {
  OpportunityComparisonAccessContextError,
  OpportunityComparisonInvalidRequestError,
  OpportunityComparisonResourceNotFoundError,
  OpportunityComparisonUnauthenticatedError,
} from "@/opportunity/compare-service";
import { POST } from "./route";

const ids = [
  "60000000-0000-4000-8000-000000000001",
  "60000000-0000-4000-8000-000000000002",
] as const;

function request(body: string): Request {
  return new Request("http://localhost/api/v1/opportunities/compare", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("POST /api/v1/opportunities/compare", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.compare.mockResolvedValue({ items: [] });
  });

  it("returns private no-store comparison data for a valid bounded request", async () => {
    const response = await POST(request(JSON.stringify({ opportunityIds: ids })));

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ items: [] });
    expect(mocks.compare).toHaveBeenCalledWith({ opportunityIds: ids });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("rejects malformed and oversized bodies before calling comparison services", async () => {
    const malformed = await POST(request("{"));
    const oversized = await POST(request(JSON.stringify({ context: "x".repeat(5000) })));

    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error.code).toBe("VALIDATION_ERROR");
    expect(oversized.status).toBe(400);
    expect((await oversized.json()).error.code).toBe("VALIDATION_ERROR");
    expect(mocks.compare).not.toHaveBeenCalled();
  });

  it("sanitizes invalid generated comparison output as an internal error", async () => {
    mocks.compare.mockRejectedValueOnce(new ZodError([]));

    const response = await POST(request(JSON.stringify({ opportunityIds: ids })));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(payload)).not.toContain("ZodError");
  });

  it.each([
    { error: Object.assign(new OpportunityComparisonUnauthenticatedError(), { message: "private authentication detail" }), status: 401, code: "UNAUTHORIZED" },
    { error: Object.assign(new OpportunityComparisonAccessContextError(), { message: "private profile detail" }), status: 422, code: "PROFILE_INCOMPLETE" },
    { error: Object.assign(new OpportunityComparisonInvalidRequestError(), { message: "private validation detail" }), status: 400, code: "VALIDATION_ERROR" },
    { error: Object.assign(new OpportunityComparisonResourceNotFoundError(), { message: "private resource detail" }), status: 404, code: "RESOURCE_NOT_FOUND" },
  ])("maps sanitized service errors to HTTP $status", async ({ error, status, code }) => {
    mocks.compare.mockRejectedValueOnce(error);

    const response = await POST(request(JSON.stringify({ opportunityIds: ids })));
    const payload = await response.json();

    expect(response.status).toBe(status);
    expect(payload.error.code).toBe(code);
    expect(JSON.stringify(payload)).not.toContain(error.message);
  });
});
