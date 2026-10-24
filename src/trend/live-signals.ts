import "server-only";

import { randomUUID } from "node:crypto";

import { NINEROUTER_REQUESTED_MODEL, NINEROUTER_PROVIDER, readLocalProfileNineRouterConfig } from "../ai-analysis/ninerouter";
import { liveTrendSignalsResponseSchema, type LiveTrendSignal, type LiveTrendSignalsResponse } from "./live-signals-contract";

export const GOOGLE_TRENDS_TIME_WINDOWS_HOURS = [4, 24, 48, 168] as const;
export type GoogleTrendsTimeWindowHours = (typeof GOOGLE_TRENDS_TIME_WINDOWS_HOURS)[number];

export function buildGoogleTrendsTrendingNowTarget(hours: GoogleTrendsTimeWindowHours): string {
  return `https://trends.google.com/trending?geo=ID&hl=id&brd_json=1&hours=${hours}`;
}

export type LiveSignalsCandidate = Readonly<{
  query: string;
  classification: "LIKELY_FNB" | "REVIEW_REQUIRED" | "OUT_OF_SCOPE";
  matchedKeywords: readonly string[];
  explanation: string;
  observations: readonly {
    startedAtUnixSeconds: number;
    active: boolean;
    volume: number | string | null;
    volumeChange: number | string | null;
    categories: readonly unknown[];
    relatedQueries: { availability: "AVAILABLE" | "UNAVAILABLE" };
    geo: "ID";
    provenance: {
      retrievedAt: string;
      sourceUrl: string;
    };
  }[];
}>;

export const LIVE_SIGNAL_CACHE_TTL_MS = 5 * 60_000;
export const LIVE_SIGNAL_STALE_MAX_AGE_MS = 60 * 60_000;
export const LIVE_SIGNAL_REFRESH_COOLDOWN_MS = 60_000;
const MAX_LIVE_SIGNALS = 40;

export type LiveSignalsEnvironment = Readonly<Record<string, string | undefined>>;
export type ScreenedBatch = Readonly<{
  status: "COMPLETE" | "PARTIAL";
  candidates: readonly LiveSignalsCandidate[];
  totalRecords: number;
  acceptedRecords: number;
  rejectedRecords: number;
  fieldAvailability: {
    relatedQueries: {
      available: number;
      unavailable: number;
      invalid: number;
      uninspectable: number;
    };
  };
  screeningSummary: {
    inputRecords: number;
    acceptedParsedRecords: number;
    rejectedParsedRecords: number;
    uniqueScreenedGroups: number;
    classifications: {
      LIKELY_FNB: number;
      REVIEW_REQUIRED: number;
      OUT_OF_SCOPE: number;
    };
  };
}>;
export type ProviderPort = {
  collectAndScreenCandidateBatch(options: { hours: GoogleTrendsTimeWindowHours }): Promise<ScreenedBatch>;
};

export type LiveSignalsErrorCode =
  | "DISPLAY_RIGHTS_UNVERIFIED"
  | "LIVE_PREVIEW_DISABLED"
  | "PROVIDER_NOT_CONFIGURED"
  | "SOURCE_RATE_LIMITED"
  | "SOURCE_PROVIDER_UNAVAILABLE"
  | "SOURCE_PROVIDER_TIMEOUT"
  | "SOURCE_RESPONSE_INVALID"
  | "SNAPSHOT_NOT_FOUND";

export class LiveSignalsError extends Error {
  override readonly name = "LiveSignalsError";
  constructor(readonly code: LiveSignalsErrorCode, readonly retryAfterSeconds?: number) {
    super("Live Google Trends observations are unavailable.");
  }
}

type CachedBatch = Readonly<{ batch: ScreenedBatch; retrievedAt: string; storedAt: number }>;
type StoredSnapshot = Readonly<{
  userId: string;
  response: LiveTrendSignalsResponse;
  candidatesById: ReadonlyMap<string, LiveSignalsCandidate>;
  createdAt: number;
}>;

export type ResolvedLiveSignal = Readonly<{
  snapshotId: string;
  signal: LiveTrendSignal;
  candidate: LiveSignalsCandidate;
  freshness: "CURRENT" | "STALE";
}>;

function safeText(value: string, maxLength: number): string {
  return Array.from(value
    .normalize("NFKC")
    .replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/gu, "")
    .replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu, "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()).slice(0, maxLength).join("");
}

