import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ save: vi.fn(), setSaved: vi.fn() }));
vi.mock("@/opportunity/saved-service", () => ({
  SavedOpportunityAccessContextError: class extends Error {},
  SavedOpportunityUnauthenticatedError: class extends Error {},
  SavedOpportunityService: class {
    saveForCurrentUser(...args: unknown[]) { return mocks.save(...args); }
    setSaved(...args: unknown[]) { return mocks.setSaved(...args); }
  },
}));

import {
  SavedOpportunityAccessContextError,
  SavedOpportunityUnauthenticatedError,
} from "@/opportunity/saved-service";
import { DELETE, POST } from "./route";

const opportunityId = "60000000-0000-4000-8000-000000000001";
const context = (id: string) => ({ params: Promise.resolve({ opportunityId: id }) });
const request = new Request("http://localhost", { method: "POST" });

describe("Saved Opportunity relationship API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.save.mockResolvedValue({ saved: true, created: true });
    mocks.setSaved.mockResolvedValue(false);
  });

  it("returns 201 for a new save and 200 for an idempotent existing save", async () => {
    const created = await POST(request, context(opportunityId));
    mocks.save.mockResolvedValueOnce({ saved: true, created: false });
    const existing = await POST(request, context(opportunityId));

    expect(created.status).toBe(201);
    expect((await created.json()).data).toEqual({ opportunityId, saved: true });
    expect(existing.status).toBe(200);
    expect((await existing.json()).data.saved).toBe(true);
    expect(mocks.save).toHaveBeenCalledWith(opportunityId);
  });

  it("rejects an invalid UUID and returns 404 for an ineligible Opportunity", async () => {
    const invalid = await POST(request, context("not-a-uuid"));
    mocks.save.mockResolvedValueOnce(null);
    const missing = await POST(request, context(opportunityId));

    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error.code).toBe("VALIDATION_ERROR");
    expect(missing.status).toBe(404);
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });

  it("maps authentication and incomplete profile without exposing details", async () => {
    mocks.save.mockRejectedValueOnce(new SavedOpportunityUnauthenticatedError());
    const unauthenticated = await POST(request, context(opportunityId));
    mocks.save.mockRejectedValueOnce(new SavedOpportunityAccessContextError());
    const incomplete = await POST(request, context(opportunityId));

    expect(unauthenticated.status).toBe(401);
    expect((await unauthenticated.json()).error.code).toBe("UNAUTHORIZED");
    expect(incomplete.status).toBe(422);
    expect((await incomplete.json()).error.code).toBe("PROFILE_INCOMPLETE");
  });

  it("returns an idempotent 204 delete and never returns a body", async () => {
    const absentRelationship = await DELETE(new Request("http://localhost", { method: "DELETE" }), context(opportunityId));

    expect(absentRelationship.status).toBe(204);
    expect(await absentRelationship.text()).toBe("");
    expect(mocks.setSaved).toHaveBeenCalledWith(opportunityId, false);
    expect(absentRelationship.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("rejects an invalid delete ID and returns 404 for an ineligible Opportunity", async () => {
    const invalid = await DELETE(new Request("http://localhost", { method: "DELETE" }), context("invalid"));
    mocks.setSaved.mockResolvedValueOnce(null);
    const missing = await DELETE(new Request("http://localhost", { method: "DELETE" }), context(opportunityId));

    expect(invalid.status).toBe(400);
    expect(missing.status).toBe(404);
    expect(mocks.setSaved).toHaveBeenCalledTimes(1);
  });
});
