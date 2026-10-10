export const DATASET_SOURCE_MODES = ["LIVE", "CACHED", "PREPARED"] as const;
export type DatasetSourceMode = (typeof DATASET_SOURCE_MODES)[number];

export const SCORING_MODEL_TYPES = [
  "OPPORTUNITY_SCORE",
  "ENTREPRENEUR_FIT",
  "BUSINESS_FIT",
  "RISK",
] as const;
export type ScoringModelType = (typeof SCORING_MODEL_TYPES)[number];

export const ANALYSIS_SCORE_STATUSES = [
  "PENDING",
  "AVAILABLE",
  "INSUFFICIENT_DATA",
  "ERROR",
] as const;
export type AnalysisScoreStatus = (typeof ANALYSIS_SCORE_STATUSES)[number];

export const ANALYSIS_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type AnalysisRiskLevel = (typeof ANALYSIS_RISK_LEVELS)[number];

export const ANALYSIS_CONFIDENCE_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type AnalysisConfidenceLevel = (typeof ANALYSIS_CONFIDENCE_LEVELS)[number];