function providerErrorCode(error: unknown): LiveSignalsErrorCode {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: string }).code;
    if (code === "DISABLED" || code === "PROVIDER_NOT_CONFIGURED") return "PROVIDER_NOT_CONFIGURED";
    if (code === "TIMEOUT") return "SOURCE_PROVIDER_TIMEOUT";
    if (["INVALID_JSON", "INVALID_RESPONSE", "RESPONSE_TOO_LARGE"].includes(code)) return "SOURCE_RESPONSE_INVALID";
  }
  return "SOURCE_PROVIDER_UNAVAILABLE";
}

export function getTrendAnalysisAvailability(env: LiveSignalsEnvironment = process.env): LiveTrendSignalsResponse["analysisAvailability"] {
  if (env.AI_ANALYSIS_TRENDS_USER_INFERENCE_ENABLED !== "true") {
    return { status: "BLOCKED", reason: "AI_FEATURE_DISABLED" };
  }
  const config = readLocalProfileNineRouterConfig(env);
  if (!config || config.provider !== NINEROUTER_PROVIDER || config.model !== NINEROUTER_REQUESTED_MODEL) {
    return { status: "BLOCKED", reason: "AI_PROVIDER_CONFIGURATION_UNAVAILABLE" };
  }
  return { status: "AVAILABLE", reason: "READY" };
}

function toPublicSignal(candidate: LiveSignalsCandidate, id: string, timeWindowHours: GoogleTrendsTimeWindowHours): LiveTrendSignal | null {
  if (candidate.classification === "OUT_OF_SCOPE") return null;
  const observation = candidate.observations[0];
  if (!observation) return null;
  const title = safeText(candidate.query, 180);
  const retrievedAt = observation.provenance.retrievedAt;
  if (!title || !Number.isFinite(Date.parse(retrievedAt)) || observation.geo !== "ID") return null;
  const metric = (value: number | string | null) => ({
    availability: value === null ? "UNAVAILABLE" as const : "AVAILABLE" as const,
    value: typeof value === "string" ? safeText(value, 120) : value,
    unit: "UNSPECIFIED" as const,
  });
  return {
    id,
    title,
    classification: candidate.classification,
    matchedKeywords: candidate.matchedKeywords.map((keyword) => safeText(keyword, 80)).filter(Boolean).slice(0, 20),
    screeningExplanation: safeText(candidate.explanation, 500),
    observationCount: candidate.observations.length,
    source: {
      publisher: "Google Trends",
      url: observation.provenance.sourceUrl,
      geo: "ID",
      retrievedAt,
      providerStartedAtUnixSeconds: observation.startedAtUnixSeconds,
      timeWindowHours,
    },
    metrics: {
      volume: metric(observation.volume),
      volumeChange: metric(observation.volumeChange),
      active: { value: observation.active, semantics: "PROVIDER_FLAG_UNVERIFIED" },
      categoriesCount: observation.categories.length,
      relatedQueries: observation.relatedQueries.availability,
    },
    limitations: [
      "Observasi sumber, belum diverifikasi reviewer dan bukan Trend PUBLISHED VENTUREX.",
      "Trending Now menunjukkan aktivitas pencarian; bukan bukti pembelian, permintaan pasar, omzet, atau kelayakan usaha.",
      `Daftar Google Trends diminta untuk jendela ${timeWindowHours} jam; waktu mulai setiap tren adalah metadata terpisah dari sumber.`,
      "Unit dan arti metrik volume/volume_change belum terverifikasi; nilai sumber ditampilkan tanpa interpretasi.",
      candidate.classification === "REVIEW_REQUIRED"
        ? "Klasifikasi F&B ambigu dan memerlukan tinjauan manual."
        : "Label LIKELY_FNB berasal dari heuristic keyword, bukan validasi faktual.",
      ...(observation.relatedQueries.availability === "UNAVAILABLE" ? ["related_queries tidak tersedia pada record provider ini."] : []),
    ].slice(0, 8),
  };
}

type LiveSignalsServiceOptions = Readonly<{
  environment?: LiveSignalsEnvironment;
  createProvider?: (environment: LiveSignalsEnvironment) => ProviderPort;
  mode?: "LIVE_PROVIDER" | "MOCK_TEST";
  now?: () => Date;
  id?: () => string;
}>;

export class LiveTrendSignalsService {
  private readonly env: LiveSignalsEnvironment;
  private readonly createProvider: (environment: LiveSignalsEnvironment) => ProviderPort;
  private readonly now: () => Date;
  private readonly id: () => string;
  private readonly mode: "LIVE_PROVIDER" | "MOCK_TEST";
  private readonly cacheByWindow = new Map<GoogleTrendsTimeWindowHours, CachedBatch>();
  private readonly inFlightByWindow = new Map<GoogleTrendsTimeWindowHours, Promise<CachedBatch>>();
  private readonly snapshots = new Map<string, StoredSnapshot>();
  private readonly lastRefreshByUser = new Map<string, number>();
  private nextProviderAttemptAt = 0;

