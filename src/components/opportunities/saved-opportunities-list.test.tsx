import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { SavedOpportunityListResult } from "@/opportunity/saved-dto";
import { SavedOpportunitiesList } from "./saved-opportunities-list";

const available: SavedOpportunityListResult = {
  status: "AVAILABLE",
  items: [{
    id: "60000000-0000-4000-8000-000000000001",
    name: "Menu minuman",
    categoryName: "Minuman",
    summary: "Ringkasan dari Opportunity tersimpan.",
    relatedTrend: {
      id: "70000000-0000-4000-8000-000000000001",
      title: "Trend eligible",
    },
  }],
};

describe("SavedOpportunitiesList", () => {
  it("shows saved persisted opportunities with a detail link", () => {
    const markup = renderToStaticMarkup(<SavedOpportunitiesList result={available} />);

    expect(markup).toContain("Menu minuman");
    expect(markup).toContain("Trend eligible");
    expect(markup).toContain('href="/opportunities/60000000-0000-4000-8000-000000000001"');
  });

  it("shows an honest empty state with a Finder link", () => {
    const empty: SavedOpportunityListResult = { status: "EMPTY", items: [] };
    const markup = renderToStaticMarkup(<SavedOpportunitiesList result={empty} />);

    expect(markup).toContain("Belum ada simpanan");
    expect(markup).toContain('href="/opportunities"');
  });
});
