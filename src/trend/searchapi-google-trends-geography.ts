import "server-only";

import geoCatalog from "./searchapi-google-trends-geos.json";

import type { GoogleTrendsGeoOption } from "./trend-radar-contract";

type SearchApiGeoRow = Readonly<{ geo_id: string; geo_description: string }>;

const rows = geoCatalog as readonly SearchApiGeoRow[];
const rowByGeo = new Map(rows.map((row) => [row.geo_id, row]));
const supportedGeoCodes = new Set(rowByGeo.keys());
const countryDisplayNames = new Intl.DisplayNames(["id"], { type: "region" });
const popularGeoCodes = ["", "ID", "US", "SG", "MY", "AU", "GB", "CA", "JP", "KR", "DE", "FR", "AE", "SA"] as const;

function displayNameForCountry(geo: string): string | null {
  const localizedName = countryDisplayNames.of(geo);
  if (!localizedName || localizedName === geo) return null;
  return localizedName;
}

function labelForRow(row: SearchApiGeoRow): string {
  if (row.geo_id === "") return "Seluruh dunia";
  if (!row.geo_id.includes("-")) return displayNameForCountry(row.geo_id) ?? row.geo_description;

  const countryCode = row.geo_id.slice(0, row.geo_id.indexOf("-"));
  const country = rowByGeo.get(countryCode);
  const countryName = country ? displayNameForCountry(countryCode) ?? country.geo_description : null;
  return countryName ? `${row.geo_description} · ${countryName}` : row.geo_description;
}

function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("id-ID").trim();
}

export function isSupportedGoogleTrendsGeo(geo: string): boolean {
  return supportedGeoCodes.has(geo);
}

export function getGoogleTrendsGeoOption(geo: string): GoogleTrendsGeoOption | null {
  const row = rowByGeo.get(geo);
  return row ? { geo: row.geo_id, label: labelForRow(row) } : null;
}

export function searchGoogleTrendsGeoOptions(query: string, limit = 30): readonly GoogleTrendsGeoOption[] {
  const normalizedQuery = normalizeSearchText(query);
  const safeLimit = Math.max(1, Math.min(40, Math.trunc(limit)));
  if (!normalizedQuery) {
    const featured = popularGeoCodes.flatMap((geo) => {
      const row = rowByGeo.get(geo);
      return row ? [{ row, option: { geo: row.geo_id, label: labelForRow(row) } }] : [];
    });
    const featuredCodes = new Set(featured.map(({ row }) => row.geo_id));
    const countries = rows
      .filter((row) => /^[A-Z]{2}$/u.test(row.geo_id) && !featuredCodes.has(row.geo_id))
      .slice(0, Math.max(0, safeLimit - featured.length))
      .map((row) => ({ geo: row.geo_id, label: labelForRow(row) }));
    return [...featured.map(({ option }) => option), ...countries].slice(0, safeLimit);
  }

  return rows
    .flatMap((row) => {
      const label = labelForRow(row);
      const normalizedLabel = normalizeSearchText(label);
      const normalizedDescription = normalizeSearchText(row.geo_description);
      const normalizedCode = normalizeSearchText(row.geo_id);
      if (!normalizedLabel.includes(normalizedQuery)
        && !normalizedDescription.includes(normalizedQuery)
        && !normalizedCode.includes(normalizedQuery)) return [];

      const rank = normalizedCode === normalizedQuery ? 0
        : normalizedLabel === normalizedQuery || normalizedDescription === normalizedQuery ? 1
          : normalizedCode.startsWith(normalizedQuery) ? 2
            : normalizedLabel.startsWith(normalizedQuery) || normalizedDescription.startsWith(normalizedQuery) ? 3
              : 4;
      return [{ option: { geo: row.geo_id, label }, rank }];
    })
    .sort((left, right) => left.rank - right.rank || left.option.label.localeCompare(right.option.label, "id-ID"))
    .slice(0, safeLimit)
    .map(({ option }) => option);
}
