import type { FitScoreComponent, FitScoreModelType } from "./fit-score";
import type { FitScoreMvpResult } from "./fit-score-mvp";

export type FitScoreApiBreakdownItem = {
  readonly component: FitScoreComponent;
  readonly value: number;
  readonly weightedContribution: number;
  readonly interpretation: string;
};

type FitScoreApiResultBase = {
  readonly modelType: FitScoreModelType;
  readonly policyVersion: FitScoreMvpResult["policyVersion"];
  readonly confidence: null;
  readonly label: FitScoreMvpResult["label"];
  readonly disclaimer: FitScoreMvpResult["disclaimer"];
};

export type FitScoreApiDto =
  | (FitScoreApiResultBase & {
      readonly status: "AVAILABLE";
      readonly value: number;
      readonly breakdown: readonly FitScoreApiBreakdownItem[];
    })
  | (FitScoreApiResultBase & {
      readonly status: "INSUFFICIENT_DATA";
      readonly value: null;
      readonly missingComponents: FitScoreComponent[];
      readonly reason: "ACTIVE_COMPONENTS_UNAVAILABLE";
    });

export function toFitScoreApiDto(result: FitScoreMvpResult): FitScoreApiDto {
  const common = {
    modelType: result.modelType,
    policyVersion: result.policyVersion,
    confidence: null,
    label: result.label,
    disclaimer: result.disclaimer,
  } as const;

  if (result.status === "INSUFFICIENT_DATA") {
    return {
      ...common,
      status: result.status,
      value: null,
      missingComponents: [...result.missingComponents],
      reason: result.reason,
    };
  }

  const breakdown = result.activeComponents.map((item): FitScoreApiBreakdownItem => {
    if (item.normalizedValue === null || item.weightedContribution === null) {
      throw new Error("Available Fit Score contains an incomplete breakdown item.");
    }
    return {
      component: item.component,
      value: item.normalizedValue,
      weightedContribution: item.weightedContribution,
      interpretation: item.interpretation,
    };
  });

  return {
    ...common,
    status: result.status,
    value: result.score,
    breakdown,
  };
}
