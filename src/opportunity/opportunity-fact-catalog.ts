import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";

import { userIdSchema, type SafeUser } from "../auth/user-types";
import { canonicalJson } from "../lib/canonical-json";
import type {
  BuiltOpportunityProfileContext,
  OpportunityProfileField,
  OpportunityProfileContext,
} from "./opportunity-analysis-context";
import {
  buildOpportunityEvidenceAvailability,
  type OpportunityEvidenceGapCode,
  type OpportunityFinancialMetric,
  type OpportunityEvidenceSubjectScope,
  type OpportunityEvidenceStatus,
} from "./opportunity-evidence-availability";
import {
  searchApiOpportunityEvidenceSchema,
  type SearchApiOpportunityEvidence,
} from "./searchapi-evidence-contract";

export const OPPORTUNITY_FACT_CATALOG_VERSION = "opportunity-fact-catalog-v1" as const;
export const OPPORTUNITY_TOP_INTEREST_INDEX_MAX = 100 as const;

const nullableText = (max: number) => z.string().trim().min(1).max(max).nullable();
const moneyRangeSchema = z.object({ min: z.number().finite().nonnegative(), max: z.number().finite().nonnegative(), currency: z.literal("IDR") })
  .strict()
  .refine((value) => value.min <= value.max, "Minimum must not exceed maximum");
const locationSchema = z.object({ text: z.string().trim().min(1).max(255), city: nullableText(120), province: nullableText(120) }).strict();

const entrepreneurProfileSchema = z.object({
  persona: z.literal("ENTREPRENEUR"),
  preferredProductType: nullableText(100),
  categories: z.array(z.string().trim().min(1).max(160)).min(1),
  customerSegments: z.array(z.string().trim().min(1).max(160)).min(1),
  salesChannels: z.array(z.string().trim().min(1).max(160)).min(1),
  budget: moneyRangeSchema,
  location: locationSchema.nullable(),
  experienceLevel: z.enum(["BEGINNER", "SOME_EXPERIENCE", "EXPERIENCED"]).nullable(),
  timeCommitment: z.enum(["LIMITED", "PART_TIME", "FULL_TIME"]).nullable(),
  businessObjective: nullableText(1_200),
  notes: nullableText(1_200),
}).strict();

const existingBusinessProfileSchema = z.object({
  persona: z.literal("UMKM_EXISTING"),
  businessName: z.string().trim().min(1).max(180),
  businessCategory: z.string().trim().min(1).max(160),
  businessDescription: nullableText(1_000),
  location: locationSchema.nullable(),
  averagePrice: moneyRangeSchema,
  products: z.array(z.object({ name: z.string().trim().min(1).max(180), category: nullableText(160), price: z.number().finite().nonnegative().nullable() }).strict()).min(1),
  customerSegments: z.array(z.string().trim().min(1).max(160)).min(1),
  salesChannels: z.array(z.string().trim().min(1).max(160)).min(1),
  notes: nullableText(1_000),
}).strict();

const profileFieldSchema = z.enum([
  "profile.preferredProductType", "profile.categories", "profile.customerSegments", "profile.salesChannels",
  "profile.budget", "profile.location", "profile.experienceLevel", "profile.timeCommitment",
  "profile.businessObjective", "profile.notes", "profile.businessName", "profile.businessCategory",
  "profile.businessDescription", "profile.averagePrice", "profile.products", "profile.products[].category",
  "profile.products[].price",
]);
type ProfileSourceField = z.infer<typeof profileFieldSchema> | "context.financialEvidenceAvailability" | `profile.products[${number}].price`;
const profileSourceFieldSchema = z.string().refine((value) => profileFieldSchema.safeParse(value).success
  || value === "context.financialEvidenceAvailability"
  || /^profile\.products\[\d+\]\.price$/u.test(value));

export const builtOpportunityProfileProjectionSchema = z.object({
  profile: z.discriminatedUnion("persona", [entrepreneurProfileSchema, existingBusinessProfileSchema]),
  dataAvailability: z.object({ profileFieldsPresent: z.array(profileFieldSchema), profileFieldsMissing: z.array(profileFieldSchema) }).strict(),
}).strict();

export type ValidatedOpportunityProfileProjection = z.infer<typeof builtOpportunityProfileProjectionSchema>;

const catalogSourceSchema = z.discriminatedUnion("sourceType", [
  z.object({
    id: z.string().regex(/^src_[a-f0-9]{24}$/u), sourceType: z.literal("PROFILE"), persona: z.enum(["ENTREPRENEUR", "UMKM_EXISTING"]),
    profileField: profileSourceFieldSchema, subjectId: z.string().min(1).max(180),
  }).strict(),
  z.object({
    id: z.string().regex(/^src_[a-f0-9]{24}$/u), sourceType: z.literal("SEARCHAPI"),
    provider: z.literal("SearchApi.io"), publisher: z.literal("Google Trends"), query: z.string().min(1),
    parentQuery: z.string().min(1), queryType: z.enum(["RELATED_QUERY_TOP", "RELATED_QUERY_RISING"]), position: z.number().int().positive(),
    geography: z.string().max(9), property: z.enum(["web", "images", "news", "shopping", "youtube"]),
    period: z.string().min(1), providerTime: z.string().min(1), retrievedAt: z.string().datetime(), expiresAt: z.string().datetime(),
    sourceUrl: z.string().url(), providerSourceUrl: z.string().url().nullable(), isBreakout: z.boolean(),
  }).strict(),
]);

