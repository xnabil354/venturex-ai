import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock("@/opportunity/saved-service", () => ({
  SavedOpportunityService: class MockSavedOpportunityService {
    listForCurrentUser() {
      return mocks.list();
    }
  },
}));

import SavedOpportunitiesPage from "./page";

describe("/saved-opportunities page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the authenticated service projection", async () => {
    mocks.list.mockResolvedValue({
      status: "AVAILABLE",
      items: [{
        id: "60000000-0000-4000-8000-000000000001",
        name: "Saved menu",
        categoryName: "Minuman",
        summary: "Persisted summary.",
        relatedTrend: { id: "70000000-0000-4000-8000-000000000001", title: "Published trend" },
      }],
    });

    const markup = renderToStaticMarkup(await SavedOpportunitiesPage());

    expect(markup).toContain("Saved menu");
    expect(markup).toContain("Published trend");
    expect(mocks.list).toHaveBeenCalledOnce();
  });

  it("lets the route error boundary handle service errors without showing internals", async () => {
    mocks.list.mockRejectedValue(new Error("database internals"));

    await expect(SavedOpportunitiesPage()).rejects.toThrow("database internals");
  });
});
