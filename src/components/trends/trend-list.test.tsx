import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TrendList } from "./trend-list";

describe("TrendList", () => {
  it("presents the manual Google Trends source preview without historical catalog cards", () => {
    const markup = renderToStaticMarkup(<TrendList />).replace(/\s+/gu, " ");

    expect(markup).toContain("Trend Radar");
    expect(markup).toContain("Sinyal pencarian Indonesia");
    expect(markup).toContain("Muat sinyal terbaru");
    expect(markup).not.toContain("Matcha");
    expect(markup).not.toContain("Rempeyek");
  });
});
