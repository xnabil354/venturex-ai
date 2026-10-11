import "server-only";

import { getCurrentUser as defaultCurrentUserResolver } from "../auth/current-user";
import {
  ONBOARDING_STATUSES,
  isUserType,
  type SafeUser,
  type UserType,
} from "../auth/user-types";
import { opportunityIdSchema } from "../opportunity/domain";
import {
  type OpportunityScoreRepositoryPort,
  OpportunityScoreRepository,
  type OpportunityScoreSourceRecord,
  type ActiveOpportunityScoreModelRecord,
} from "../opportunity/opportunity-score-repository";
import {
  calculateOpportunityScore,
  OPPORTUNITY_SCORE_COMPONENTS,
  OPPORTUNITY_SCORE_DISCLAIMER,
  OpportunityScoreInputError,
  type NormalizedOpportunityScoreComponents,
  type OpportunityScoreCalculationResult,
  type OpportunityScoreComponent,
  type OpportunityScorePolicy,
} from "./opportunity-score";

export const OPPORTUNITY_SCORE_APPROVAL_STATUS = "APPROVED";

export type OpportunityScoreSourceState = {
  readonly status: "AVAILABLE" | "UNAVAILABLE";
  readonly source: string;
  readonly explanation: string;
};

export type OpportunityScoreSources = Readonly<
  Record<OpportunityScoreComponent, OpportunityScoreSourceState>
>;

export type OpportunityScoreServiceReason =
  | "CONFIGURATION_UNAVAILABLE"
  | "CONFIGURATION_NOT_APPROVED"
  | "CONFIGURATION_AMBIGUOUS"
  | "INVALID_CONFIGURATION"
  | "COMPONENTS_UNAVAILABLE"
  | "INVALID_COMPONENTS";

export type OpportunityScoreServiceResult =
  | (Extract<OpportunityScoreCalculationResult, { readonly status: "AVAILABLE" }> & {
      readonly sources: OpportunityScoreSources;
    })
  | {
      readonly status: "INSUFFICIENT_DATA";
      readonly modelType: "OPPORTUNITY_SCORE";
      readonly modelVersion: string | null;
      readonly score: null;
      readonly breakdown: Extract<OpportunityScoreCalculationResult, { readonly status: "INSUFFICIENT_DATA" }> ["breakdown"];
      readonly missingComponents: readonly OpportunityScoreComponent[];
      readonly invalidComponents: readonly OpportunityScoreComponent[];
      readonly reason: OpportunityScoreServiceReason;
      readonly sources: OpportunityScoreSources;
      readonly disclaimer: string;
    };

export type OpportunityScoreDisplayState = OpportunityScoreServiceResult | {
  readonly status: "ERROR";
};

export class OpportunityScoreUnauthenticatedError extends Error {
  override readonly name = "OpportunityScoreUnauthenticatedError";

  constructor() {
    super("Authentication required.");
  }
}

export class OpportunityScoreAccessContextError extends Error {
  override readonly name = "OpportunityScoreAccessContextError";

  constructor() {
    super("Opportunity Score requires a completed user type.");
  }
}

export type OpportunityScoreServiceDependencies = {
  readonly repository?: OpportunityScoreRepositoryPort;
  readonly currentUserResolver?: () => Promise<SafeUser | null>;
};

