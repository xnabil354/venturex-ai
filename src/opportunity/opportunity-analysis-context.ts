import "server-only";

import { createHash, createHmac } from "node:crypto";

import { getGoogleTrendsGeoOption } from "@/trend/searchapi-google-trends-geography";

import { USER_TYPES, type SafeUser, type UserType } from "../auth/user-types";
import { BusinessProfileService } from "../profile/business-service";
import { EntrepreneurProfileService } from "../profile/service";
import { ReferenceRepository, type ReferenceRepositoryPort } from "../reference/repository";
import type { SearchApiOpportunityEvidence } from "./searchapi-evidence-contract";
import {
  buildOpportunityEvidenceAvailability,
  type OpportunityEvidenceAvailability,
  type OpportunityEvidenceStatus,
} from "./opportunity-evidence-availability";
import {
  OPPORTUNITY_ANALYSIS_CONTEXT_MAX_BYTES,
  OPPORTUNITY_ANALYSIS_CONTEXT_VERSION,
  OPPORTUNITY_ANALYSIS_PROMPT_VERSION,
  OpportunityProfileContextError,
  type BuiltOpportunityProfileContext,
  type EntrepreneurOpportunityProfileContext,
  type ExistingBusinessOpportunityProfileContext,
  type OpportunityAnalysisContext,
  type OpportunityLocationContext,
  type OpportunityProfileAvailability,
  type OpportunityProfileContext,
  type OpportunityProfileField,
  type OpportunityProfileReference,
  type OpportunityQueryIntent,
} from "./opportunity-analysis-context-contract";

export * from "./opportunity-analysis-context-contract";

type ProfileServicePort = Readonly<{
  getForEdit(userId: SafeUser["id"]): Promise<unknown>;
}>;

type OpportunityProfileContextBuilderDependencies = Readonly<{
  entrepreneurProfiles?: ProfileServicePort;
  businessProfiles?: ProfileServicePort;
  references?: ReferenceRepositoryPort;
}>;