const factMetricSchema = z.enum([
  "PROFILE_ATTRIBUTE", "BUDGET_RANGE", "AVERAGE_BUSINESS_PRICE", "PRODUCT_PRICE",
  "RELATED_QUERY_INTEREST_INDEX", "RELATED_QUERY_GROWTH_PERCENT", "RELATED_QUERY_GROWTH_LABEL", "RELATED_QUERY_BREAKOUT",
]);
const factSubjectSchema = z.object({
  kind: z.enum(["PROFILE_FIELD", "BUSINESS", "PRODUCT_SET", "EXISTING_PRODUCT", "QUERY"]),
  id: z.string().trim().min(1).max(180),
  label: z.string().trim().min(1).max(250),
}).strict();
const factValueSchema = z.union([
  z.string().trim().min(1).max(1_200),
  z.number().finite().nonnegative(),
  z.object({ min: z.number().finite().nonnegative(), max: z.number().finite().nonnegative() }).strict().refine((value) => value.min <= value.max),
]);
const factUnitSchema = z.enum(["IDR", "IDR_RANGE", "RELATIVE_INDEX_0_100", "PERCENT", "COUNT", "SOURCE_LABEL"]).nullable();

export const opportunityFactSchema = z.object({
  id: z.string().regex(/^fact_[a-f0-9]{24}$/u),
  sourceType: z.enum(["PROFILE", "SEARCHAPI"]),
  metric: factMetricSchema,
  subject: factSubjectSchema,
  value: factValueSchema,
  unit: factUnitSchema,
  availability: z.literal("KNOWN"),
  sourceRef: z.string().regex(/^src_[a-f0-9]{24}$/u),
}).strict().superRefine((fact, context) => {
  const isRangeMetric = fact.metric === "BUDGET_RANGE" || fact.metric === "AVERAGE_BUSINESS_PRICE";
  if (isRangeMetric && (typeof fact.value !== "object" || fact.value === null || fact.unit !== "IDR_RANGE" || fact.sourceType !== "PROFILE")) {
    context.addIssue({ code: "custom", path: ["value"], message: "Financial range facts require an IDR range." });
  }
  if (fact.metric === "PRODUCT_PRICE" && (typeof fact.value !== "number" || fact.unit !== "IDR" || fact.sourceType !== "PROFILE")) {
    context.addIssue({ code: "custom", path: ["value"], message: "Product prices must be profile-owned IDR amounts." });
  }
  if (fact.metric === "RELATED_QUERY_INTEREST_INDEX" && (typeof fact.value !== "number" || fact.value > OPPORTUNITY_TOP_INTEREST_INDEX_MAX || fact.unit !== "RELATIVE_INDEX_0_100" || fact.sourceType !== "SEARCHAPI")) {
    context.addIssue({ code: "custom", path: ["value"], message: "Top interest must be a 0-100 relative index." });
  }
  if (fact.metric === "RELATED_QUERY_GROWTH_PERCENT" && (typeof fact.value !== "number" || fact.unit !== "PERCENT" || fact.sourceType !== "SEARCHAPI")) {
    context.addIssue({ code: "custom", path: ["value"], message: "Rising growth must use a percentage value." });
  }
  if (fact.metric === "RELATED_QUERY_BREAKOUT" && (typeof fact.value !== "string" || fact.value.toLocaleLowerCase("en-US") !== "breakout" || fact.unit !== "SOURCE_LABEL" || fact.sourceType !== "SEARCHAPI")) {
    context.addIssue({ code: "custom", path: ["value"], message: "Breakout must remain a categorical label." });
  }
  if (fact.metric === "PROFILE_ATTRIBUTE" && (typeof fact.value !== "string" || fact.unit !== null || fact.sourceType !== "PROFILE")) {
    context.addIssue({ code: "custom", path: ["value"], message: "Profile attributes must be textual profile facts." });
  }
  if (fact.metric === "RELATED_QUERY_GROWTH_LABEL" && (typeof fact.value !== "string" || fact.unit !== "SOURCE_LABEL" || fact.sourceType !== "SEARCHAPI")) {
    context.addIssue({ code: "custom", path: ["value"], message: "Growth labels must remain source labels." });
  }
});

const financialMetricSchema = z.enum([
  "PRODUCT_PRICE", "AVERAGE_BUSINESS_PRICE", "PROPOSED_PRODUCT_PRICE", "COMPETITOR_PRICE",
  "CUSTOMER_WILLINGNESS_TO_PAY", "PRODUCTION_COST", "OPERATING_COST", "REVENUE", "MARGIN", "SALES_VOLUME", "CUSTOMER_VALIDATION", "BUDGET",
]);
const subjectScopeSchema = z.enum(["BUSINESS", "PRODUCT_SET", "EXISTING_PRODUCT", "PROPOSED_PRODUCT", "COMPETITOR", "CUSTOMER", "BUSINESS_OPERATIONS"]);
const availabilitySchema = z.object({
  id: z.string().regex(/^av_[a-f0-9]{24}$/u),
  domain: z.enum(["PROFILE", "FINANCIAL", "SEARCHAPI"]),
  metric: z.union([financialMetricSchema, z.enum(["PROFILE_FIELD", "RELATED_QUERY_INTEREST_INDEX", "RELATED_QUERY_GROWTH_PERCENT", "RELATED_QUERY_GROWTH_LABEL"])]),
  subjectKind: z.enum(["PROFILE_FIELD", "BUSINESS", "PRODUCT_SET", "EXISTING_PRODUCT", "PROPOSED_PRODUCT", "COMPETITOR", "CUSTOMER", "BUSINESS_OPERATIONS", "QUERY"]),
  subjectId: z.string().min(1).max(180),
  status: z.enum(["KNOWN", "PARTIAL", "UNKNOWN"]),
  unit: factUnitSchema,
  sourceRef: z.string().regex(/^src_[a-f0-9]{24}$/u).nullable(),
  reason: z.enum(["NOT_PROVIDED", "BREAKOUT_LABEL_ONLY"]).nullable(),
}).strict();

