import "server-only";

import { Op } from "sequelize";

import type { UserType } from "../auth/user-types";
import { getOpportunityEvidenceModel, type OpportunityEvidence } from "../db/models/evidence.model";
import { getOpportunityFitRequirementModel, type OpportunityFitRequirement } from "../db/models/opportunity-fit-requirement.model";
import { getOpportunityModel, type Opportunity } from "../db/models/opportunity.model";
import { getScoringModel, type ScoringModel } from "../db/models/scoring-model.model";
import { getTrendModel, type Trend } from "../db/models/trend.model";
import { getFnbCategoryModel, type FnbCategory } from "../reference/fnb-category.model";
import { projectOpportunityEvidence } from "./evidence-dto";
import type { OpportunityEvidenceRecord } from "./evidence-domain";
import {
  RISK_INPUT_SOURCES,
  type RiskAssessmentInputs,
  type RiskEvidenceReference,
  type RiskInputSource,
} from "../scoring/risk-assessment";

export type ActiveRiskModelRecord = {
  readonly id: string;
  readonly modelType: string;
  readonly version: string;
  readonly weights: unknown;
  readonly configuration: unknown;
  readonly isActive: boolean;
};

export type RiskAssessmentSourceRecord = {
  readonly id: string;
  readonly inputs: RiskAssessmentInputs;
  readonly evidenceReferences: readonly RiskEvidenceReference[];
  readonly relatedTrend: {
    readonly lifecycleState: string;
    readonly affectedUserTypes: readonly string[];
  };
};

export interface RiskAssessmentRepositoryPort {
  findActiveModels(): Promise<readonly ActiveRiskModelRecord[]>;
  findVisibleSources(
    userType: UserType,
    opportunityIds: readonly string[],
  ): Promise<readonly RiskAssessmentSourceRecord[]>;
}

type InputSourceDescriptor = {
  readonly label: string;
  readonly reference: string;
};

const INPUT_SOURCE_DESCRIPTORS: Readonly<Record<RiskInputSource, InputSourceDescriptor>> = {
  competitionLevel: {
    label: "Tingkat kompetisi yang tersimpan pada Opportunity",
    reference: "opportunities.competition_level",
  },
  capitalMin: {
    label: "Batas minimum modal pada kebutuhan Opportunity",
    reference: "opportunity_fit_requirements.capital_min",
  },
  capitalMax: {
    label: "Batas maksimum modal pada kebutuhan Opportunity",
    reference: "opportunity_fit_requirements.capital_max",
  },
  operationalComplexity: {
    label: "Kompleksitas operasional pada kebutuhan Opportunity",
    reference: "opportunity_fit_requirements.operational_complexity",
  },
  executionFeasibility: {
    label: "Execution Feasibility numerik pada Opportunity",
    reference: "opportunities.execution_feasibility",
  },
  marketSustainability: {
    label: "Market Sustainability numerik pada Opportunity",
    reference: "opportunities.market_sustainability",
  },
};

function inputValues(values: Readonly<Record<RiskInputSource, string | null>>): RiskAssessmentInputs {
  return Object.fromEntries(RISK_INPUT_SOURCES.map((source) => [source, {
    value: values[source],
    source: INPUT_SOURCE_DESCRIPTORS[source].label,
    reference: INPUT_SOURCE_DESCRIPTORS[source].reference,
  }])) as RiskAssessmentInputs;
}

function evidenceReferences(evidences: readonly OpportunityEvidence[]): readonly RiskEvidenceReference[] {
  const records: OpportunityEvidenceRecord[] = evidences.map((evidence) => ({
    id: evidence.id,
    sourceName: evidence.sourceName,
    sourceType: evidence.sourceType,
    sourceReference: evidence.sourceReference,
    sourceUrl: evidence.sourceUrl,
    sourceDate: evidence.sourceDate,
    retrievedAt: evidence.retrievedAt,
    metadata: evidence.metadata,
  }));
  const projected = projectOpportunityEvidence(records);
  return projected.status === "AVAILABLE"
    ? projected.items.map(({ sourceName, sourceReference, sourceUrl }) => ({
        sourceName,
        sourceReference,
        sourceUrl,
      }))
    : [];
}

export class RiskAssessmentRepository implements RiskAssessmentRepositoryPort {
  private readonly opportunityModel: typeof Opportunity;
  private readonly trendModel: typeof Trend;
  private readonly categoryModel: typeof FnbCategory;
  private readonly requirementModel: typeof OpportunityFitRequirement;
  private readonly evidenceModel: typeof OpportunityEvidence;
  private readonly scoringModel: typeof ScoringModel;