const BASE_SOURCES: Omit<OpportunityScoreSources, "executionFeasibility" | "marketSustainability"> = {
  trendMomentum: {
    status: "UNAVAILABLE",
    source: "Trend terkurasi",
    explanation: "Data Trend yang tersimpan belum menyediakan nilai momentum numerik.",
  },
  demandSignal: {
    status: "UNAVAILABLE",
    source: "Data permintaan",
    explanation: "Belum ada input permintaan numerik yang disetujui untuk Opportunity.",
  },
  competition: {
    status: "UNAVAILABLE",
    source: "Ringkasan kompetisi Opportunity",
    explanation: "Label dan ringkasan kompetisi bersifat kualitatif dan tidak dipetakan ke angka.",
  },
  consumerRelevance: {
    status: "UNAVAILABLE",
    source: "Ringkasan target konsumen Opportunity",
    explanation: "Ringkasan target konsumen belum menjadi nilai relevansi numerik yang disetujui.",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function toNormalizedNumber(value: string | null): { value: number | null; valid: boolean } {
  if (value === null) return { value: null, valid: true };
  const normalized = value.trim();
  if (!/^[+-]?\d+(?:\.\d+)?$/u.test(normalized)) return { value: null, valid: false };
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return { value: null, valid: false };
  }
  return { value: parsed, valid: true };
}

function componentsFrom(record: OpportunityScoreSourceRecord): {
  readonly components: NormalizedOpportunityScoreComponents;
  readonly sources: OpportunityScoreSources;
  readonly invalidComponents: readonly OpportunityScoreComponent[];
} {
  const execution = toNormalizedNumber(record.executionFeasibility);
  const sustainability = toNormalizedNumber(record.marketSustainability);
  const sources: OpportunityScoreSources = {
    ...BASE_SOURCES,
    executionFeasibility: {
      status: execution.value === null ? "UNAVAILABLE" : "AVAILABLE",
      source: "Execution Feasibility tersimpan pada Opportunity",
      explanation: execution.valid
        ? execution.value === null ? "Nilai numerik belum tersedia." : "Nilai numerik tersimpan pada rentang 0–100."
        : "Nilai tersimpan tidak valid untuk rentang 0–100.",
    },
    marketSustainability: {
      status: sustainability.value === null ? "UNAVAILABLE" : "AVAILABLE",
      source: "Market Sustainability tersimpan pada Opportunity",
      explanation: sustainability.valid
        ? sustainability.value === null ? "Nilai numerik belum tersedia." : "Nilai numerik tersimpan pada rentang 0–100."
        : "Nilai tersimpan tidak valid untuk rentang 0–100.",
    },
  };
  const components: NormalizedOpportunityScoreComponents = {
    trendMomentum: null,
    demandSignal: null,
    competition: null,
    consumerRelevance: null,
    executionFeasibility: execution.value,
    marketSustainability: sustainability.value,
  };
  const invalidComponents = [
    ...(!execution.valid ? ["executionFeasibility" as const] : []),
    ...(!sustainability.valid ? ["marketSustainability" as const] : []),
  ];

  return { components, sources, invalidComponents };
}

function emptyBreakdown(
  components: NormalizedOpportunityScoreComponents,
): Extract<OpportunityScoreCalculationResult, { readonly status: "INSUFFICIENT_DATA" }> ["breakdown"] {
  return OPPORTUNITY_SCORE_COMPONENTS.map((component) => ({
    component,
    normalizedValue: components[component] ?? null,
    weight: null,
    weightedContribution: null,
  }));
}

function insufficient(
  reason: OpportunityScoreServiceReason,
  modelVersion: string | null,
  sources: OpportunityScoreSources,
  components: NormalizedOpportunityScoreComponents,
  invalidComponents: readonly OpportunityScoreComponent[] = [],
): OpportunityScoreServiceResult {
  const missingComponents = OPPORTUNITY_SCORE_COMPONENTS.filter((component) =>
    components[component] === null || components[component] === undefined,
  );
  return {
    status: "INSUFFICIENT_DATA",
    modelType: "OPPORTUNITY_SCORE",
    modelVersion,
    score: null,
    breakdown: emptyBreakdown(components),
    missingComponents,
    invalidComponents,
    reason,
    sources,
    disclaimer: OPPORTUNITY_SCORE_DISCLAIMER,
  };
}

function policyCandidate(model: ActiveOpportunityScoreModelRecord): unknown {
  if (!isRecord(model.configuration) || model.configuration.approvalStatus !== OPPORTUNITY_SCORE_APPROVAL_STATUS) {
    return null;
  }

  return {
    modelType: "OPPORTUNITY_SCORE",
    version: model.version,
    weights: model.weights,
    normalization: model.configuration.normalization,
    rounding: model.configuration.rounding,
  };
}

function assertEligible(records: readonly OpportunityScoreSourceRecord[], userType: UserType): void {
  if (records.some(({ relatedTrend }) =>
    relatedTrend.lifecycleState !== "PUBLISHED" ||
    !relatedTrend.affectedUserTypes.includes(userType),
  )) {
    throw new Error("The Opportunity Score repository returned an ineligible Opportunity.");
  }
}

function calculateForRecord(
  record: OpportunityScoreSourceRecord,
  activeModels: readonly ActiveOpportunityScoreModelRecord[],
): OpportunityScoreServiceResult {
  const { components, sources, invalidComponents } = componentsFrom(record);
  if (activeModels.length === 0) {
    return insufficient("CONFIGURATION_UNAVAILABLE", null, sources, components, invalidComponents);
  }
  if (activeModels.length > 1) {
    return insufficient("CONFIGURATION_AMBIGUOUS", null, sources, components, invalidComponents);
  }

  const model = activeModels[0];
  if (!model) {
    return insufficient("CONFIGURATION_UNAVAILABLE", null, sources, components, invalidComponents);
  }
  if (model.isActive !== true) {
    return insufficient("CONFIGURATION_UNAVAILABLE", model.version, sources, components, invalidComponents);
  }
  if (!isRecord(model.configuration) || model.configuration.approvalStatus !== OPPORTUNITY_SCORE_APPROVAL_STATUS) {
    return insufficient("CONFIGURATION_NOT_APPROVED", model.version, sources, components, invalidComponents);
  }
  if (invalidComponents.length > 0) {
    return insufficient("INVALID_COMPONENTS", model.version, sources, components, invalidComponents);
  }

  try {
    const result = calculateOpportunityScore({
      policy: policyCandidate(model) as OpportunityScorePolicy,
      normalizedComponents: components,
    });
    if (result.status === "INSUFFICIENT_DATA") {
      return {
        ...result,
        invalidComponents: [],
        reason: result.reason,
        sources,
      };
    }
    return { ...result, sources };
  } catch (error) {
    if (error instanceof OpportunityScoreInputError) {
      const reason = error.code === "INVALID_COMPONENTS" ? "INVALID_COMPONENTS" : "INVALID_CONFIGURATION";
      return insufficient(reason, model.version, sources, components, invalidComponents);
    }
    throw error;
  }
}

export class OpportunityScoreService {
  private readonly repository: OpportunityScoreRepositoryPort;
  private readonly currentUserResolver: () => Promise<SafeUser | null>;

  constructor(dependencies: OpportunityScoreServiceDependencies = {}) {
    this.repository = dependencies.repository ?? new OpportunityScoreRepository();
    this.currentUserResolver = dependencies.currentUserResolver ?? defaultCurrentUserResolver;
  }

  async calculateForOpportunity(idInput: unknown): Promise<OpportunityScoreServiceResult | null> {
    const user = await this.requireUser();
    const parsedId = opportunityIdSchema.safeParse(idInput);
    if (!parsedId.success) return null;

    const records = await this.repository.findVisibleSources(user.userType, [parsedId.data]);
    const record = records.find(({ id }) => id === parsedId.data);
    if (!record) return null;
    assertEligible([record], user.userType);
    const models = await this.repository.findActiveModels();
    return calculateForRecord(record, models);
  }

  async calculateForOpportunities(
    idInputs: readonly unknown[],
  ): Promise<Readonly<Record<string, OpportunityScoreServiceResult>>> {
    const user = await this.requireUser();
    const parsedIds = idInputs.map((id) => opportunityIdSchema.safeParse(id));
    if (parsedIds.some((result) => !result.success)) {
      throw new Error("Opportunity Score requires valid Opportunity identifiers.");
    }
    const ids: string[] = [...new Set<string>(parsedIds.map((result) => result.success ? result.data : ""))];
    if (ids.length === 0) return {};

    const records = await this.repository.findVisibleSources(user.userType, ids);
    if (records.length === 0) return {};
    assertEligible(records, user.userType);

    const requested = new Set(ids);
    if (
      records.some(({ id }) => !requested.has(id)) ||
      new Set(records.map(({ id }) => id)).size !== records.length
    ) {
      throw new Error("The Opportunity Score repository returned an unexpected Opportunity.");
    }

    const models = await this.repository.findActiveModels();
    return Object.fromEntries(records.map((record) => [record.id, calculateForRecord(record, models)]));
  }

  private async requireUser(): Promise<SafeUser & { readonly userType: UserType }> {
    const user = await this.currentUserResolver();
    if (!user) throw new OpportunityScoreUnauthenticatedError();
    if (
      user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED ||
      !isUserType(user.userType)
    ) {
      throw new OpportunityScoreAccessContextError();
    }
    return user as SafeUser & { readonly userType: UserType };
  }
}