const evidenceGapCodeSchema = z.enum([
  "EXISTING_PRODUCT_PRICE_UNKNOWN", "PROPOSED_PRODUCT_PRICE_UNKNOWN", "COMPETITOR_PRICE_UNKNOWN",
  "CUSTOMER_WILLINGNESS_TO_PAY_UNKNOWN", "COST_OF_GOODS_UNKNOWN", "OPERATING_COST_UNKNOWN",
  "REVENUE_HISTORY_UNKNOWN", "MARGIN_UNKNOWN", "SALES_VOLUME_UNKNOWN", "CUSTOMER_VALIDATION_REQUIRED",
]);
const evidenceGapSchema = z.object({
  id: z.string().regex(/^gapref_[a-f0-9]{24}$/u), code: evidenceGapCodeSchema,
  availabilityRef: z.string().regex(/^av_[a-f0-9]{24}$/u), metric: financialMetricSchema,
  subjectScope: subjectScopeSchema, subjectId: z.string().min(1).max(180),
  sourceRef: z.string().regex(/^src_[a-f0-9]{24}$/u),
}).strict();

export const opportunityFactCatalogSchema = z.object({
  version: z.literal(OPPORTUNITY_FACT_CATALOG_VERSION),
  id: z.string().regex(/^catalog_[a-f0-9]{24}$/u),
  ownerScope: z.string().regex(/^owner_[a-f0-9]{24}$/u),
  persona: z.enum(["ENTREPRENEUR", "UMKM_EXISTING"]),
  sources: z.array(catalogSourceSchema),
  facts: z.array(opportunityFactSchema),
  availability: z.array(availabilitySchema),
  eligibleGaps: z.array(evidenceGapSchema),
}).strict().superRefine((catalog, context) => {
  const sourcesById = new Map(catalog.sources.map((source) => [source.id, source]));
  const sourceIds = new Set(sourcesById.keys());
  if (sourceIds.size !== catalog.sources.length) context.addIssue({ code: "custom", path: ["sources"], message: "Source ids must be unique." });
  const factIds = new Set<string>();
  const availabilityIds = new Set<string>();
  for (const [index, fact] of catalog.facts.entries()) {
    if (factIds.has(fact.id)) context.addIssue({ code: "custom", path: ["facts", index, "id"], message: "Fact ids must be unique." });
    factIds.add(fact.id);
    const source = sourcesById.get(fact.sourceRef);
    if (!source) {
      context.addIssue({ code: "custom", path: ["facts", index, "sourceRef"], message: "Fact source must exist in this catalog." });
    } else if (source.sourceType !== fact.sourceType) {
      context.addIssue({ code: "custom", path: ["facts", index, "sourceRef"], message: "Fact source type must match its provenance." });
    } else if (source.sourceType === "PROFILE") {
      if (source.persona !== catalog.persona || source.subjectId !== fact.subject.id) {
        context.addIssue({ code: "custom", path: ["facts", index, "sourceRef"], message: "Profile fact provenance must match its subject and persona." });
      }
      if ((fact.metric === "BUDGET_RANGE" && source.profileField !== "profile.budget")
        || (fact.metric === "AVERAGE_BUSINESS_PRICE" && source.profileField !== "profile.averagePrice")
        || (fact.metric === "PRODUCT_PRICE" && source.profileField !== "profile.products[].price" && !/^profile\.products\[\d+\]\.price$/u.test(source.profileField))) {
        context.addIssue({ code: "custom", path: ["facts", index, "sourceRef"], message: "Financial fact must cite its matching profile field." });
      }
    } else {
      const queryMetric = fact.metric === "RELATED_QUERY_INTEREST_INDEX"
        ? source.queryType === "RELATED_QUERY_TOP"
        : source.queryType === "RELATED_QUERY_RISING";
      if (fact.subject.kind !== "QUERY" || fact.subject.label !== source.query || fact.subject.id !== `${source.queryType}:${source.position}:${source.query}` || !queryMetric) {
        context.addIssue({ code: "custom", path: ["facts", index, "sourceRef"], message: "SearchApi fact must match its query source." });
      }
      if ((fact.metric === "RELATED_QUERY_BREAKOUT") !== source.isBreakout) {
        context.addIssue({ code: "custom", path: ["facts", index, "sourceRef"], message: "Breakout fact must match its provider label." });
      }
    }
  }
  for (const [index, availability] of catalog.availability.entries()) {
    if (availabilityIds.has(availability.id)) context.addIssue({ code: "custom", path: ["availability", index, "id"], message: "Availability ids must be unique." });
    availabilityIds.add(availability.id);
    const source = availability.sourceRef ? sourcesById.get(availability.sourceRef) : undefined;
    if (availability.sourceRef && !source) context.addIssue({ code: "custom", path: ["availability", index, "sourceRef"], message: "Availability source must exist in this catalog." });
    if (source && ((availability.domain === "SEARCHAPI") !== (source.sourceType === "SEARCHAPI"))) {
      context.addIssue({ code: "custom", path: ["availability", index, "sourceRef"], message: "Availability domain must match its provenance." });
    }
  }
  const gapIds = new Set<string>();
  for (const [index, gap] of catalog.eligibleGaps.entries()) {
    if (gapIds.has(gap.id)) context.addIssue({ code: "custom", path: ["eligibleGaps", index, "id"], message: "Gap ids must be unique." });
    gapIds.add(gap.id);
    const availability = catalog.availability.find((item) => item.id === gap.availabilityRef);
    if (!availabilityIds.has(gap.availabilityRef) || !availability) context.addIssue({ code: "custom", path: ["eligibleGaps", index, "availabilityRef"], message: "Gap must point to catalog availability." });
    else if (availability.status !== "UNKNOWN" || availability.metric !== gap.metric || availability.subjectKind !== gap.subjectScope || availability.subjectId !== gap.subjectId || availability.sourceRef !== gap.sourceRef) {
      context.addIssue({ code: "custom", path: ["eligibleGaps", index, "availabilityRef"], message: "Gap must match unknown availability for the same subject." });
    }
    if (!sourceIds.has(gap.sourceRef)) context.addIssue({ code: "custom", path: ["eligibleGaps", index, "sourceRef"], message: "Gap source must exist in this catalog." });
  }
});

