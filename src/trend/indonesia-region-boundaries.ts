export const SEARCH_API_TO_BOUNDARY_CODE = {
  "ID-AC": "ID-AC", "ID-BA": "ID-BA", "ID-BB": "ID-BB", "ID-BT": "ID-BT",
  "ID-BE": "ID-BE", "ID-JT": "ID-JT", "ID-KT": "ID-KT", "ID-ST": "ID-ST",
  "ID-JI": "ID-JI", "ID-KI": "ID-KI", "ID-NT": "ID-NT", "ID-GO": "ID-GO",
  "ID-JA": "ID-JA", "ID-LA": "ID-LA", "ID-MA": "ID-MA", "ID-KU": "ID-KU",
  "ID-MU": "ID-MU", "ID-SA": "ID-SA", "ID-SU": "ID-SU", "ID-PA": "ID-PA",
  "ID-RI": "ID-RI", "ID-KR": "ID-KR", "ID-SG": "ID-SG", "ID-KS": "ID-KS",
  "ID-SN": "ID-SN", "ID-SS": "ID-SS", "ID-JK": "ID-JK", "ID-YO": "ID-YO",
  "ID-JB": "ID-JB", "ID-KB": "ID-KB", "ID-NB": "ID-NB", "ID-PB": "ID-PB",
  "ID-SR": "ID-SR", "ID-SB": "ID-SB",
} as const;

export type SearchApiRegionCode = keyof typeof SEARCH_API_TO_BOUNDARY_CODE;

export function mapSearchApiRegionToBoundaryCode(code: string): string | null {
  return Object.prototype.hasOwnProperty.call(SEARCH_API_TO_BOUNDARY_CODE, code)
    ? SEARCH_API_TO_BOUNDARY_CODE[code as SearchApiRegionCode]
    : null;
}
