import type { BrightDataGoogleTrendsCandidate } from "./brightdata-google-trends";

export const FNB_CANDIDATE_CLASSIFICATIONS = [
  "LIKELY_FNB",
  "REVIEW_REQUIRED",
  "OUT_OF_SCOPE",
] as const;

export type FnbCandidateClassification =
  (typeof FNB_CANDIDATE_CLASSIFICATIONS)[number];

export type ScreenedFnbCandidate = {
  readonly query: string;
  readonly normalizedQuery: string;
  readonly classification: FnbCandidateClassification;
  readonly matchedKeywords: readonly string[];
  readonly explanation: string;
  readonly observations: readonly BrightDataGoogleTrendsCandidate[];
};

const likelyFnbKeywords = [
  "food and beverage",
  "bubble tea",
  "milk tea",
  "teh tarik",
  "teh botol",
  "mi ayam",
  "mie ayam",
  "mi instan",
  "mie instan",
  "ayam geprek",
  "ayam goreng",
  "ikan bakar",
  "ikan goreng",
  "kopi susu",
  "kopi hitam",
  "susu uht",
  "pisang goreng",
  "martabak manis",
  "martabak telur",
  "makanan ringan",
  "sop buah",
  "sari buah",
  "es kopi",
  "es teh",
  "es krim",
  "rumah makan",
  "makanan",
  "minuman",
  "masakan",
  "kuliner",
  "restoran",
  "restaurant",
  "warung",
  "kedai",
  "cafe",
  "kafe",
  "coffee",
  "kopi",
  "roti",
  "bakery",
  "bakso",
  "sate",
  "soto",
  "rendang",
  "martabak",
  "seblak",
  "sambal",
  "gorengan",
  "jajanan",
  "camilan",
  "cemilan",
  "snack",
  "dessert",
  "kue",
  "donat",
  "pastry",
  "pizza",
  "burger",
  "sushi",
  "ramen",
  "bakmi",
  "mie",
  "nasi",
  "ayam",
  "ikan",
  "udang",
  "dimsum",
  "pempek",
  "siomay",
  "batagor",
  "cilok",
  "cireng",
  "ketoprak",
  "lontong",
  "opor",
  "kerupuk",
  "bakwan",
  "risol",
  "lemper",
  "pastel",
  "jamu",
  "wedang",
  "buah",
  "sayur",
  "telur",
  "daging",
  "tempe",
  "tahu",
  "gado gado",
  "pecel",
  "gudeg",
  "rawon",
  "bubur",
  "keripik",
  "sosis",
  "teh hijau",
] as const;

const reviewKeywords = [
  "plant based",
  "tanpa gula",
  "sugar free",
  "meal prep",
  "protein",
  "organik",
  "organic",
  "sehat",
  "healthy",
  "diet",
  "viral",
  "menu",
  "matcha",
  "teh",
  "susu",
  "mi",
  "bahan makanan",
] as const;

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("id-ID")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function findMatchingKeywords(
  normalizedQuery: string,
  keywords: readonly string[],
): string[] {
  const paddedQuery = " " + normalizedQuery + " ";
  return keywords
    .map((keyword) => normalizeText(keyword))
    .filter((keyword) => paddedQuery.includes(" " + keyword + " "))
    .sort((left, right) => {
      const leftIndex = paddedQuery.indexOf(" " + left + " ");
      const rightIndex = paddedQuery.indexOf(" " + right + " ");
      return leftIndex - rightIndex || right.length - left.length;
    });
}

function classifyQuery(normalizedQuery: string): {
  readonly classification: FnbCandidateClassification;
  readonly matchedKeywords: readonly string[];
  readonly explanation: string;
} {
  const likelyMatches = findMatchingKeywords(
    normalizedQuery,
    likelyFnbKeywords,
  );
  if (likelyMatches.length > 0) {
    return {
      classification: "LIKELY_FNB",
      matchedKeywords: likelyMatches,
      explanation:
        "Indikator F&B langsung ditemukan: " +
        likelyMatches.join(", ") +
        ". Screening ini bukan validasi faktual.",
    };
  }

  const reviewMatches = findMatchingKeywords(
    normalizedQuery,
    reviewKeywords,
  );
  if (reviewMatches.length > 0) {
    return {
      classification: "REVIEW_REQUIRED",
      matchedKeywords: reviewMatches,
      explanation:
        "Istilah yang mungkin terkait F&B tetapi ambigu: " +
        reviewMatches.join(", ") +
        ". Perlu tinjauan manual; screening ini bukan validasi faktual.",
    };
  }

  return {
    classification: "OUT_OF_SCOPE",
    matchedKeywords: [],
    explanation:
      "Tidak ada indikator F&B yang dikenali. Screening ini bukan validasi faktual.",
  };
}

export function screenFnbCandidates(
  candidates: readonly BrightDataGoogleTrendsCandidate[],
): readonly ScreenedFnbCandidate[] {
  const grouped = new Map<
    string,
    {
      readonly query: string;
      readonly normalizedQuery: string;
      readonly observations: BrightDataGoogleTrendsCandidate[];
    }
  >();

  for (const candidate of candidates) {
    const normalizedQuery = normalizeText(candidate.query);
    const deduplicationKey = JSON.stringify([
      candidate.geo,
      normalizedQuery || candidate.query.trim().toLocaleLowerCase("id-ID"),
      candidate.startedAtUnixSeconds,
    ]);
    const existing = grouped.get(deduplicationKey);

    if (existing) {
      existing.observations.push(candidate);
    } else {
      grouped.set(deduplicationKey, {
        query: candidate.query,
        normalizedQuery,
        observations: [candidate],
      });
    }
  }

  return [...grouped.values()].map((group) => ({
    query: group.query,
    normalizedQuery: group.normalizedQuery,
    ...classifyQuery(group.normalizedQuery),
    observations: group.observations,
  }));
}