export type OpportunityFact = z.infer<typeof opportunityFactSchema>;
export type OpportunityFactCatalog = z.infer<typeof opportunityFactCatalogSchema>;
export type OpportunityCatalogSource = z.infer<typeof catalogSourceSchema>;
export type OpportunityEvidenceGap = z.infer<typeof evidenceGapSchema>;
export type OpportunityCatalogAvailability = z.infer<typeof availabilitySchema>;
export type OpportunityFactReference = Readonly<{ catalogId: string; factId: string }>;

export type OpportunityFactCatalogErrorCode =
  | "INVALID_INPUT" | "INVALID_TOP_INDEX" | "DUPLICATE_EVIDENCE" | "INVALID_REFERENCE"
  | "DUPLICATE_REFERENCE" | "CROSS_CONTEXT_REFERENCE" | "STALE_REFERENCE" | "REFERENCE_MISMATCH";

export class OpportunityFactCatalogError extends Error {
  override readonly name = "OpportunityFactCatalogError";

  constructor(readonly code: OpportunityFactCatalogErrorCode) {
    super("Opportunity fact catalog input or reference is invalid.");
  }
}

function digest(prefix: string, value: unknown): string {
  return `${prefix}_${createHash("sha256").update(canonicalJson(value)).digest("hex").slice(0, 24)}`;
}

function ownerScope(ownerId: SafeUser["id"]): string {
  return digest("owner", ownerId);
}

function unitForFinancialMetric(metric: OpportunityFinancialMetric): z.infer<typeof factUnitSchema> {
  if (metric === "BUDGET" || metric === "AVERAGE_BUSINESS_PRICE") return "IDR_RANGE";
  if (metric === "PRODUCT_PRICE" || metric === "PROPOSED_PRODUCT_PRICE" || metric === "COMPETITOR_PRICE" || metric === "CUSTOMER_WILLINGNESS_TO_PAY" || metric === "PRODUCTION_COST" || metric === "OPERATING_COST" || metric === "REVENUE") return "IDR";
  if (metric === "MARGIN") return "PERCENT";
  if (metric === "SALES_VOLUME") return "COUNT";
  return null;
}

function availabilityId(catalogId: string, key: unknown): string {
  return digest("av", [catalogId, key]);
}

function makeAvailability(
  catalogId: string,
  value: Omit<z.infer<typeof availabilitySchema>, "id">,
): z.infer<typeof availabilitySchema> {
  return { ...value, id: availabilityId(catalogId, value) };
}

function addFact(
  facts: OpportunityFact[], catalogId: string, sourceRef: string,
  value: Omit<OpportunityFact, "id" | "sourceRef" | "availability">,
): void {
  const factId = digest("fact", [catalogId, sourceRef, value]);
  facts.push({ ...value, id: factId, sourceRef, availability: "KNOWN" });
}

function searchSource(evidence: SearchApiOpportunityEvidence, catalogId: string): OpportunityCatalogSource {
  return {
    id: digest("src", [catalogId, "SEARCHAPI", evidence]), sourceType: "SEARCHAPI",
    provider: evidence.provider, publisher: evidence.publisher, query: evidence.query, parentQuery: evidence.productQuery,
    queryType: evidence.sourceType, position: evidence.position, geography: evidence.geo, property: evidence.searchProperty,
    period: evidence.period, providerTime: evidence.providerTime, retrievedAt: evidence.retrievedAt,
    expiresAt: evidence.expiresAt, sourceUrl: evidence.url, providerSourceUrl: evidence.providerSourceUrl,
    isBreakout: evidence.isBreakout,
  };
}

