import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sequelize: undefined as unknown }));

vi.mock("../db/sequelize", () => ({
  getSequelize: () => mocks.sequelize as import("sequelize").Sequelize,
}));

import { Sequelize } from "sequelize";

import { getOpportunityCustomerSegmentModel } from "../db/models/opportunity-customer-segment.model";
import { getOpportunityFitRequirementModel } from "../db/models/opportunity-fit-requirement.model";
import { getOpportunitySalesChannelModel } from "../db/models/opportunity-sales-channel.model";
import { getOpportunityModel } from "../db/models/opportunity.model";
import { getCustomerSegmentModel } from "../reference/customer-segment.model";
import { getSalesChannelModel } from "../reference/sales-channel.model";
import { initializeOpportunityFitAssociations } from "./fit-associations";

let sequelize: Sequelize;

beforeAll(() => {
  sequelize = new Sequelize({ dialect: "postgres", logging: false });
  mocks.sequelize = sequelize;
});

afterAll(async () => {
  await sequelize.close();
});

describe("Opportunity fit input models", () => {
  it("validates nullable ranges and operational complexity without adding score fields", async () => {
    const Requirements = getOpportunityFitRequirementModel();
    const valid = Requirements.build({
      opportunityId: "60000000-0000-4000-8000-000000000001",
      capitalMin: "1000000",
      capitalMax: "2000000",
      expectedPriceMin: null,
      expectedPriceMax: null,
      requiredExperienceLevel: null,
      requiredTimeCommitment: null,
      operationalComplexity: null,
      locationScope: null,
      metadata: {},
      updatedAt: new Date("2026-10-09T00:00:00.000Z"),
    });
    await expect(valid.validate()).resolves.toBeDefined();

    await expect(Requirements.build({
      opportunityId: "60000000-0000-4000-8000-000000000001",
      capitalMin: "2000000",
      capitalMax: "1000000",
      expectedPriceMin: null,
      expectedPriceMax: null,
      requiredExperienceLevel: null,
      requiredTimeCommitment: null,
      operationalComplexity: null,
      locationScope: null,
      metadata: {},
      updatedAt: new Date("2026-10-09T00:00:00.000Z"),
    }).validate()).rejects.toThrow("Capital maximum");

    await expect(Requirements.build({
      opportunityId: "60000000-0000-4000-8000-000000000001",
      capitalMin: null,
      capitalMax: null,
      expectedPriceMin: "40000",
      expectedPriceMax: "20000",
      requiredExperienceLevel: null,
      requiredTimeCommitment: null,
      operationalComplexity: null,
      locationScope: null,
      metadata: {},
      updatedAt: new Date("2026-10-09T00:00:00.000Z"),
    }).validate()).rejects.toThrow();

    await expect(Requirements.build({
      opportunityId: "60000000-0000-4000-8000-000000000001",
      capitalMin: null,
      capitalMax: null,
      expectedPriceMin: null,
      expectedPriceMax: null,
      requiredExperienceLevel: null,
      requiredTimeCommitment: null,
      operationalComplexity: "100.01",
      locationScope: null,
      metadata: {},
      updatedAt: new Date("2026-10-09T00:00:00.000Z"),
    }).validate()).rejects.toThrow("Operational complexity");

    expect(Requirements.rawAttributes.opportunityScore).toBeUndefined();
    expect(Requirements.rawAttributes.fitScore).toBeUndefined();
  });

  it("models the requirement PK and junction composite keys with Opportunity/reference associations", () => {
    initializeOpportunityFitAssociations();
    initializeOpportunityFitAssociations();

    const Opportunity = getOpportunityModel();
    const Requirements = getOpportunityFitRequirementModel();
    const CustomerSegments = getOpportunityCustomerSegmentModel();
    const SalesChannels = getOpportunitySalesChannelModel();
    const CustomerSegment = getCustomerSegmentModel();
    const SalesChannel = getSalesChannelModel();

    expect(Requirements.primaryKeyAttributes).toEqual(["opportunityId"]);
    expect(CustomerSegments.primaryKeyAttributes).toEqual(["opportunityId", "customerSegmentId"]);
    expect(SalesChannels.primaryKeyAttributes).toEqual(["opportunityId", "salesChannelId"]);
    expect(Opportunity.associations.fitRequirements).toMatchObject({ foreignKey: "opportunityId" });
    expect(Opportunity.associations.fitCustomerSegments).toBeDefined();
    expect(Opportunity.associations.fitSalesChannels).toBeDefined();
    expect(CustomerSegment.associations.fitOpportunities).toBeDefined();
    expect(SalesChannel.associations.fitOpportunities).toBeDefined();
  });
});