  constructor(
    opportunityModel: typeof Opportunity = getOpportunityModel(),
    trendModel: typeof Trend = getTrendModel(),
    categoryModel: typeof FnbCategory = getFnbCategoryModel(),
    requirementModel: typeof OpportunityFitRequirement = getOpportunityFitRequirementModel(),
    evidenceModel: typeof OpportunityEvidence = getOpportunityEvidenceModel(),
    scoringModel: typeof ScoringModel = getScoringModel(),
  ) {
    this.opportunityModel = opportunityModel;
    this.trendModel = trendModel;
    this.categoryModel = categoryModel;
    this.requirementModel = requirementModel;
    this.evidenceModel = evidenceModel;
    this.scoringModel = scoringModel;

    if (!this.opportunityModel.associations.relatedTrend) {
      this.opportunityModel.belongsTo(this.trendModel, { as: "relatedTrend", foreignKey: "relatedTrendId" });
    }
    if (!this.opportunityModel.associations.category) {
      this.opportunityModel.belongsTo(this.categoryModel, { as: "category", foreignKey: "fnbCategoryId" });
    }
    if (!this.opportunityModel.associations.evidences) {
      this.opportunityModel.hasMany(this.evidenceModel, { as: "evidences", foreignKey: "opportunityId" });
    }
    if (!this.opportunityModel.associations.fitRequirements) {
      this.opportunityModel.hasOne(this.requirementModel, { as: "fitRequirements", foreignKey: "opportunityId" });
    }
  }

  async findActiveModels(): Promise<readonly ActiveRiskModelRecord[]> {
    const models = await this.scoringModel.findAll({
      where: { modelType: "RISK", isActive: true },
      attributes: ["id", "modelType", "version", "weights", "configuration", "isActive"],
      order: [["createdAt", "DESC"], ["id", "ASC"]],
    });

    return models.map((model) => ({
      id: model.id,
      modelType: model.modelType,
      version: model.version,
      weights: model.weights,
      configuration: model.configuration,
      isActive: model.isActive,
    }));
  }

  async findVisibleSources(
    userType: UserType,
    opportunityIds: readonly string[],
  ): Promise<readonly RiskAssessmentSourceRecord[]> {
    if (opportunityIds.length === 0) return [];

    const opportunities = await this.opportunityModel.findAll({
      where: { id: { [Op.in]: [...opportunityIds] } },
      attributes: ["id", "competitionLevel", "executionFeasibility", "marketSustainability"],
      include: [
        {
          model: this.trendModel,
          as: "relatedTrend",
          attributes: ["id", "lifecycleState", "affectedUserTypes"],
          required: true,
          where: {
            lifecycleState: "PUBLISHED",
            affectedUserTypes: { [Op.contains]: [userType] },
          },
        },
        {
          model: this.categoryModel,
          as: "category",
          attributes: [],
          required: true,
        },
        {
          model: this.requirementModel,
          as: "fitRequirements",
          attributes: ["capitalMin", "capitalMax", "operationalComplexity"],
          required: false,
        },
        {
          model: this.evidenceModel,
          as: "evidences",
          attributes: [
            "id",
            "sourceName",
            "sourceType",
            "sourceReference",
            "sourceUrl",
            "sourceDate",
            "retrievedAt",
            "metadata",
          ],
          required: false,
        },
      ],
      order: [[{ model: this.evidenceModel, as: "evidences" }, "id", "ASC"]],
    });

    return opportunities.map((opportunity) => {
      const trend = opportunity.relatedTrend;
      if (!trend) throw new Error("Risk eligibility could not be verified.");
      const requirement = opportunity.fitRequirements;
      return {
        id: opportunity.id,
        inputs: inputValues({
          competitionLevel: opportunity.competitionLevel,
          capitalMin: requirement?.capitalMin ?? null,
          capitalMax: requirement?.capitalMax ?? null,
          operationalComplexity: requirement?.operationalComplexity ?? null,
          executionFeasibility: opportunity.executionFeasibility,
          marketSustainability: opportunity.marketSustainability,
        }),
        evidenceReferences: evidenceReferences(opportunity.evidences ?? []),
        relatedTrend: {
          lifecycleState: trend.lifecycleState,
          affectedUserTypes: [...trend.affectedUserTypes],
        },
      };
    });
  }
}