function profileFacts(
  profile: OpportunityProfileContext,
  catalogId: string,
  profileSourceRef: (field: OpportunityProfileField, subjectId: string) => string,
  facts: OpportunityFact[],
): void {
  const attribute = (
    field: OpportunityProfileField,
    label: string,
    value: string,
    subjectKind: OpportunityFact["subject"]["kind"] = "PROFILE_FIELD",
    subjectId: string = field,
  ) => {
    addFact(facts, catalogId, profileSourceRef(field, subjectId), { sourceType: "PROFILE", metric: "PROFILE_ATTRIBUTE", subject: { kind: subjectKind, id: subjectId, label }, value, unit: null });
  };
  const textList = (field: OpportunityProfileField, values: readonly string[]) => values.forEach((value, index) => attribute(field, value, value, "PROFILE_FIELD", `${field}[${index}]`));
  const locationFacts = (location: OpportunityProfileContext["location"]) => {
    if (!location) return;
    attribute("profile.location", "Lokasi", location.text);
    if (location.city) attribute("profile.location", "Kota", location.city, "PROFILE_FIELD", "profile.location.city");
    if (location.province) attribute("profile.location", "Provinsi", location.province, "PROFILE_FIELD", "profile.location.province");
  };

  if (profile.persona === "ENTREPRENEUR") {
    if (profile.preferredProductType) attribute("profile.preferredProductType", "Jenis produk pilihan", profile.preferredProductType);
    textList("profile.categories", profile.categories);
    textList("profile.customerSegments", profile.customerSegments);
    textList("profile.salesChannels", profile.salesChannels);
    addFact(facts, catalogId, profileSourceRef("profile.budget", "business"), { sourceType: "PROFILE", metric: "BUDGET_RANGE", subject: { kind: "BUSINESS", id: "business", label: "Budget deklarasi wirausaha" }, value: { min: profile.budget.min, max: profile.budget.max }, unit: "IDR_RANGE" });
    locationFacts(profile.location);
    if (profile.experienceLevel) attribute("profile.experienceLevel", "Pengalaman", profile.experienceLevel);
    if (profile.timeCommitment) attribute("profile.timeCommitment", "Komitmen waktu", profile.timeCommitment);
    if (profile.businessObjective) attribute("profile.businessObjective", "Tujuan usaha", profile.businessObjective);
    if (profile.notes) attribute("profile.notes", "Catatan profil", profile.notes);
    return;
  }

  attribute("profile.businessName", "Nama usaha", profile.businessName, "BUSINESS", "business");
  attribute("profile.businessCategory", "Kategori usaha", profile.businessCategory, "BUSINESS", "business");
  if (profile.businessDescription) attribute("profile.businessDescription", "Deskripsi usaha", profile.businessDescription, "BUSINESS", "business");
  locationFacts(profile.location);
  addFact(facts, catalogId, profileSourceRef("profile.averagePrice", "business"), { sourceType: "PROFILE", metric: "AVERAGE_BUSINESS_PRICE", subject: { kind: "BUSINESS", id: "business", label: "Rentang harga rata-rata usaha" }, value: { min: profile.averagePrice.min, max: profile.averagePrice.max }, unit: "IDR_RANGE" });
  profile.products.forEach((product, index) => {
    const subjectId = `profile.products[${index}]`;
    attribute("profile.products", "Produk usaha", product.name, "EXISTING_PRODUCT", subjectId);
    if (product.category) attribute("profile.products[].category", `Kategori ${product.name}`, product.category, "EXISTING_PRODUCT", subjectId);
    if (product.price !== null) addFact(facts, catalogId, profileSourceRef("profile.products[].price", subjectId), {
      sourceType: "PROFILE", metric: "PRODUCT_PRICE", subject: { kind: "EXISTING_PRODUCT", id: subjectId, label: product.name }, value: product.price, unit: "IDR",
    });
  });
  textList("profile.customerSegments", profile.customerSegments);
  textList("profile.salesChannels", profile.salesChannels);
  if (profile.notes) attribute("profile.notes", "Catatan profil", profile.notes);
}

