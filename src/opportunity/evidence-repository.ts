import { Op } from "sequelize";

import type { UserType } from "../auth/user-types";
import { getOpportunityEvidenceModel, type OpportunityEvidence } from "../db/models/evidence.model";
import { getOpportunityModel, type Opportunity } from "../db/models/opportunity.model";
import { getTrendModel, type Trend } from "../db/models/trend.model";
import { getFnbCategoryModel, type FnbCategory } from "../reference/fnb-category.model";
import type { OpportunityId } from "./domain";
import type { OpportunityEvidenceRecord } from "./evidence-domain";

export interface OpportunityEvidenceRepositoryPort {
  findForVisibleOpportunity(
    userType: UserType,
    opportunityId: OpportunityId,
  ): Promise<readonly OpportunityEvidenceRecord[] | null>;
}

function toEvidenceRecord(evidence: OpportunityEvidence): OpportunityEvidenceRecord {
  return {
    id: evidence.id,
    sourceName: evidence.sourceName,
    sourceType: evidence.sourceType,
    sourceReference: evidence.sourceReference,
    sourceUrl: evidence.sourceUrl,
    sourceDate: evidence.sourceDate,
    retrievedAt: evidence.retrievedAt,
    metadata: evidence.metadata,
  };
}

export class OpportunityEvidenceRepository implements OpportunityEvidenceRepositoryPort {
  private readonly evidenceModel: typeof OpportunityEvidence;
  private readonly opportunityModel: typeof Opportunity;
  private readonly trendModel: typeof Trend;
  private readonly categoryModel: typeof FnbCategory;

  constructor(
    evidenceModel: typeof OpportunityEvidence = getOpportunityEvidenceModel(),
    opportunityModel: typeof Opportunity = getOpportunityModel(),
    trendModel: typeof Trend = getTrendModel(),
    categoryModel: typeof FnbCategory = getFnbCategoryModel(),
  ) {
    this.evidenceModel = evidenceModel;
    this.opportunityModel = opportunityModel;
    this.trendModel = trendModel;
    this.categoryModel = categoryModel;

    if (!this.opportunityModel.associations.relatedTrend) {
      this.opportunityModel.belongsTo(this.trendModel, {
        as: "relatedTrend",
        foreignKey: "relatedTrendId",
      });
    }
    if (!this.opportunityModel.associations.category) {
      this.opportunityModel.belongsTo(this.categoryModel, {
        as: "category",
        foreignKey: "fnbCategoryId",
      });
    }
    if (!this.opportunityModel.associations.evidences) {
      this.opportunityModel.hasMany(this.evidenceModel, {
        as: "evidences",
        foreignKey: "opportunityId",
      });
    }
    if (!this.evidenceModel.associations.opportunity) {
      this.evidenceModel.belongsTo(this.opportunityModel, {
        as: "opportunity",
        foreignKey: "opportunityId",
      });
    }
  }

  async findForVisibleOpportunity(
    userType: UserType,
    opportunityId: OpportunityId,
  ): Promise<readonly OpportunityEvidenceRecord[] | null> {
    const opportunity = await this.opportunityModel.findOne({
      where: { id: opportunityId },
      attributes: ["id"],
      include: [
        {
          model: this.trendModel,
          as: "relatedTrend",
          attributes: [],
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
    if (!opportunity) return null;
    return (opportunity.evidences ?? []).map(toEvidenceRecord);
  }
}
