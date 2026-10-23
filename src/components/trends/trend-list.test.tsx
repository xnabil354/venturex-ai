import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TrendList } from "./trend-list";

describe("TrendList", () => {
  it("presents the profile-bound Trend Radar flow without a decorative provider badge or Trending Now controls", () => {
    const markup = renderToStaticMarkup(<TrendList currentYear={2026} productQuery="Kopi" today="2026-10-17" />).replace(/\s+/gu, " ");

    expect(markup).toContain("Trend Radar");
    expect(markup).not.toContain("Google Trends Explore");
    expect(markup).toContain("Produk usaha dari profil");
    expect(markup).toContain("Kopi");
    expect(markup).toContain("Tren Saat Ini");
    expect(markup).toContain("Produk usaha dibaca dari profil akun");
    expect(markup).toContain("berdasarkan produk usaha di profil Anda");
    expect(markup).not.toContain("Trending Now");
    expect(markup).not.toContain("kata kunci");
    expect(markup).not.toContain("Matcha");
    expect(markup).not.toContain("Rempeyek");
  });
});