  constructor(options: LiveSignalsServiceOptions = {}) {
    this.env = options.environment ?? process.env;
    this.createProvider = options.createProvider ?? (() => {
      throw new LiveSignalsError("PROVIDER_NOT_CONFIGURED");
    });
    this.now = options.now ?? (() => new Date());
    this.id = options.id ?? randomUUID;
    this.mode = options.mode ?? "LIVE_PROVIDER";
  }

  private assertRefreshAllowed(): void {
    if (this.env.NODE_ENV === "production") {
      throw new LiveSignalsError("LIVE_PREVIEW_DISABLED");
    }
    if (this.env.BRIGHTDATA_TRENDS_DISPLAY_RIGHTS_CONFIRMED === "false") {
      throw new LiveSignalsError("DISPLAY_RIGHTS_UNVERIFIED");
    }
    if (this.env.VENTUREX_TRENDS_LIVE_PREVIEW_ENABLED !== "true") {
      throw new LiveSignalsError("LIVE_PREVIEW_DISABLED");
    }
    if (this.env.BRIGHTDATA_TRENDS_ENABLED === "false" || (this.env.BRIGHTDATA_TRENDS_API_KEY !== undefined && !this.env.BRIGHTDATA_TRENDS_API_KEY.trim())) {
      throw new LiveSignalsError("PROVIDER_NOT_CONFIGURED");
    }
  }

  private saveSnapshot(userId: string, cached: CachedBatch, timeWindowHours: GoogleTrendsTimeWindowHours, freshness: "CURRENT" | "STALE", cache: "NETWORK" | "COALESCED" | "CACHE"): LiveTrendSignalsResponse {
    const snapshotId = this.id();
    const candidatesById = new Map<string, LiveSignalsCandidate>();
    const signals: LiveTrendSignal[] = [];
    for (const candidate of cached.batch.candidates) {
      if (candidate.classification === "OUT_OF_SCOPE" || signals.length >= MAX_LIVE_SIGNALS) continue;
      const signalId = this.id();
      const item = toPublicSignal(candidate, signalId, timeWindowHours);
      if (!item) continue;
      candidatesById.set(signalId, candidate);
      signals.push(item);
    }
    const generatedAt = this.now().toISOString();
    const response = liveTrendSignalsResponseSchema.parse({
      snapshotId,
      mode: this.mode,
      generatedAt,
      retrievedAt: cached.retrievedAt,
      expiresAt: new Date(cached.storedAt + LIVE_SIGNAL_CACHE_TTL_MS).toISOString(),
      batchStatus: cached.batch.status,
      freshness,
      cache,
      source: {
        publisher: "Google Trends",
        geo: "ID",
        timeWindowHours,
        url: buildGoogleTrendsTrendingNowTarget(timeWindowHours),
      },
      records: {
        retrieved: cached.batch.totalRecords,
        accepted: cached.batch.acceptedRecords,
        rejected: cached.batch.rejectedRecords,
      },
      relatedQueriesAvailability: cached.batch.fieldAvailability.relatedQueries,
      screening: cached.batch.screeningSummary,
      signals,
      analysisAvailability: getTrendAnalysisAvailability(this.env),
      cacheLimitations: [
        "Snapshot hanya disimpan sementara di memori satu proses server; restart atau instance berbeda tidak berbagi cache.",
        "Cache memuat hasil provider yang telah dinormalisasi, bukan raw response, dan tidak ditulis ke database.",
        "Observasi tidak dipublikasikan atau dimasukkan ke katalog VENTUREX secara otomatis.",
      ],
    });
    const now = this.now().getTime();
    this.prune(now);
    this.snapshots.set(snapshotId, { userId, response, candidatesById, createdAt: now });
    return response;
  }

  private prune(now: number): void {
    for (const [snapshotId, snapshot] of this.snapshots) {
      if (now - snapshot.createdAt > LIVE_SIGNAL_CACHE_TTL_MS || this.snapshots.size > 200) this.snapshots.delete(snapshotId);
    }
    for (const [userId, last] of this.lastRefreshByUser) {
      if (now - last > LIVE_SIGNAL_REFRESH_COOLDOWN_MS * 4) this.lastRefreshByUser.delete(userId);
    }
  }

