import { getOpportunityModel } from "../db/models/opportunity.model";
import { getRoadmapModel } from "../db/models/roadmap.model";
import { getRoadmapStepModel } from "../db/models/roadmap-step.model";
import { getUserModel } from "../db/models/user.model";
import { getUserOpportunityAnalysisModel } from "../db/models/user-opportunity-analysis.model";

export function initializeRoadmapAssociations(): void {
  const RoadmapModel = getRoadmapModel();
  const Step = getRoadmapStepModel();
  const User = getUserModel();
  const Opportunity = getOpportunityModel();
  const Analysis = getUserOpportunityAnalysisModel();
  const Evidence = getOpportunityEvidenceModel();
  const Trend = getTrendModel();
  const Category = getFnbCategoryModel();

  if (!User.associations.roadmaps) User.hasMany(RoadmapModel, { as: "roadmaps", foreignKey: "userId", onDelete: "CASCADE", onUpdate: "CASCADE" });
  if (!RoadmapModel.associations.user) RoadmapModel.belongsTo(User, { as: "user", foreignKey: "userId", onDelete: "CASCADE", onUpdate: "CASCADE" });
  if (!Opportunity.associations.roadmaps) Opportunity.hasMany(RoadmapModel, { as: "roadmaps", foreignKey: "opportunityId", onDelete: "RESTRICT", onUpdate: "CASCADE" });
  if (!RoadmapModel.associations.opportunity) RoadmapModel.belongsTo(Opportunity, { as: "opportunity", foreignKey: "opportunityId", onDelete: "RESTRICT", onUpdate: "CASCADE" });
  if (!Analysis.associations.roadmaps) Analysis.hasMany(RoadmapModel, { as: "roadmaps", foreignKey: "userOpportunityAnalysisId", onDelete: "SET NULL", onUpdate: "CASCADE" });
  if (!RoadmapModel.associations.analysis) RoadmapModel.belongsTo(Analysis, { as: "analysis", foreignKey: "userOpportunityAnalysisId", onDelete: "SET NULL", onUpdate: "CASCADE" });
  if (!RoadmapModel.associations.steps) RoadmapModel.hasMany(Step, { as: "steps", foreignKey: "roadmapId", onDelete: "CASCADE", onUpdate: "CASCADE" });
  if (!Step.associations.roadmap) Step.belongsTo(RoadmapModel, { as: "roadmap", foreignKey: "roadmapId", onDelete: "CASCADE", onUpdate: "CASCADE" });
  if (!Opportunity.associations.relatedTrend) Opportunity.belongsTo(Trend, { as: "relatedTrend", foreignKey: "relatedTrendId" });
  if (!Opportunity.associations.category) Opportunity.belongsTo(Category, { as: "category", foreignKey: "fnbCategoryId" });
  if (!Opportunity.associations.evidences) Opportunity.hasMany(Evidence, { as: "evidences", foreignKey: "opportunityId" });
}

import { getOpportunityEvidenceModel } from "../db/models/evidence.model";
import { getTrendModel } from "../db/models/trend.model";
import { getFnbCategoryModel } from "../reference/fnb-category.model";
