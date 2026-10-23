import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PricingSection } from "./pricing-section";

const pricing = {
  premium: { amount: 84_000, credits: 25 },
  pro: { amount: 146_000, credits: 50 },
};

describe("PricingSection", () => {
  it("uses the active catalogue values and makes every package actionable", () => {
    const markup = renderToStaticMarkup(<PricingSection isAuthenticated pricing={pricing} />);

    expect(markup).toMatch(/Rp\s*84\.000/u);
    expect(markup).toContain("/ bulan");
    expect(markup).toContain("25 kredit/bulan");
    expect(markup).toContain("50 kredit/bulan");
    expect(markup).toContain("Pilih");
    expect(markup).toContain("Berlangganan");
    expect(markup).toContain("Popular");
    expect(markup).toContain("Top up pay-as-you-go tersedia di halaman Billing");
    expect(markup).not.toContain("Checkout paket kredit tambahan");
    expect(markup).toContain('href="/billing"');
  });

  it("sends guests to sign in before they can choose a package", () => {
    const markup = renderToStaticMarkup(<PricingSection isAuthenticated={false} pricing={pricing} />);

    expect(markup).toContain("Berlangganan");
    expect(markup).toContain('href="/login"');
  });

  it("does not show stale monetary values when the public catalogue is unavailable", () => {
    const markup = renderToStaticMarkup(<PricingSection pricing={null} />);

    expect(markup).toContain("Katalog paket sedang diperbarui");
    expect(markup).not.toContain("Rp84.000");
  });
});