function addProfileAvailability(
  catalogId: string,
  projection: ValidatedOpportunityProfileProjection,
  profileSourceRef: (field: OpportunityProfileField, subjectId: string) => string,
  target: OpportunityCatalogAvailability[],
): void {
  const { profile, dataAvailability } = projection;
  const present = new Set(dataAvailability.profileFieldsPresent);
  const missing = new Set(dataAvailability.profileFieldsMissing);
  const allFields: readonly OpportunityProfileField[] = profile.persona === "ENTREPRENEUR"
    ? ["profile.preferredProductType", "profile.categories", "profile.customerSegments", "profile.salesChannels", "profile.budget", "profile.location", "profile.experienceLevel", "profile.timeCommitment", "profile.businessObjective", "profile.notes"]
    : ["profile.businessName", "profile.businessCategory", "profile.businessDescription", "profile.location", "profile.averagePrice", "profile.products", "profile.products[].category", "profile.products[].price", "profile.customerSegments", "profile.salesChannels", "profile.notes"];
  const expectedPresent = new Set<OpportunityProfileField>();
  if (profile.persona === "ENTREPRENEUR") {
    for (const field of ["profile.categories", "profile.customerSegments", "profile.salesChannels", "profile.budget"] as const) expectedPresent.add(field);
    if (profile.experienceLevel !== null) expectedPresent.add("profile.experienceLevel");
    if (profile.timeCommitment !== null) expectedPresent.add("profile.timeCommitment");
    if (profile.preferredProductType) expectedPresent.add("profile.preferredProductType");
    if (profile.location) expectedPresent.add("profile.location");
    if (profile.businessObjective) expectedPresent.add("profile.businessObjective");
    if (profile.notes) expectedPresent.add("profile.notes");
  } else {
    for (const field of ["profile.businessName", "profile.businessCategory", "profile.averagePrice", "profile.products", "profile.customerSegments", "profile.salesChannels"] as const) expectedPresent.add(field);
    if (profile.businessDescription) expectedPresent.add("profile.businessDescription");
    if (profile.location) expectedPresent.add("profile.location");
    if (profile.notes) expectedPresent.add("profile.notes");
    if (profile.products.some((product) => product.category !== null)) expectedPresent.add("profile.products[].category");
    if (profile.products.some((product) => product.price !== null)) expectedPresent.add("profile.products[].price");
  }
  if (present.size !== dataAvailability.profileFieldsPresent.length || missing.size !== dataAvailability.profileFieldsMissing.length
    || present.size + missing.size !== allFields.length || allFields.some((field) => present.has(field) === missing.has(field))
    || allFields.some((field) => present.has(field) !== expectedPresent.has(field))) {
    throw new OpportunityFactCatalogError("INVALID_INPUT");
  }
  for (const field of allFields) {
    let status: OpportunityEvidenceStatus = present.has(field) ? "KNOWN" : "UNKNOWN";
    if (field === "profile.products[].price" && profile.persona === "UMKM_EXISTING") {
      const known = profile.products.filter((product) => product.price !== null).length;
      status = known === 0 ? "UNKNOWN" : known === profile.products.length ? "KNOWN" : "PARTIAL";
    }
    if (field === "profile.products[].category" && profile.persona === "UMKM_EXISTING") {
      const known = profile.products.filter((product) => product.category !== null).length;
      status = known === 0 ? "UNKNOWN" : known === profile.products.length ? "KNOWN" : "PARTIAL";
    }
    target.push(makeAvailability(catalogId, {
      domain: "PROFILE", metric: "PROFILE_FIELD", subjectKind: "PROFILE_FIELD", subjectId: field,
      status, unit: field === "profile.budget" || field === "profile.averagePrice" ? "IDR_RANGE" : field === "profile.products[].price" ? "IDR" : null,
      sourceRef: status === "UNKNOWN" ? null : profileSourceRef(field, field), reason: status === "UNKNOWN" ? "NOT_PROVIDED" : null,
    }));
  }
}

function financialAvailability(
  catalogId: string,
  profile: OpportunityProfileContext,
  profileSourceRef: (field: ProfileSourceField, subjectId: string) => string,
): { availability: OpportunityCatalogAvailability[]; gaps: OpportunityEvidenceGap[] } {
  const built = buildOpportunityEvidenceAvailability(profile);
  const refs = new Map<string, string>();
  const availability = built.inventory.map((item) => {
    const sourceField = profileSourceFieldSchema.safeParse(item.trustedSourceReference);
    if (!sourceField.success) throw new OpportunityFactCatalogError("INVALID_INPUT");
    const itemSourceRef = profileSourceRef(sourceField.data as ProfileSourceField, item.subjectId);
    const value = makeAvailability(catalogId, {
      domain: "FINANCIAL", metric: item.metric, subjectKind: item.subjectScope, subjectId: item.subjectId,
      status: item.status, unit: unitForFinancialMetric(item.metric), sourceRef: itemSourceRef, reason: item.status === "UNKNOWN" ? "NOT_PROVIDED" : null,
    });
    refs.set(item.id, value.id);
    return value;
  });
  const gaps = built.eligibleGaps.map((item) => {
    const availabilityRef = refs.get(item.availabilityEntryId) ?? "";
    const trustedAvailability = availability.find((entry) => entry.id === availabilityRef);
    return {
      id: digest("gapref", [catalogId, item]), code: item.code, availabilityRef,
      metric: item.metric, subjectScope: item.subjectScope, subjectId: item.subjectId,
      sourceRef: trustedAvailability?.sourceRef ?? profileSourceRef("context.financialEvidenceAvailability", item.subjectId),
    };
  });
  return { availability, gaps };
}

function addSearchApiFacts(
  catalogId: string, evidence: SearchApiOpportunityEvidence, source: OpportunityCatalogSource,
  facts: OpportunityFact[], availability: OpportunityCatalogAvailability[],
): void {
  const subject = { kind: "QUERY" as const, id: `${evidence.sourceType}:${evidence.position}:${evidence.query}`, label: evidence.query };
  if (evidence.sourceType === "RELATED_QUERY_TOP") {
    const known = evidence.interestIndex !== null;
    if (known) addFact(facts, catalogId, source.id, { sourceType: "SEARCHAPI", metric: "RELATED_QUERY_INTEREST_INDEX", subject, value: evidence.interestIndex as number, unit: "RELATIVE_INDEX_0_100" });
    availability.push(makeAvailability(catalogId, {
      domain: "SEARCHAPI", metric: "RELATED_QUERY_INTEREST_INDEX", subjectKind: "QUERY", subjectId: subject.id,
      status: known ? "KNOWN" : "UNKNOWN", unit: "RELATIVE_INDEX_0_100", sourceRef: known ? source.id : null, reason: known ? null : "NOT_PROVIDED",
    }));
    return;
  }

  if (evidence.growthPercent !== null) addFact(facts, catalogId, source.id, { sourceType: "SEARCHAPI", metric: "RELATED_QUERY_GROWTH_PERCENT", subject, value: evidence.growthPercent, unit: "PERCENT" });
  if (evidence.isBreakout) {
    addFact(facts, catalogId, source.id, { sourceType: "SEARCHAPI", metric: "RELATED_QUERY_BREAKOUT", subject, value: "Breakout", unit: "SOURCE_LABEL" });
  } else if (evidence.growthLabel) {
    addFact(facts, catalogId, source.id, { sourceType: "SEARCHAPI", metric: "RELATED_QUERY_GROWTH_LABEL", subject, value: evidence.growthLabel, unit: "SOURCE_LABEL" });
  }
  availability.push(makeAvailability(catalogId, {
    domain: "SEARCHAPI", metric: "RELATED_QUERY_GROWTH_PERCENT", subjectKind: "QUERY", subjectId: subject.id,
    status: evidence.growthPercent === null ? "UNKNOWN" : "KNOWN", unit: "PERCENT",
    sourceRef: evidence.growthPercent === null ? null : source.id,
    reason: evidence.growthPercent === null ? (evidence.isBreakout ? "BREAKOUT_LABEL_ONLY" : "NOT_PROVIDED") : null,
  }));
  availability.push(makeAvailability(catalogId, {
    domain: "SEARCHAPI", metric: "RELATED_QUERY_GROWTH_LABEL", subjectKind: "QUERY", subjectId: subject.id,
    status: evidence.growthLabel === null ? "UNKNOWN" : "KNOWN", unit: "SOURCE_LABEL",
    sourceRef: evidence.growthLabel === null ? null : source.id, reason: evidence.growthLabel === null ? "NOT_PROVIDED" : null,
  }));
}

