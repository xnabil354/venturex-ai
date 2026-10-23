import { z } from "zod";
import type { CompetitorSample } from "../opportunity/entrepreneur-analysis-contract";

const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("id-ID").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/gu, " ").trim();
const jakartaDirections: Readonly<Record<string, string>> = { north: "utara", south: "selatan", west: "barat", east: "timur", central: "pusat" };

export function canonicalCompetitorCity(value: string): string {
  return normalize(value)
    .replace(/^(?:kota|kabupaten|kab)\s+(?:administrasi\s+)?/u, "")
    .replace(/^administrasi\s+/u, "")
    .replace(/\bjkt\b/gu, "jakarta")
    .replace(/\b(north|south|west|east|central) jakarta\b/gu, (_, direction: string) => `jakarta ${jakartaDirections[direction]}`)
    .replace(/\s+city$/u, "")
    .trim();
}

export function competitorSearchQuery(product: string, city: string, province?: string | null): string {
  const locality = canonicalCompetitorCity(city).replace(/\b\p{L}/gu, character => character.toLocaleUpperCase("id-ID"));
  if (!locality) throw new Error("INVALID_COMPETITOR_CITY");
  const region = province && /^(?:dki jakarta|daerah khusus(?: ibukota)? jakarta)$/u.test(normalize(province)) ? "DKI Jakarta" : province?.trim();
  return [`${product.trim()} ${locality}`, ...(region ? [region] : []), "Indonesia"].join(", ").slice(0, 350);
}

function matchesCity(address: string, city: string): boolean {
  const expected = canonicalCompetitorCity(city);
  return address.split(",").some(segment => {
    const locality = canonicalCompetitorCity(segment).replace(/\s+\d{5}$/u, "");
    if (/^(?:jl|jln|jalan)\b/u.test(locality)) return false;
    return locality === expected || locality.endsWith(` ${expected}`);
  });
}
const rowSchema = z.object({ title: z.string().trim().min(1).max(500), address: z.string().trim().min(1).max(500), place_id: z.string().max(200).optional() });

export function normalizeCompetitorSample(payload: unknown, query: string, city: string, retrievedAt: string): CompetitorSample {
  const parsed = z.object({ local_results: z.array(z.unknown()), error: z.unknown().optional() }).safeParse(payload);
  if (!parsed.success || (parsed.data.error != null && parsed.data.error !== "") || !canonicalCompetitorCity(city)) throw new Error("INVALID_COMPETITOR_RESPONSE");
  const unique = new Map<string, CompetitorSample["places"][number]>();
  const rows = parsed.data.local_results.slice(0, 20);
  const diagnostics = { receivedCount: parsed.data.local_results.length, inspectedCount: rows.length, invalidCount: 0, outsideCityCount: 0, duplicateCount: 0 };
  for (const raw of rows) {
    const row = rowSchema.safeParse(raw);
    if (!row.success) { diagnostics.invalidCount += 1; continue; }
    if (!matchesCity(row.data.address, city)) { diagnostics.outsideCityCount += 1; continue; }
    const key = row.data.place_id ?? `${normalize(row.data.title)}:${normalize(row.data.address)}`;
    if (unique.has(key)) { diagnostics.duplicateCount += 1; continue; }
    const url = new URL("https://www.google.com/maps/search/");
    url.searchParams.set("api", "1");
    url.searchParams.set("query", `${row.data.title} ${row.data.address}`);
    if (row.data.place_id) url.searchParams.set("query_place_id", row.data.place_id);
    unique.set(key, { name: row.data.title, address: row.data.address, url: url.toString() });
  }
  return { query, city, retrievedAt, sampleCount: unique.size, places: [...unique.values()].slice(0, 5), diagnostics };
}
