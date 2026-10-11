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
  RiskAssessmentRepository,
  type ActiveRiskModelRecord,
  type RiskAssessmentRepositoryPort,
  type RiskAssessmentSourceRecord,
} from "../opportunity/risk-assessment-repository";
import {
  assessRisk,
  RISK_FACTORS,
  RiskAssessmentInputError,
  type RiskAssessmentReason,
  type RiskAssessmentResult,
} from "./risk-assessment";

export type RiskAssessmentDisplayState = RiskAssessmentResult | { readonly status: "ERROR" };

export class RiskAssessmentUnauthenticatedError extends Error {
  override readonly name = "RiskAssessmentUnauthenticatedError";

  constructor() {
    super("Authentication required.");
  }
}

export class RiskAssessmentAccessContextError extends Error {
  override readonly name = "RiskAssessmentAccessContextError";

  constructor() {
    super("Risk Indicator requires a completed user type.");
  }
}

export type RiskAssessmentServiceDependencies = {
  readonly repository?: RiskAssessmentRepositoryPort;
  readonly currentUserResolver?: () => Promise<SafeUser | null>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function insufficient(
  reason: RiskAssessmentReason,
  modelVersion: string | null,
  evidenceReferences: RiskAssessmentSourceRecord["evidenceReferences"] = [],
): RiskAssessmentResult {
  const limitations = [
    "Risk adalah indikator pendukung keputusan, bukan prediksi atau jaminan hasil bisnis.",
    "Hasil bergantung pada sumber input dan policy yang disetujui; validasi fakta pasar tetap diperlukan.",
  ];
  return {
    status: "INSUFFICIENT_DATA",
    modelType: "RISK",
    modelVersion,
    level: null,
    reason,
    missingFactors: RISK_FACTORS,
    evidenceReferences,
    limitations,
  };
}

function assertEligible(records: readonly RiskAssessmentSourceRecord[], userType: UserType): void {
  if (records.some(({ relatedTrend }) =>
    relatedTrend.lifecycleState !== "PUBLISHED" || !relatedTrend.affectedUserTypes.includes(userType),
  )) {
    throw new Error("The Risk repository returned an ineligible Opportunity.");
  }
}

function calculateForRecord(
  record: RiskAssessmentSourceRecord,
  activeModels: readonly ActiveRiskModelRecord[],
): RiskAssessmentResult {
  if (activeModels.length === 0) {
    return insufficient("CONFIGURATION_UNAVAILABLE", null, record.evidenceReferences);
  }
  if (activeModels.length > 1) {
    return insufficient("CONFIGURATION_AMBIGUOUS", null, record.evidenceReferences);
  }

  const model = activeModels[0];
  if (!model || model.isActive !== true) {
    return insufficient("CONFIGURATION_UNAVAILABLE", model?.version ?? null, record.evidenceReferences);
  }
  if (model.modelType !== "RISK") {
    return insufficient("INVALID_CONFIGURATION", model.version, record.evidenceReferences);
  }
  if (!isRecord(model.configuration) || model.configuration.approvalStatus !== "APPROVED") {
    return insufficient("CONFIGURATION_NOT_APPROVED", model.version, record.evidenceReferences);
  }

  const policyConfiguration = model.configuration.riskPolicy;
  if (!isRecord(policyConfiguration)) {
    return insufficient("INVALID_CONFIGURATION", model.version, record.evidenceReferences);
  }

  try {
    return assessRisk({
      policy: {
        ...policyConfiguration,
        modelType: "RISK",
        version: model.version,
      },
      inputs: record.inputs,
      evidenceReferences: record.evidenceReferences,
    });
  } catch (error) {
    if (error instanceof RiskAssessmentInputError) {
      return insufficient(
        error.code === "INVALID_POLICY" ? "INVALID_CONFIGURATION" : "INVALID_INPUTS",
        model.version,
        record.evidenceReferences,
      );
    }
    throw error;
  }
}

export class RiskAssessmentService {
  private readonly repository: RiskAssessmentRepositoryPort;
  private readonly currentUserResolver: () => Promise<SafeUser | null>;

  constructor(dependencies: RiskAssessmentServiceDependencies = {}) {
    this.repository = dependencies.repository ?? new RiskAssessmentRepository();
    this.currentUserResolver = dependencies.currentUserResolver ?? defaultCurrentUserResolver;
  }

  async assessForOpportunity(idInput: unknown): Promise<RiskAssessmentDisplayState | null> {
    const user = await this.requireUser();
    const parsedId = opportunityIdSchema.safeParse(idInput);
    if (!parsedId.success) return null;

    try {
      const records = await this.repository.findVisibleSources(user.userType, [parsedId.data]);
      const record = records.find(({ id }) => id === parsedId.data);
      if (!record) return null;
      assertEligible([record], user.userType);
      const models = await this.repository.findActiveModels();
      return calculateForRecord(record, models);
    } catch {
      return { status: "ERROR" };
    }
  }

  async assessForOpportunities(
    idInputs: readonly unknown[],
  ): Promise<Readonly<Record<string, RiskAssessmentDisplayState>>> {
    const user = await this.requireUser();
    const parsedIds = idInputs.map((id) => opportunityIdSchema.safeParse(id));
    if (parsedIds.some((result) => !result.success)) {
      return Object.fromEntries(idInputs.map((id) => [String(id), { status: "ERROR" as const }]));
    }
    const ids: string[] = [...new Set<string>(parsedIds.map((result) => result.success ? result.data : ""))];
    if (ids.length === 0) return {};

    try {
      const records = await this.repository.findVisibleSources(user.userType, ids);
      if (records.some(({ id }) => !ids.includes(id)) || new Set(records.map(({ id }) => id)).size !== records.length) {
        throw new Error("The Risk repository returned unexpected Opportunities.");
      }
      assertEligible(records, user.userType);
      if (records.length === 0) return {};
      const models = await this.repository.findActiveModels();
      return Object.fromEntries(records.map((record) => [record.id, calculateForRecord(record, models)]));
    } catch {
      return Object.fromEntries(ids.map((id) => [id, { status: "ERROR" as const }]));
    }
  }

  private async requireUser(): Promise<SafeUser & { readonly userType: UserType }> {
    const user = await this.currentUserResolver();
    if (!user) throw new RiskAssessmentUnauthenticatedError();
    if (user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED || !isUserType(user.userType)) {
      throw new RiskAssessmentAccessContextError();
    }
    return user as SafeUser & { readonly userType: UserType };
  }
}