function normalizeProfileText(value: string | null | undefined, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) throw new OpportunityProfileContextError("PROFILE_CONTEXT_TOO_LARGE");
  return normalized
    .replace(/\b[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+\b/giu, "[email dihapus]")
    .replace(/(?<![\p{L}\p{N}])(?:\+?62|0)(?:[\s().-]*\d){8,13}(?!\d)/gu, "[nomor telepon dihapus]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/giu, "[ID dihapus]")
    .replace(/\b(password|kata sandi|passwd|api[\s_-]*key|access token|refresh token|otp)\s*[:=]\s*([^\s,;]+)/giu, "$1 [rahasia dihapus]");
}

function resolveReferenceNames(
  ids: readonly string[],
  references: readonly Readonly<{ id: string; name: string }>[],
): readonly string[] {
  const byId = new Map(references.map((item) => [item.id, normalizeProfileText(item.name, 160)]));
  const names = ids.map((id) => byId.get(id));
  if (ids.length === 0 || names.some((name) => !name)) throw new OpportunityProfileContextError("PROFILE_INCOMPLETE");
  return [...new Set(names as string[])].sort((left, right) => left.localeCompare(right, "id"));
}

function locationContext(location: Readonly<{ text: string; city?: string | null; province?: string | null }> | null | undefined): OpportunityLocationContext | null {
  if (!location) return null;
  const text = normalizeProfileText(location.text, 255);
  if (!text) return null;
  return {
    text,
    city: normalizeProfileText(location.city, 120),
    province: normalizeProfileText(location.province, 120),
  };
}

function present(persona: OpportunityProfileContext["persona"], fields: readonly OpportunityProfileField[]): OpportunityProfileAvailability {
  const allFields: readonly OpportunityProfileField[] = persona === "ENTREPRENEUR"
    ? ["profile.preferredProductType", "profile.categories", "profile.customerSegments", "profile.salesChannels", "profile.budget", "profile.location", "profile.experienceLevel", "profile.timeCommitment", "profile.businessObjective", "profile.notes"]
    : ["profile.businessName", "profile.businessCategory", "profile.businessDescription", "profile.location", "profile.averagePrice", "profile.products", "profile.products[].category", "profile.products[].price", "profile.customerSegments", "profile.salesChannels", "profile.notes"];
  const included = new Set(fields);
  return { profileFieldsPresent: allFields.filter((field) => included.has(field)), profileFieldsMissing: allFields.filter((field) => !included.has(field)) };
}

export class DatabaseOpportunityProfileContextBuilder {
  private readonly entrepreneurProfiles: ProfileServicePort | undefined;
  private readonly businessProfiles: ProfileServicePort | undefined;
  private readonly references: ReferenceRepositoryPort;

  constructor(dependencies: OpportunityProfileContextBuilderDependencies = {}) {
    this.entrepreneurProfiles = dependencies.entrepreneurProfiles;
    this.businessProfiles = dependencies.businessProfiles;
    this.references = dependencies.references ?? new ReferenceRepository();
  }

  async build(user: SafeUser & { readonly userType: UserType }): Promise<BuiltOpportunityProfileContext> {
    const [categories, segments, channels] = await Promise.all([
      this.references.listActiveFnbCategories(),
      this.references.listActiveCustomerSegments(),
      this.references.listActiveSalesChannels(),
    ]);

    if (user.userType === USER_TYPES.ENTREPRENEUR) {
      const profileValue = await (this.entrepreneurProfiles ?? new EntrepreneurProfileService()).getForEdit(user.id);
      const profile = profileValue as {
        preferredProductType: string | null;
        interestCategoryIds: readonly string[];
        customerSegmentIds: readonly string[];
        salesChannelIds: readonly string[];
        budget: Readonly<{ min: number; max: number }>;
        location: Readonly<{ text: string; city?: string | null; province?: string | null }>;
        experienceLevel: "BEGINNER" | "SOME_EXPERIENCE" | "EXPERIENCED" | null;
        timeCommitment: "LIMITED" | "PART_TIME" | "FULL_TIME" | null;
        businessObjective: string | null;
        notes: string | null;
      };
      const context: EntrepreneurOpportunityProfileContext = {
        persona: "ENTREPRENEUR",
        preferredProductType: normalizeProfileText(profile.preferredProductType, 100),
        categories: resolveReferenceNames(profile.interestCategoryIds, categories),
        customerSegments: resolveReferenceNames(profile.customerSegmentIds, segments),
        salesChannels: resolveReferenceNames(profile.salesChannelIds, channels),
        budget: { min: profile.budget.min, max: profile.budget.max, currency: "IDR" },
        location: locationContext(profile.location),
        experienceLevel: profile.experienceLevel,
        timeCommitment: profile.timeCommitment,
        businessObjective: normalizeProfileText(profile.businessObjective, 1_200),
        notes: normalizeProfileText(profile.notes, 1_200),
      };
      const fields: OpportunityProfileField[] = [
        "profile.categories", "profile.customerSegments", "profile.salesChannels", "profile.budget",
      ];
      if (context.experienceLevel !== null) fields.push("profile.experienceLevel");
      if (context.timeCommitment !== null) fields.push("profile.timeCommitment");
      if (context.preferredProductType) fields.push("profile.preferredProductType");
      if (context.location) fields.push("profile.location");
      if (context.businessObjective) fields.push("profile.businessObjective");
      if (context.notes) fields.push("profile.notes");
      return this.assertBounded({ profile: context, dataAvailability: present(context.persona, fields) });
    }

    const profileValue = await (this.businessProfiles ?? new BusinessProfileService()).getForEdit(user.id);
    const profile = profileValue as {
      businessName: string;
      businessCategoryId: string;
      location: Readonly<{ text: string; city?: string | null; province?: string | null }>;
      averagePrice: Readonly<{ min: number; max: number }>;
      products: readonly Readonly<{ name: string; categoryId: string | null; price: number | null }>[];
      customerSegmentIds: readonly string[];
      salesChannelIds: readonly string[];
      businessDescription: string | null;
      notes: string | null;
    };
    const context: ExistingBusinessOpportunityProfileContext = {
      persona: "UMKM_EXISTING",
      businessName: normalizeProfileText(profile.businessName, 180) ?? "",
      businessCategory: resolveReferenceNames([profile.businessCategoryId], categories)[0] ?? "",
      businessDescription: normalizeProfileText(profile.businessDescription, 1_000),
      location: locationContext(profile.location),
      averagePrice: { min: profile.averagePrice.min, max: profile.averagePrice.max, currency: "IDR" },
      products: profile.products.map((product) => ({
        name: normalizeProfileText(product.name, 180) ?? "",
        category: product.categoryId ? resolveReferenceNames([product.categoryId], categories)[0] ?? null : null,
        price: product.price,
      })),
      customerSegments: resolveReferenceNames(profile.customerSegmentIds, segments),
      salesChannels: resolveReferenceNames(profile.salesChannelIds, channels),
      notes: normalizeProfileText(profile.notes, 1_000),
    };
    const fields: OpportunityProfileField[] = [
      "profile.businessName", "profile.businessCategory", "profile.averagePrice", "profile.products",
      "profile.customerSegments", "profile.salesChannels",
    ];
    if (context.businessDescription) fields.push("profile.businessDescription");
    if (context.location) fields.push("profile.location");
    if (context.notes) fields.push("profile.notes");
    if (context.products.some((product) => product.category)) fields.push("profile.products[].category");
    if (context.products.some((product) => product.price !== null)) fields.push("profile.products[].price");
    return this.assertBounded({ profile: context, dataAvailability: present(context.persona, fields) });
  }

  private assertBounded(value: BuiltOpportunityProfileContext): BuiltOpportunityProfileContext {
    if (Buffer.byteLength(JSON.stringify(value), "utf8") > OPPORTUNITY_ANALYSIS_CONTEXT_MAX_BYTES) {
      throw new OpportunityProfileContextError("PROFILE_CONTEXT_TOO_LARGE");
    }
    return value;
  }
}

const genericProductModifiers = new Set([
  "arabika", "bubuk", "cappuccino", "dingin", "es", "gula", "hitam", "instan", "latte", "panas",
  "robusta", "sachet", "susu", "aren", "botol", "kemasan", "menu", "minuman", "makanan",
]);

export function classifyOpportunityQueryIntent(
  query: string,
  parentKeyword: string,
  profile: OpportunityProfileContext,
): OpportunityQueryIntent {
  const normalizedQuery = query.normalize("NFKC").toLocaleLowerCase("id-ID").trim().replace(/\s+/gu, " ");
  const normalizedParent = parentKeyword.normalize("NFKC").toLocaleLowerCase("id-ID").trim().replace(/\s+/gu, " ");
  if (/\b(resep|cara membuat|cara masak|manfaat|kandungan|kalori|tutorial)\b/iu.test(normalizedQuery)) return "RECIPE_OR_INFORMATIONAL";
  if (/\b(harga|murah|promo|diskon|harga promo)\b/iu.test(normalizedQuery)) return "PRICE_RELATED";
  if (/\b(terdekat|dekat sini|alamat|lokasi|sekitar)\b/iu.test(normalizedQuery)) return "LOCATION_OR_LOCAL_INTENT";
  if (/\b(beli|pesan|order|delivery|pesan antar|jual|beli online)\b/iu.test(normalizedQuery)) return "PURCHASE_OR_TRANSACTIONAL_CANDIDATE";
  if (profile.persona === "UMKM_EXISTING") {
    const businessName = profile.businessName.normalize("NFKC").toLocaleLowerCase("id-ID").trim().replace(/\s+/gu, " ");
    if (normalizedQuery === businessName || normalizedQuery.startsWith(`${businessName} `)) return "BRAND_OR_NAVIGATIONAL";
  }
  if (normalizedQuery === normalizedParent) return "PRODUCT";
  if (normalizedQuery.startsWith(`${normalizedParent} `)) {
    const remainder = normalizedQuery.slice(normalizedParent.length).trim().split(/\s+/u).filter(Boolean);
    if (remainder.length > 0 && remainder.every((word) => genericProductModifiers.has(word))) return "PRODUCT";
    return "BRAND_OR_NAVIGATIONAL";
  }
  return "UNKNOWN_OR_AMBIGUOUS";
}

function buildProfileReferenceCatalog(
  profile: OpportunityProfileContext,
  availability: OpportunityProfileAvailability,
): readonly OpportunityProfileReference[] {
  const presentFields = new Set(availability.profileFieldsPresent);
  const references: OpportunityProfileReference[] = [];

  for (const profileField of availability.profileFieldsPresent) {
    if (profileField === "profile.products[].price") continue;
    const metric = profileField === "profile.budget"
      ? "BUDGET"
      : profileField === "profile.averagePrice"
        ? "AVERAGE_BUSINESS_PRICE"
        : null;
    const subjectCategory = profileField === "profile.products"
      ? "PRODUCT_SET"
      : metric
        ? "BUSINESS"
        : "PROFILE_FIELD";
    references.push({
      id: profileField,
      profileField,
      metric,
      subjectCategory,
      subjectId: subjectCategory === "BUSINESS" ? "business" : profileField,
    });
  }

  if (profile.persona === "UMKM_EXISTING" && presentFields.has("profile.products[].price")) {
    profile.products.forEach((product, index) => {
      if (product.price === null) return;
      const id = `profile.products[${index}].price`;
      references.push({
        id,
        profileField: "profile.products[].price",
        metric: "PRODUCT_PRICE",
        subjectCategory: "EXISTING_PRODUCT",
        subjectId: `profile.products[${index}]`,
      });
    });
  }

  return references;
}

export function buildOpportunityAnalysisContext(
  profile: BuiltOpportunityProfileContext,
  evidence: SearchApiOpportunityEvidence,
): OpportunityAnalysisContext {
  const sourceId = `searchapi_${createHash("sha256").update(JSON.stringify(evidence)).digest("hex").slice(0, 24)}`;
  const financialEvidenceAvailability = buildOpportunityEvidenceAvailability(profile.profile);
  const profileReferenceCatalog = buildProfileReferenceCatalog(profile.profile, profile.dataAvailability);
  const context: OpportunityAnalysisContext = {
    contextVersion: OPPORTUNITY_ANALYSIS_CONTEXT_VERSION,
    profile: profile.profile,
    profileReferenceCatalog,
    evidence: {
      sourceId,
      sourceType: evidence.sourceType,
      provider: evidence.provider,
      publisher: evidence.publisher,
      parentKeyword: evidence.productQuery,
      selectedQuery: evidence.query,
      queryIntentCandidate: classifyOpportunityQueryIntent(evidence.query, evidence.productQuery, profile.profile),
      position: evidence.position,
      interestIndex: evidence.interestIndex,
      growthLabel: evidence.growthLabel,
      growthPercent: evidence.growthPercent,
      isBreakout: evidence.isBreakout,
      geographicCode: evidence.geo,
      geographicScope: getGoogleTrendsGeoOption(evidence.geo)?.label ?? evidence.geo,
      timeFilter: evidence.period,
      searchProperty: evidence.searchProperty,
      retrievedAt: evidence.retrievedAt,
      expiresAt: evidence.expiresAt,
      sourceUrl: evidence.url,
      providerSourceUrl: evidence.providerSourceUrl,
      freshness: "CURRENT",
      ownershipVerified: true,
    },
    dataAvailability: {
      ...profile.dataAvailability,
      evidenceLimitations: [
        "Google Trends menunjukkan minat pencarian relatif pada filter terpilih, bukan pembelian, penjualan, permintaan pasar, atau ukuran pasar.",
        "Top interest index dan Rising growth label/persentase adalah metrik yang berbeda; Breakout tetap label sumber dan bukan persentase.",
        "Klasifikasi intent kueri adalah kandidat heuristik untuk membantu penafsiran dan bukan fakta tentang niat pengguna pencarian.",
      ],
    },
    financialEvidenceAvailability,
  };
  if (Buffer.byteLength(JSON.stringify(opportunityAnalysisContextForPrompt(context)), "utf8") > OPPORTUNITY_ANALYSIS_CONTEXT_MAX_BYTES) {
    throw new OpportunityProfileContextError("PROFILE_CONTEXT_TOO_LARGE");
  }
  return context;
}

function entriesByStatus(
  availability: OpportunityEvidenceAvailability,
  status: OpportunityEvidenceStatus,
  includeProductDetails = true,
) {
  return availability.inventory
    .filter((item) => item.status === status
      && (includeProductDetails || item.subjectScope !== "EXISTING_PRODUCT"))
    .map(({ metric, subjectId, trustedSourceReference }) => [metric, subjectId, trustedSourceReference] as const);
}

export function opportunityAnalysisContextForPrompt(context: OpportunityAnalysisContext) {
  const { financialEvidenceAvailability, ...baseContext } = context;
  const evidence = context.evidence;
  const trendSignal = evidence.sourceType === "RELATED_QUERY_TOP"
    ? "TOP_RELATED_QUERY"
    : evidence.isBreakout
      ? "BREAKOUT"
      : "RISING";
  const verifiedNumericFacts = [
    ...(evidence.position === null ? [] : [{
      sourceRef: evidence.sourceId,
      metric: "GOOGLE_TRENDS_POSITION",
      value: evidence.position,
      unit: "ranking",
      meaning: "posisi kueri terkait pada hasil SearchApi; bukan ukuran pasar",
    }]),
    ...(evidence.sourceType === "RELATED_QUERY_TOP" && evidence.interestIndex !== null ? [{
      sourceRef: evidence.sourceId,
      metric: "GOOGLE_TRENDS_INTEREST_INDEX",
      value: evidence.interestIndex,
      unit: "relative_index_0_to_100",
      meaning: "indeks minat penelusuran relatif; bukan volume pencarian atau jumlah transaksi",
    }] : []),
    ...(evidence.sourceType === "RELATED_QUERY_RISING" && !evidence.isBreakout && evidence.growthPercent !== null ? [{
      sourceRef: evidence.sourceId,
      metric: "GOOGLE_TRENDS_RISING_GROWTH_PERCENT",
      value: evidence.growthPercent,
      unit: "percent",
      meaning: "pertumbuhan pada kueri penelusuran terkait; bukan pertumbuhan penjualan atau pendapatan",
    }] : []),
  ];
  return {
    ...baseContext,
    profileReferenceCatalog: context.profileReferenceCatalog.filter(({ metric }) => metric === "PRODUCT_PRICE").map(({ id, metric, subjectCategory, subjectId }) =>
      [id, metric, subjectCategory, subjectId] as const),
    evidence: {
      sourceId: evidence.sourceId,
      sourceType: evidence.sourceType,
      provider: evidence.provider,
      publisher: evidence.publisher,
      parentKeyword: evidence.parentKeyword,
      selectedQuery: evidence.selectedQuery,
      queryIntentCandidate: evidence.queryIntentCandidate,
      trendSignal,
      verifiedNumericFacts,
      geographicScope: evidence.geographicScope,
      searchProperty: evidence.searchProperty,
      freshness: evidence.freshness,
      ownershipVerified: evidence.ownershipVerified,
    },
    financialEvidenceAvailability: {
      known: entriesByStatus(financialEvidenceAvailability, "KNOWN", false),
      partial: entriesByStatus(financialEvidenceAvailability, "PARTIAL"),
      eligibleGaps: financialEvidenceAvailability.eligibleGaps.map((item) => [item.id, item.code, item.subjectId] as const),
    },
  };
}

export function fingerprintOpportunityAnalysisContext(
  context: OpportunityAnalysisContext,
  input: Readonly<{ authSecret: string | undefined; model: string }>,
): string {
  const secret = input.authSecret?.trim();
  if (!secret || secret.length < 32) throw new OpportunityProfileContextError("CONFIGURATION_UNAVAILABLE");
  const fingerprintInput = {
    contextVersion: context.contextVersion,
    promptVersion: OPPORTUNITY_ANALYSIS_PROMPT_VERSION,
    model: input.model,
    persona: context.profile.persona,
    profile: context.profile,
    evidence: context.evidence,
  };
  return `hmac-sha256-v1:${createHmac("sha256", secret)
    .update("venturex:opportunity-analysis-context-fingerprint:v1\0")
    .update(JSON.stringify(fingerprintInput))
    .digest("hex")}`;
}
