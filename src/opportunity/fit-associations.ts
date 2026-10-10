import { getCustomerSegmentModel } from "../reference/customer-segment.model";
import { getSalesChannelModel } from "../reference/sales-channel.model";
import { getOpportunityCustomerSegmentModel } from "../db/models/opportunity-customer-segment.model";
import { getOpportunityFitRequirementModel } from "../db/models/opportunity-fit-requirement.model";
import { getOpportunitySalesChannelModel } from "../db/models/opportunity-sales-channel.model";
import { getOpportunityModel } from "../db/models/opportunity.model";

export function initializeOpportunityFitAssociations(): void {
  const Opportunity = getOpportunityModel();
  const FitRequirement = getOpportunityFitRequirementModel();
  const OpportunityCustomerSegment = getOpportunityCustomerSegmentModel();
  const OpportunitySalesChannel = getOpportunitySalesChannelModel();
  const CustomerSegment = getCustomerSegmentModel();
  const SalesChannel = getSalesChannelModel();

  if (!Opportunity.associations.fitRequirements) {
    Opportunity.hasOne(FitRequirement, {
      as: "fitRequirements",
      foreignKey: "opportunityId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  }
  if (!FitRequirement.associations.opportunity) {
    FitRequirement.belongsTo(Opportunity, {
      as: "opportunity",
      foreignKey: "opportunityId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  }

  if (!Opportunity.associations.fitCustomerSegments) {
    Opportunity.belongsToMany(CustomerSegment, {
      as: "fitCustomerSegments",
      through: OpportunityCustomerSegment,
      foreignKey: "opportunityId",
      otherKey: "customerSegmentId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  }
  if (!CustomerSegment.associations.fitOpportunities) {
    CustomerSegment.belongsToMany(Opportunity, {
      as: "fitOpportunities",
      through: OpportunityCustomerSegment,
      foreignKey: "customerSegmentId",
      otherKey: "opportunityId",
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    });
  }

  if (!Opportunity.associations.fitSalesChannels) {
    Opportunity.belongsToMany(SalesChannel, {
      as: "fitSalesChannels",
      through: OpportunitySalesChannel,
      foreignKey: "opportunityId",
      otherKey: "salesChannelId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  }
  if (!SalesChannel.associations.fitOpportunities) {
    SalesChannel.belongsToMany(Opportunity, {
      as: "fitOpportunities",
      through: OpportunitySalesChannel,
      foreignKey: "salesChannelId",
      otherKey: "opportunityId",
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    });
  }
}
