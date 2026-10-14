import "server-only";

import { ONBOARDING_STATUSES, USER_TYPES, type SafeUser, type UserType } from "../auth/user-types";
import { BusinessProfileService } from "../profile/business-service";
import { EntrepreneurProfileService } from "../profile/service";
import { ReferenceRepository } from "../reference/repository";
import type { LiveTrendAnalysisRequest, LiveTrendAnalysisResponse } from "../trend/live-signals-contract";
import { getTrendAnalysisAvailability, getLiveTrendSignalsService, LiveSignalsError, type ResolvedLiveSignal } from "../trend/live-signals";
import { opportunityAnalysisSchema, type OpportunityAnalysis } from "./domain";
import { NINEROUTER_REQUESTED_MODEL, NINEROUTER_PROVIDER, readLocalProfileNineRouterConfig } from "./ninerouter";

export type TrendSignalProfileContext = Readonly<{
  persona: UserType;
  productCategories: readonly string[];
  preferredProductType?: string;
  customerSegments: readonly string[];
  salesChannels: readonly string[];
  experienceLevel?: "BEGINNER" | "SOME_EXPERIENCE" | "EXPERIENCED";
  timeCommitment?: "LIMITED" | "PART_TIME" | "FULL_TIME";
}>;

export type TrendSignalAnalysisInput = Readonly<{
  profile: TrendSignalProfileContext;
  signal: Readonly<{
    title: string;
    classification: "LIKELY_FNB" | "REVIEW_REQUIRED";
    geo: "ID";
    sourceName: "Google Trends";
    sourceUrl: string;
    retrievedAt: string;
    volume: number | string | null;
    volumeChange: number | string | null;
    metricsUnit: "UNSPECIFIED";
  }>;
}>;

export interface TrendSignalAnalysisProvider {
  readonly mode: "LIVE_PROVIDER" | "MOCK_TEST";
  generate(input: TrendSignalAnalysisInput, requestId: string): Promise<OpportunityAnalysis>;
}

export type TrendSignalAnalysisErrorCode =
  | "INVALID_REQUEST"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "PROFILE_INCOMPLETE"
  | "INSUFFICIENT_DATA"
  | "SNAPSHOT_NOT_FOUND"
  | "CONSENT_REQUIRED"
  | "SOURCE_PROCESSING_NOT_APPROVED"
  | "AI_SERVICE_UNAVAILABLE"
  | "RATE_LIMITED"
  | "AI_RESPONSE_INVALID"
  | "AI_UPSTREAM_FAILED"
  | "AI_UPSTREAM_UNAVAILABLE"
  | "AI_UPSTREAM_TIMEOUT"
  | "AI_UPSTREAM_NETWORK_FAILED"
  | "AI_UPSTREAM_AUTH_FAILED"
  | "AI_FEATURE_DISABLED"
  | "AI_PROVIDER_CONFIGURATION_UNAVAILABLE";

export type TrendSignalProviderDiagnosticCategory =
  | "REQUEST_REJECTED"
  | "NETWORK"
  | "TIMEOUT"
  | "UPSTREAM_HTTP"
  | "UPSTREAM_UNAVAILABLE"
  | "RATE_LIMITED"
  | "UPSTREAM_AUTH"
  | "CONFIGURATION_UNAVAILABLE"
  | "INVALID_RESPONSE"
  | "RESPONSE_TOO_LARGE"
  | "CONCURRENCY_LIMIT";

export type TrendSignalProviderDiagnostic = Readonly<{
  category: TrendSignalProviderDiagnosticCategory;
  upstreamStatus: number | null;
  outboundAttempted: boolean;
}>;

export class TrendSignalAnalysisError extends Error {
  override readonly name = "TrendSignalAnalysisError";
  constructor(
    readonly code: TrendSignalAnalysisErrorCode,
    readonly retryAfterSeconds = 60,
    readonly providerDiagnostic: TrendSignalProviderDiagnostic | null = null,
  ) {
    super("Trend signal analysis could not be completed.");
  }
}

export interface TrendSignalProfileContextBuilder {
  build(user: SafeUser & { readonly userType: UserType }): Promise<TrendSignalProfileContext>;
}

type TrendSignalAnalysisServiceOptions = Readonly<{
  environment?: Readonly<Record<string, string | undefined>>;
  profileBuilder?: TrendSignalProfileContextBuilder;
  resolveSignal?: (userId: string, snapshotId: string, signalId: string) => ResolvedLiveSignal;
  providerFactory?: (env: Readonly<Record<string, string | undefined>>) => TrendSignalAnalysisProvider;
  now?: () => Date;
}>;

function namesForIds(ids: readonly string[], options: readonly { readonly id: string; readonly name: string }[]): readonly string[] {
  const byId = new Map(options.map((item) => [item.id, item.name]));
  return [...new Set(ids.flatMap((id) => {
    const name = byId.get(id);
    return name ? [name] : [];
  }))].slice(0, 12);
}

