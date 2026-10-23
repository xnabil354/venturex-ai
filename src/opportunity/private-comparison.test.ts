import { describe, expect, it } from "vitest";
import { privateComparisonIdsSchema } from "./private-comparison";
import { parsePrivateListPage } from "./private-list-page";

describe("private comparison and archive input", () => {
  const ids = ["90000000-0000-4000-8000-000000000021", "90000000-0000-4000-8000-000000000022"];
  it("allows only two or three distinct IDs", () => {
    expect(privateComparisonIdsSchema.safeParse(ids).success).toBe(true);
    for (const invalid of [ids.slice(0, 1), [ids[0], ids[0]], [...ids, ...ids], ["wrong", ids[0]]]) expect(privateComparisonIdsSchema.safeParse(invalid).success).toBe(false);
  });
  it("bounds archive pages without accepting negative, repeated or fractional input", () => {
    expect(parsePrivateListPage("6")).toBe(6);
    for (const invalid of ["-1", "0", "1.5", "100001", ["1", "2"], undefined]) expect(parsePrivateListPage(invalid)).toBe(1);
  });
});