  async refresh(userId: string, timeWindowHours: GoogleTrendsTimeWindowHours = 24): Promise<LiveTrendSignalsResponse> {
    this.assertRefreshAllowed();
    const now = this.now().getTime();
    this.prune(now);
    const cachedForWindow = this.cacheByWindow.get(timeWindowHours);
    if (cachedForWindow && now - cachedForWindow.storedAt < LIVE_SIGNAL_CACHE_TTL_MS) {
      return this.saveSnapshot(userId, cachedForWindow, timeWindowHours, "CURRENT", "CACHE");
    }

    const userNextAllowedAt = (this.lastRefreshByUser.get(userId) ?? 0) + LIVE_SIGNAL_REFRESH_COOLDOWN_MS;
    const limitedUntil = Math.max(userNextAllowedAt, this.nextProviderAttemptAt);
    const inFlightForWindow = this.inFlightByWindow.get(timeWindowHours);
    if (!inFlightForWindow && limitedUntil > now) {
      if (cachedForWindow && now - cachedForWindow.storedAt <= LIVE_SIGNAL_STALE_MAX_AGE_MS) {
        return this.saveSnapshot(userId, cachedForWindow, timeWindowHours, "STALE", "CACHE");
      }
      throw new LiveSignalsError("SOURCE_RATE_LIMITED", Math.ceil((limitedUntil - now) / 1000));
    }

    if (inFlightForWindow) {
      try {
        const cached = await inFlightForWindow;
        return this.saveSnapshot(userId, cached, timeWindowHours, "CURRENT", "COALESCED");
      } catch (error) {
        return this.staleOrThrow(userId, timeWindowHours, error);
      }
    }

    this.lastRefreshByUser.set(userId, now);
    this.nextProviderAttemptAt = now + LIVE_SIGNAL_REFRESH_COOLDOWN_MS;
    const request = (async () => {
      const batch = await this.createProvider(this.env).collectAndScreenCandidateBatch({ hours: timeWindowHours });
      const cached: CachedBatch = { batch, retrievedAt: this.now().toISOString(), storedAt: this.now().getTime() };
      this.cacheByWindow.set(timeWindowHours, cached);
      return cached;
    })();
    this.inFlightByWindow.set(timeWindowHours, request);

    try {
      const cached = await request;
      return this.saveSnapshot(userId, cached, timeWindowHours, "CURRENT", "NETWORK");
    } catch (error) {
      return this.staleOrThrow(userId, timeWindowHours, error);
    } finally {
      if (this.inFlightByWindow.get(timeWindowHours) === request) this.inFlightByWindow.delete(timeWindowHours);
    }
  }

  private staleOrThrow(userId: string, timeWindowHours: GoogleTrendsTimeWindowHours, error: unknown): LiveTrendSignalsResponse {
    const now = this.now().getTime();
    const cached = this.cacheByWindow.get(timeWindowHours);
    if (cached && now - cached.storedAt <= LIVE_SIGNAL_STALE_MAX_AGE_MS) {
      return this.saveSnapshot(userId, cached, timeWindowHours, "STALE", "CACHE");
    }
    throw new LiveSignalsError(providerErrorCode(error));
  }

  resolve(userId: string, snapshotId: string, signalId: string): ResolvedLiveSignal {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot || snapshot.userId !== userId || this.now().getTime() - snapshot.createdAt > LIVE_SIGNAL_CACHE_TTL_MS) {
      this.snapshots.delete(snapshotId);
      throw new LiveSignalsError("SNAPSHOT_NOT_FOUND");
    }
    const signal = snapshot.response.signals.find((item) => item.id === signalId);
    const candidate = snapshot.candidatesById.get(signalId);
    if (!signal || !candidate) throw new LiveSignalsError("SNAPSHOT_NOT_FOUND");
    return { snapshotId, signal, candidate, freshness: snapshot.response.freshness };
  }

  latestForUser(userId: string): LiveTrendSignalsResponse | null {
    const now = this.now().getTime();
    this.prune(now);
    const latest = [...this.snapshots.values()]
      .filter((snapshot) => snapshot.userId === userId
        && snapshot.response.mode === "LIVE_PROVIDER"
        && snapshot.response.freshness === "CURRENT"
        && now - snapshot.createdAt <= LIVE_SIGNAL_CACHE_TTL_MS)
      .sort((left, right) => right.createdAt - left.createdAt)[0];
    return latest?.response ?? null;
  }
}

declare global {
  var __venturexLiveTrendSignalsService: LiveTrendSignalsService | undefined;
}

export function getLiveTrendSignalsService(): LiveTrendSignalsService {
  globalThis.__venturexLiveTrendSignalsService ??= new LiveTrendSignalsService();
  return globalThis.__venturexLiveTrendSignalsService;
}