function safePreferredProductType(value: string | null): string | undefined {
  const normalized = value
    ?.normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 100);
  return normalized || undefined;
}

export class DatabaseTrendSignalProfileContextBuilder implements TrendSignalProfileContextBuilder {
  async build(user: SafeUser & { readonly userType: UserType }): Promise<TrendSignalProfileContext> {
    const references = new ReferenceRepository();
    const [categories, segments, channels] = await Promise.all([
      references.listActiveFnbCategories(),
      references.listActiveCustomerSegments(),
      references.listActiveSalesChannels(),
    ]);
    const common = {
      segmentNames: (ids: readonly string[]) => namesForIds(ids, segments),
      channelNames: (ids: readonly string[]) => namesForIds(ids, channels),
    };

    if (user.userType === USER_TYPES.ENTREPRENEUR) {
      const profile = await new EntrepreneurProfileService().getForEdit(user.id);
      const productCategories = namesForIds(profile.interestCategoryIds, categories);
      const customerSegments = common.segmentNames(profile.customerSegmentIds);
      const salesChannels = common.channelNames(profile.salesChannelIds);
      if (productCategories.length === 0 || customerSegments.length === 0 || salesChannels.length === 0) {
        throw new TrendSignalAnalysisError("PROFILE_INCOMPLETE");
      }
      const preferredProductType = safePreferredProductType(profile.preferredProductType);
      return {
        persona: user.userType,
        productCategories,
        ...(preferredProductType ? { preferredProductType } : {}),
        customerSegments,
        salesChannels,
        experienceLevel: profile.experienceLevel,
        timeCommitment: profile.timeCommitment,
      };
    }

    const profile = await new BusinessProfileService().getForEdit(user.id);
    const categoryIds = [profile.businessCategoryId, ...profile.products.flatMap((product) => product.categoryId ? [product.categoryId] : [])];
    const productCategories = namesForIds(categoryIds, categories);
    const customerSegments = common.segmentNames(profile.customerSegmentIds);
    const salesChannels = common.channelNames(profile.salesChannelIds);
    if (productCategories.length === 0 || customerSegments.length === 0 || salesChannels.length === 0) {
      throw new TrendSignalAnalysisError("PROFILE_INCOMPLETE");
    }
    return { persona: user.userType, productCategories, customerSegments, salesChannels };
  }
}

const ANALYSIS_RATE_LIMIT_MS = 60_000;
const analysisNextAllowedAt = new Map<string, number>();

function validateGrounding(analysis: OpportunityAnalysis, input: TrendSignalAnalysisInput): void {
  const combined = [analysis.summary, analysis.whyRelevant, analysis.targetConsumer, analysis.competition,
    analysis.potential, analysis.nextAction, ...analysis.risks].join(" ");
  if (/\b(dijamin|pasti berhasil|pasti sukses|keuntungan pasti|akan untung|tanpa risiko|dipastikan berhasil)\b/iu.test(combined)) {
    throw new TrendSignalAnalysisError("AI_RESPONSE_INVALID");
  }
  const allowedNumbers = new Set(input.signal.title.match(/\d+(?:[.,]\d+)*/gu) ?? []);
  if ((combined.match(/\d+(?:[.,]\d+)*/gu) ?? []).some((value) => !allowedNumbers.has(value))) {
    throw new TrendSignalAnalysisError("AI_RESPONSE_INVALID");
  }
}

export class TrendSignalAnalysisService {
  private readonly env: Readonly<Record<string, string | undefined>>;
  private readonly profileBuilder: TrendSignalProfileContextBuilder;
  private readonly resolveSignal: NonNullable<TrendSignalAnalysisServiceOptions["resolveSignal"]>;
  private readonly providerFactory: NonNullable<TrendSignalAnalysisServiceOptions["providerFactory"]>;
  private readonly now: () => Date;

  constructor(options: TrendSignalAnalysisServiceOptions = {}) {
    this.env = options.environment ?? process.env;
    this.profileBuilder = options.profileBuilder ?? new DatabaseTrendSignalProfileContextBuilder();
    this.resolveSignal = options.resolveSignal ?? ((userId, snapshotId, signalId) => getLiveTrendSignalsService().resolve(userId, snapshotId, signalId));
    this.providerFactory = options.providerFactory ?? (() => {
      throw new TrendSignalAnalysisError("AI_SERVICE_UNAVAILABLE");
    });
    this.now = options.now ?? (() => new Date());
  }

