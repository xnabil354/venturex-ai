import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock("../../../../../reference/repository", () => ({
  ReferenceRepository: class {
    listActiveFnbCategories = mocks.list;
  },
}));

import { GET } from "./route";

describe("GET /api/v1/reference/fnb-categories", () => {
  it("returns the active reference DTO envelope", async () => {
    // Given
    mocks.list.mockResolvedValue([
      {
        id: "10000000-0000-4000-8000-000000000001",
        code: "BEVERAGES",
        name: "Minuman",
        parentId: null,
      },
    ]);

    // When
    const response = await GET();

    // Then
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([
      {
        id: "10000000-0000-4000-8000-000000000001",
        code: "BEVERAGES",
        name: "Minuman",
        parentId: null,
      },
    ]);
  });
});
