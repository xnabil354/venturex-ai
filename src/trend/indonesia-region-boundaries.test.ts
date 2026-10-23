import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { mapSearchApiRegionToBoundaryCode, SEARCH_API_TO_BOUNDARY_CODE } from "./indonesia-region-boundaries";

describe("SearchApi to geoBoundaries ADM1 mapping", () => {
  it("maps provider codes explicitly across every major island group", () => {
    expect(mapSearchApiRegionToBoundaryCode("ID-JI")).toBe("ID-JI");
    expect(mapSearchApiRegionToBoundaryCode("ID-SU")).toBe("ID-SU");
    expect(mapSearchApiRegionToBoundaryCode("ID-KT")).toBe("ID-KT");
    expect(mapSearchApiRegionToBoundaryCode("ID-SN")).toBe("ID-SN");
    expect(mapSearchApiRegionToBoundaryCode("ID-BA")).toBe("ID-BA");
    expect(mapSearchApiRegionToBoundaryCode("ID-NT")).toBe("ID-NT");
    expect(mapSearchApiRegionToBoundaryCode("ID-MA")).toBe("ID-MA");
    expect(mapSearchApiRegionToBoundaryCode("ID-PA")).toBe("ID-PA");
    expect(Object.keys(SEARCH_API_TO_BOUNDARY_CODE)).toHaveLength(34);
  });

  it("does not infer a code that is absent from the pinned feature set", () => {
    expect(mapSearchApiRegionToBoundaryCode("ID-PD")).toBeNull();
    expect(mapSearchApiRegionToBoundaryCode("ID-XX")).toBeNull();
  });

  it("keeps the distributed GeoJSON feature identifiers unique and aligned with the explicit map", () => {
    const source = readFileSync(new URL("../../public/maps/indonesia-geoboundaries-adm1-2017-simplified.geojson", import.meta.url), "utf8");
    const collection = JSON.parse(source) as { type: string; features: Array<{ properties: { shapeISO?: string }; geometry: { type: string } }> };
    const codes = collection.features.map((feature) => feature.properties.shapeISO);
    expect(collection.type).toBe("FeatureCollection");
    expect(collection.features).toHaveLength(34);
    expect(new Set(codes).size).toBe(34);
    expect(new Set(codes)).toEqual(new Set(Object.keys(SEARCH_API_TO_BOUNDARY_CODE)));
    expect(collection.features.every((feature) => feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon")).toBe(true);
  });
});