export function buildOpportunityFactCatalog(input: Readonly<{
  ownerId: SafeUser["id"];
  profile: BuiltOpportunityProfileContext;
  evidence: readonly SearchApiOpportunityEvidence[];
}>): OpportunityFactCatalog {
  const ownerId = userIdSchema.safeParse(input.ownerId);
  const projection = builtOpportunityProfileProjectionSchema.safeParse(input.profile);
  const evidenceParsed = z.array(searchApiOpportunityEvidenceSchema).safeParse(input.evidence);
  if (!ownerId.success || !projection.success || !evidenceParsed.success) throw new OpportunityFactCatalogError("INVALID_INPUT");

  for (const evidence of evidenceParsed.data) {
    if (evidence.sourceType === "RELATED_QUERY_TOP" && evidence.interestIndex !== null && evidence.interestIndex > OPPORTUNITY_TOP_INTEREST_INDEX_MAX) {
      throw new OpportunityFactCatalogError("INVALID_TOP_INDEX");
    }
    if (evidence.sourceType === "RELATED_QUERY_RISING" && (evidence.growthLabel?.toLocaleLowerCase("en-US") === "breakout") !== evidence.isBreakout) {
      throw new OpportunityFactCatalogError("INVALID_INPUT");
    }
  }
  const evidenceKeys = evidenceParsed.data.map((item) => [item.sourceType, item.position, item.query]);
  if (new Set(evidenceKeys.map(canonicalJson)).size !== evidenceKeys.length) throw new OpportunityFactCatalogError("DUPLICATE_EVIDENCE");

  const personScope = ownerScope(ownerId.data);
  const catalogId = digest("catalog", [OPPORTUNITY_FACT_CATALOG_VERSION, personScope, projection.data, evidenceParsed.data]);
  const sources: OpportunityCatalogSource[] = [];
  const sourceIds = new Map<string, string>();
  const profileSourceRef = (field: ProfileSourceField, subjectId: string): string => {
    const key = canonicalJson([field, subjectId]);
    const existing = sourceIds.get(key);
    if (existing) return existing;
    const id = digest("src", [catalogId, "PROFILE", projection.data.profile.persona, field, subjectId]);
    sourceIds.set(key, id);
    sources.push({ id, sourceType: "PROFILE", persona: projection.data.profile.persona, profileField: field, subjectId });
    return id;
  };
  const facts: OpportunityFact[] = [];
  const availability: OpportunityCatalogAvailability[] = [];
  profileFacts(projection.data.profile, catalogId, profileSourceRef, facts);
  addProfileAvailability(catalogId, projection.data, profileSourceRef, availability);

  const financial = financialAvailability(catalogId, projection.data.profile, profileSourceRef);
  availability.push(...financial.availability);
  for (const item of evidenceParsed.data) {
    const source = searchSource(item, catalogId);
    sources.push(source);
    addSearchApiFacts(catalogId, item, source, facts, availability);
  }

  return opportunityFactCatalogSchema.parse({
    version: OPPORTUNITY_FACT_CATALOG_VERSION, id: catalogId, ownerScope: personScope,
    persona: projection.data.profile.persona, sources, facts, availability, eligibleGaps: financial.gaps,
  });
}

export type ResolveOpportunityFactReferencesOptions = Readonly<{
  ownerId: SafeUser["id"];
  now?: Date;
  requireFresh?: boolean;
  expected?: Readonly<{ metric?: OpportunityFact["metric"]; unit?: OpportunityFact["unit"]; subjectKind?: OpportunityFact["subject"]["kind"]; subjectId?: string }>;
}>;

export function createOpportunityFactReference(catalog: OpportunityFactCatalog, factId: string): OpportunityFactReference {
  const parsed = opportunityFactCatalogSchema.safeParse(catalog);
  if (!parsed.success || !parsed.data.facts.some((fact) => fact.id === factId)) throw new OpportunityFactCatalogError("INVALID_REFERENCE");
  return { catalogId: parsed.data.id, factId };
}

