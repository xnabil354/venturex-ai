import { expect, it } from "vitest";
import { businessQueryOptions } from "./business-query-options";
it("exposes explicit profile-owned keys and never guesses a different query", () => {
  const profile = { businessName: "Kedai Lokal", products: [{ name: "Es kopi", categoryId: null, price: null }] } as Parameters<typeof businessQueryOptions>[0];
  expect(businessQueryOptions(profile, "Minuman")).toEqual([{ key: "business", label: "Nama bisnis: Kedai Lokal", query: "Kedai Lokal" }, { key: "product:0", label: "Produk: Es kopi", query: "Es kopi" }, { key: "category", label: "Kategori: Minuman", query: "Minuman" }]);
});
