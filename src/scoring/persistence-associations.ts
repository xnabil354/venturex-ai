import { getDatasetVersionModel } from "../db/models/dataset-version.model";
import { getOpportunityModel } from "../db/models/opportunity.model";
import { getScoringModel } from "../db/models/scoring-model.model";
import { getUserModel } from "../db/models/user.model";
import { getUserOpportunityAnalysisModel } from "../db/models/user-opportunity-analysis.model";

export function initializeScoringPersistenceAssociations(): void {
  const user = getUserModel();
  const opportunity = getOpportunityModel();
  const datasetVersion = getDatasetVersionModel();
  const scoringModel = getScoringModel();
  const analysis = getUserOpportunityAnalysisModel();

  if (!user.associations.opportunityAnalyses) {
    user.hasMany(analysis, {
      as: "opportunityAnalyses",
      foreignKey: "userId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  }
  if (!analysis.associations.user) {
    analysis.belongsTo(user, {
      as: "user",
      foreignKey: "userId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  }

  if (!opportunity.associations.analyses) {
    opportunity.hasMany(analysis, {
      as: "analyses",
      foreignKey: "opportunityId",
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    });
  }
  if (!analysis.associations.opportunity) {
    analysis.belongsTo(opportunity, {
      as: "opportunity",
      foreignKey: "opportunityId",
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    });
  }

  if (!datasetVersion.associations.analyses) {
    datasetVersion.hasMany(analysis, {
      as: "analyses",
      foreignKey: "datasetVersionId",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
  }
  if (!analysis.associations.datasetVersion) {
    analysis.belongsTo(datasetVersion, {
      as: "datasetVersion",
      foreignKey: "datasetVersionId",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
  }

  if (!scoringModel.associations.analyses) {
    scoringModel.hasMany(analysis, {
      as: "analyses",
      foreignKey: "scoringModelId",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
  }
  if (!analysis.associations.scoringModel) {
    analysis.belongsTo(scoringModel, {
      as: "scoringModel",
      foreignKey: "scoringModelId",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
  }
}