export function resolveOpportunityFactReferences(
  catalogInput: OpportunityFactCatalog,
  references: readonly OpportunityFactReference[],
  options: ResolveOpportunityFactReferencesOptions,
): readonly OpportunityFact[] {
  const parsed = opportunityFactCatalogSchema.safeParse(catalogInput);
  if (!parsed.success || !userIdSchema.safeParse(options.ownerId).success) throw new OpportunityFactCatalogError("INVALID_REFERENCE");
  const catalog = parsed.data;
  if (catalog.ownerScope !== ownerScope(options.ownerId)) throw new OpportunityFactCatalogError("CROSS_CONTEXT_REFERENCE");
  if (options.requireFresh && !(options.now instanceof Date && Number.isFinite(options.now.getTime()))) throw new OpportunityFactCatalogError("INVALID_REFERENCE");

  const seen = new Set<string>();
  const facts: OpportunityFact[] = [];
  for (const reference of references) {
    if (!reference || typeof reference.catalogId !== "string" || typeof reference.factId !== "string") throw new OpportunityFactCatalogError("INVALID_REFERENCE");
    if (reference.catalogId !== catalog.id) throw new OpportunityFactCatalogError("CROSS_CONTEXT_REFERENCE");
    if (seen.has(reference.factId)) throw new OpportunityFactCatalogError("DUPLICATE_REFERENCE");
    seen.add(reference.factId);
    const fact = catalog.facts.find((item) => item.id === reference.factId);
    if (!fact) throw new OpportunityFactCatalogError("INVALID_REFERENCE");
    const expected = options.expected;
    if (expected && ((expected.metric !== undefined && fact.metric !== expected.metric) || (expected.unit !== undefined && fact.unit !== expected.unit)
      || (expected.subjectKind !== undefined && fact.subject.kind !== expected.subjectKind) || (expected.subjectId !== undefined && fact.subject.id !== expected.subjectId))) {
      throw new OpportunityFactCatalogError("REFERENCE_MISMATCH");
    }
    if (options.requireFresh) {
      const source = catalog.sources.find((item) => item.id === fact.sourceRef);
      if (source?.sourceType === "SEARCHAPI" && Date.parse(source.expiresAt) <= (options.now as Date).getTime()) {
        throw new OpportunityFactCatalogError("STALE_REFERENCE");
      }
    }
    facts.push(fact);
  }
  return facts;
}

export const proposedExperimentParameterSchema = z.discriminatedUnion("kind", [
  z.object({ status: z.literal("PROPOSED"), kind: z.literal("SAMPLE_SIZE"), value: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), unit: z.literal("PEOPLE"), sourceRef: z.null() }).strict(),
  z.object({ status: z.literal("PROPOSED"), kind: z.literal("DURATION"), value: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), unit: z.literal("DAYS"), sourceRef: z.null() }).strict(),
  z.object({ status: z.literal("PROPOSED"), kind: z.literal("PRODUCT_VARIANT_COUNT"), value: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), unit: z.literal("VARIANTS"), sourceRef: z.null() }).strict(),
  z.object({ status: z.literal("PROPOSED"), kind: z.literal("INTERVIEW_COUNT"), value: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), unit: z.literal("PEOPLE"), sourceRef: z.null() }).strict(),
  z.object({ status: z.literal("PROPOSED"), kind: z.literal("PRICE_TEST"), min: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), max: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), unit: z.literal("IDR"), sourceRef: z.null() }).strict().refine((value) => value.min <= value.max),
]);

export type ProposedExperimentParameter = z.infer<typeof proposedExperimentParameterSchema>;

export function resolveOpportunityEvidenceGaps(
  catalogInput: OpportunityFactCatalog,
  gapIds: readonly string[],
  options: Readonly<{ ownerId: SafeUser["id"]; expected?: Readonly<{ metric?: OpportunityFinancialMetric; subjectScope?: OpportunityEvidenceSubjectScope; subjectId?: string }> }>,
): readonly OpportunityEvidenceGap[] {
  const parsed = opportunityFactCatalogSchema.safeParse(catalogInput);
  if (!parsed.success || !userIdSchema.safeParse(options.ownerId).success) throw new OpportunityFactCatalogError("INVALID_REFERENCE");
  if (parsed.data.ownerScope !== ownerScope(options.ownerId)) throw new OpportunityFactCatalogError("CROSS_CONTEXT_REFERENCE");
  if (new Set(gapIds).size !== gapIds.length) throw new OpportunityFactCatalogError("DUPLICATE_REFERENCE");
  return gapIds.map((id) => {
    const gap = parsed.data.eligibleGaps.find((item) => item.id === id);
    if (!gap) throw new OpportunityFactCatalogError("INVALID_REFERENCE");
    const expected = options.expected;
    if (expected && ((expected.metric !== undefined && gap.metric !== expected.metric) || (expected.subjectScope !== undefined && gap.subjectScope !== expected.subjectScope) || (expected.subjectId !== undefined && gap.subjectId !== expected.subjectId))) {
      throw new OpportunityFactCatalogError("REFERENCE_MISMATCH");
    }
    return gap;
  });
}

// Compile-time anchors keep this internal catalog aligned with current server-owned contracts.
export type OpportunityFactCatalogProfileProjection = BuiltOpportunityProfileContext;
export type OpportunityFactCatalogGapMetric = OpportunityFinancialMetric;
export type OpportunityFactCatalogGapCode = OpportunityEvidenceGapCode;
export type OpportunityFactCatalogStatus = OpportunityEvidenceStatus;
export type OpportunityFactCatalogScope = OpportunityEvidenceSubjectScope;
export type OpportunityFactCatalogProfileField = OpportunityProfileField;