  async generate(user: SafeUser | null, request: LiveTrendAnalysisRequest, requestId: string): Promise<LiveTrendAnalysisResponse> {
    if (!user) throw new TrendSignalAnalysisError("UNAUTHENTICATED");
    if (!user.userType || (user.userType !== USER_TYPES.ENTREPRENEUR && user.userType !== USER_TYPES.UMKM_EXISTING)) {
      throw new TrendSignalAnalysisError("FORBIDDEN");
    }
    if (user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED) throw new TrendSignalAnalysisError("PROFILE_INCOMPLETE");
    if (request.consent !== true || request.disclosureVersion !== "trends-ninerouter-profile-v2") {
      throw new TrendSignalAnalysisError("CONSENT_REQUIRED");
    }

    const availability = getTrendAnalysisAvailability(this.env);
    if (availability.status === "BLOCKED") {
      if (availability.reason === "SOURCE_PROCESSING_NOT_APPROVED") throw new TrendSignalAnalysisError("SOURCE_PROCESSING_NOT_APPROVED");
      if (availability.reason === "AI_FEATURE_DISABLED") throw new TrendSignalAnalysisError("AI_FEATURE_DISABLED");
      if (availability.reason === "AI_PROVIDER_CONFIGURATION_UNAVAILABLE") throw new TrendSignalAnalysisError("AI_PROVIDER_CONFIGURATION_UNAVAILABLE");
      throw new TrendSignalAnalysisError("AI_SERVICE_UNAVAILABLE");
    }

    const now = this.now().getTime();
    const nextAllowedAt = analysisNextAllowedAt.get(user.id) ?? 0;
    if (nextAllowedAt > now) throw new TrendSignalAnalysisError("RATE_LIMITED", Math.ceil((nextAllowedAt - now) / 1000));
    analysisNextAllowedAt.set(user.id, now + ANALYSIS_RATE_LIMIT_MS);

    let resolved: ResolvedLiveSignal;
    try {
      resolved = this.resolveSignal(user.id, request.snapshotId, request.signalId);
    } catch (error) {
      if (error instanceof LiveSignalsError) throw new TrendSignalAnalysisError("SNAPSHOT_NOT_FOUND");
      throw error;
    }
    if (resolved.freshness !== "CURRENT") throw new TrendSignalAnalysisError("INSUFFICIENT_DATA");
    const profile = await this.profileBuilder.build(user as SafeUser & { readonly userType: UserType });
    const firstObservation = resolved.candidate.observations[0];
    if (!firstObservation) throw new TrendSignalAnalysisError("INSUFFICIENT_DATA");
    const input: TrendSignalAnalysisInput = {
      profile,
      signal: {
        title: resolved.signal.title,
        classification: resolved.signal.classification,
        geo: "ID",
        sourceName: "Google Trends",
        sourceUrl: resolved.signal.source.url,
        retrievedAt: resolved.signal.source.retrievedAt,
        volume: firstObservation.volume,
        volumeChange: firstObservation.volumeChange,
        metricsUnit: "UNSPECIFIED",
      },
    };

    let raw: unknown;
    let provider: TrendSignalAnalysisProvider;
    try {
      provider = this.providerFactory(this.env);
      raw = await provider.generate(input, requestId);
    } catch (error) {
      if (error instanceof TrendSignalAnalysisError) throw error;
      throw new TrendSignalAnalysisError("AI_UPSTREAM_FAILED");
    }
    const parsed = opportunityAnalysisSchema.safeParse(raw);
    if (!parsed.success) throw new TrendSignalAnalysisError("AI_RESPONSE_INVALID");
    validateGrounding(parsed.data, input);

    return {
      analysis: parsed.data,
      provider: NINEROUTER_PROVIDER,
      model: NINEROUTER_REQUESTED_MODEL,
      mode: provider.mode,
      generatedAt: this.now().toISOString(),
      sourceReference: {
        title: resolved.signal.title,
        publisher: "Google Trends",
        url: resolved.signal.source.url,
        retrievedAt: resolved.signal.source.retrievedAt,
        classification: resolved.signal.classification,
      },
      limitations: [
        "Analisis merupakan interpretasi model atas sinyal pencarian dan konteks profil terpilih, bukan fakta pasar atau saran profesional.",
        "Klasifikasi F&B bersifat heuristic; sinyal belum divalidasi secara faktual atau dipublikasikan sebagai Trend VENTUREX.",
        "Rentang Trending Now yang diminta ditampilkan terpisah dari waktu mulai tren; nilai volume tidak disertai unit dan tidak boleh ditafsirkan sebagai besaran permintaan.",
        "Informasi profil yang dikirim terbatas pada kategori, segmen, kanal, dan bila relevan tingkat pengalaman serta komitmen waktu; data lokasi, nama, email, catatan, uraian bebas, dan angka finansial dikecualikan. Retensi dan pemrosesan lanjutan pada layanan 9Router tidak diverifikasi oleh VENTUREX.",
        "Hasil hanya ditampilkan pada respons ini dan tidak disimpan oleh fitur ini ke database VENTUREX.",
      ],
    };
  }
}

export function readTrendSignalNineRouterConfig(env: Readonly<Record<string, string | undefined>> = process.env) {
  if (getTrendAnalysisAvailability(env).status !== "AVAILABLE") return null;
  const config = readLocalProfileNineRouterConfig(env);
  return config?.provider === NINEROUTER_PROVIDER && config.model === NINEROUTER_REQUESTED_MODEL ? config : null;
}
