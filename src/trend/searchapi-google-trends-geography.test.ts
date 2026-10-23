import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GET } from "@/app/api/v1/trend-radar/geographies/route";
import {
  getGoogleTrendsGeoOption,
  isSupportedGoogleTrendsGeo,
  searchGoogleTrendsGeoOptions,
} from "./searchapi-google-trends-geography";

describe("SearchApi Google Trends geography catalog", () => {
  it("offers Worldwide and popular countries by default and finds international subdivisions", () => {
    const featured = searchGoogleTrendsGeoOptions("");
    const california = searchGoogleTrendsGeoOptions("california");

    expect(featured[0]).toEqual({ geo: "", label: "Seluruh dunia" });
    expect(featured.some((option) => option.geo === "ID")).toBe(true);
    expect(featured.some((option) => option.geo === "US")).toBe(true);
    expect(california.some((option) => option.geo === "US-CA")).toBe(true);
    expect(getGoogleTrendsGeoOption("US-CA")?.label).toMatch(/California/u);
  });

  it("accepts only catalog-backed codes for request validation", () => {
    expect(isSupportedGoogleTrendsGeo("")).toBe(true);
    expect(isSupportedGoogleTrendsGeo("US-CA")).toBe(true);
    expect(isSupportedGoogleTrendsGeo("NOT-A-GEO")).toBe(false);
  });

  it("serves bounded public metadata without a provider request", async () => {
    const response = await GET(new Request("http://localhost/api/v1/trend-radar/geographies?q=California"));
    const payload = await response.json() as { options: Array<{ geo: string; label: string }> };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=86400");
    expect(payload.options.some((option) => option.geo === "US-CA")).toBe(true);

    const tooLong = await GET(new Request(`http://localhost/api/v1/trend-radar/geographies?q=${"x".repeat(81)}`));
    expect(tooLong.status).toBe(400);
  });
});
