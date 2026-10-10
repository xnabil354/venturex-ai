import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
} from "sequelize";

import type { Opportunity } from "./opportunity.model";
import { getSequelize } from "../sequelize";

declare global {
  var __venturexOpportunityFitRequirementModel: typeof OpportunityFitRequirement | undefined;
}

function compareRange(minimum: string | null, maximum: string | null, label: string): void {
  if (minimum !== null && maximum !== null && BigInt(maximum) < BigInt(minimum)) {
    throw new Error(`${label} maximum must be greater than or equal to its minimum.`);
  }
}

function isPercentage(value: string | null): boolean {
  if (value === null) return true;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 && numericValue <= 100;
}

export class OpportunityFitRequirement extends Model<
  InferAttributes<OpportunityFitRequirement>,
  InferCreationAttributes<OpportunityFitRequirement>
> {
  declare opportunityId: string;
  declare capitalMin: string | null;
  declare capitalMax: string | null;
  declare expectedPriceMin: string | null;
  declare expectedPriceMax: string | null;
  declare requiredExperienceLevel: string | null;
  declare requiredTimeCommitment: string | null;
  declare operationalComplexity: string | null;
  declare locationScope: string | null;
  declare metadata: Record<string, unknown>;
  declare updatedAt: Date;
  declare opportunity: NonAttribute<Opportunity> | undefined;
}

export function getOpportunityFitRequirementModel(): typeof OpportunityFitRequirement {
  if (globalThis.__venturexOpportunityFitRequirementModel) {
    return globalThis.__venturexOpportunityFitRequirementModel;
  }

  OpportunityFitRequirement.init(
    {
      opportunityId: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        field: "opportunity_id",
      },
      capitalMin: { type: DataTypes.BIGINT, allowNull: true, field: "capital_min" },
      capitalMax: { type: DataTypes.BIGINT, allowNull: true, field: "capital_max" },
      expectedPriceMin: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: "expected_price_min",
      },
      expectedPriceMax: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: "expected_price_max",
      },
      requiredExperienceLevel: {
        type: DataTypes.STRING(32),
        allowNull: true,
        field: "required_experience_level",
      },
      requiredTimeCommitment: {
        type: DataTypes.STRING(32),
        allowNull: true,
        field: "required_time_commitment",
      },
      operationalComplexity: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        field: "operational_complexity",
        validate: {
          isValidOperationalComplexity(value: string | null) {
            if (!isPercentage(value)) {
              throw new Error("Operational complexity must be between 0 and 100.");
            }
          },
        },
      },
      locationScope: { type: DataTypes.STRING(40), allowNull: true, field: "location_scope" },
      metadata: { type: DataTypes.JSONB, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: "updated_at" },
    },
    {
      sequelize: getSequelize(),
      tableName: "opportunity_fit_requirements",
      timestamps: false,
      underscored: true,
      validate: {
        validCapitalRange(this: OpportunityFitRequirement) {
          compareRange(this.capitalMin, this.capitalMax, "Capital");
        },
        validExpectedPriceRange(this: OpportunityFitRequirement) {
          compareRange(this.expectedPriceMin, this.expectedPriceMax, "Expected price");
        },
      },
    },
  );

  globalThis.__venturexOpportunityFitRequirementModel = OpportunityFitRequirement;
  return OpportunityFitRequirement;
}
