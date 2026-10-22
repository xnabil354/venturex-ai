import { describe, expect, it } from "vitest";
import { canonicalCompetitorCity, competitorSearchQuery, normalizeCompetitorSample } from "./searchapi-competitor-sample";

const city = "Kota Administrasi Jakarta Utara";
const date = "2026-10-21T12:00:00.000Z";

describe("local competitor locality matching", () => {
  it("canonicalizes administrative labels and builds a province-qualified query", () => {
    expect(canonicalCompetitorCity(city)).toBe("jakarta utara");
    expect(canonicalCompetitorCity("Kota Jkt. Utara")).toBe("jakarta utara");
    expect(canonicalCompetitorCity("North Jakarta City")).toBe("jakarta utara");
    expect(canonicalCompetitorCity("Kabupaten Administrasi Kepulauan Seribu")).toBe("kepulauan seribu");
    expect(competitorSearchQuery("bakso", city, "Daerah Khusus Ibukota Jakarta")).toBe("bakso Jakarta Utara, DKI Jakarta, Indonesia");
    expect(competitorSearchQuery("bakso", "Kota Bandung")).toBe("bakso Bandung, Indonesia");
    expect(() => competitorSearchQuery("bakso", "")).toThrow();
  });

  it("accepts equivalent north-Jakarta addresses and counts every exclusion", () => {
    const sample = normalizeCompetitorSample({ local_results: [
      { title: "Bakso A", address: "Kelapa Gading, Kota Jkt. Utara, DKI Jakarta", place_id: "a" },
      { title: "Bakso B", address: "North Jakarta City, Jakarta", place_id: "b" },
      { title: "Bakso C", address: "Jakarta Utara 14240", place_id: "c" },
      { title: "Bakso D", address: "Jakarta Selatan" },
      { title: "Bakso E", address: "Jl. Jakarta Utara, Kota Jakarta Timur" },
      { title: "Bakso F", address: "Jakarta Utarabaru" },
      { title: "Bakso A", address: "Jakarta Utara", place_id: "a" },
      { title: "No address" },
    ] }, "bakso Jakarta Utara", city, date);
    expect(sample.sampleCount).toBe(3);
    expect(sample.diagnostics).toEqual({ receivedCount: 8, inspectedCount: 8, invalidCount: 1, outsideCityCount: 3, duplicateCount: 1 });
    expect(sample.places.map(place => place.name)).toEqual(["Bakso A", "Bakso B", "Bakso C"]);
    expect(sample.places.every(place => new URL(place.url).hostname === "www.google.com")).toBe(true);
  });

  it.each(["Selatan", "Timur", "Barat", "Pusat"])("does not conflate Jakarta %s with Jakarta Utara", direction => {
    const sample = normalizeCompetitorSample({ local_results: [{ title: "Other area", address: `Kota Jkt. ${direction}, DKI Jakarta` }] }, "bakso", city, date);
    expect(sample.sampleCount).toBe(0);
    expect(sample.diagnostics?.outsideCityCount).toBe(1);
  });

  it("bounds inspection and retained examples while preserving received counts", () => {
    const sample = normalizeCompetitorSample({ local_results: Array.from({ length: 25 }, (_, i) => ({ title: `Bakso ${i}`, address: "Jakarta Utara", place_id: String(i) })) }, "bakso", city, date);
    expect(sample.sampleCount).toBe(20); expect(sample.places).toHaveLength(5);
    expect(sample.diagnostics).toMatchObject({ receivedCount: 25, inspectedCount: 20 });
  });

  it("separates genuine empty responses from provider errors", () => {
    const empty = normalizeCompetitorSample({ local_results: [] }, "bakso", city, date);
    expect(empty.diagnostics).toMatchObject({ receivedCount: 0, inspectedCount: 0 });
    expect(() => normalizeCompetitorSample({ local_results: [], error: "provider failure" }, "bakso", city, date)).toThrow();
  });
});
