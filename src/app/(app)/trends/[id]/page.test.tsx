import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

import TrendDetailPage from "./page";

describe("Trend detail archive boundary", () => {
  it("does not expose historical catalog records from a direct URL", async () => {
    await expect(TrendDetailPage({ params: Promise.resolve({ id: "60000000-0000-4000-8000-000000000003" }) }))
      .rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });
});