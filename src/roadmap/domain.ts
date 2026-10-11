import { z } from "zod";

export const ROADMAP_TYPE = "STARTUP" as const;
export const ROADMAP_GENERATION_VERSION = "startup-validation-v1" as const;
export const ROADMAP_GENERATION_METHOD = "MVP_STRUCTURED_VALIDATION" as const;

export const ROADMAP_STAGES = [
  "Market Validation",
  "Competitor Check",
  "Prototype",
  "Test Selling",
  "Evaluation",
  "Go / Revise / Stop",
] as const;

export const roadmapIdSchema = z.string().uuid();
export const roadmapInputSchema = z.object({
  opportunityId: z.string().uuid(),
  analysisId: z.string().uuid().optional(),
}).strict();

export const roadmapQuerySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(50).catch(20),
  type: z.enum(["STARTUP", "GROWTH"]).optional(),
  opportunityId: z.string().uuid().optional(),
  sort: z.enum(["createdAt"]).catch("createdAt"),
  order: z.enum(["ASC", "DESC"]).catch("DESC"),
}).strict();

export const roadmapStepSchema = z.object({
  sequence: z.number().int().min(1).max(6),
  stage: z.enum(ROADMAP_STAGES),
  action: z.string().trim().min(12).max(700),
  objective: z.string().trim().min(12).max(700),
  timeline: z.string().trim().min(1).max(120),
  expectedOutput: z.string().trim().min(12).max(700),
}).strict();

export type RoadmapStepRecord = z.infer<typeof roadmapStepSchema> & { readonly id: string };

export type RoadmapContextMode = "FULL_CONTEXT" | "LIMITED_CONTEXT";

export type RoadmapGenerationContext = {
  readonly version: typeof ROADMAP_GENERATION_VERSION;
  readonly method: typeof ROADMAP_GENERATION_METHOD;
  readonly contextMode: RoadmapContextMode;
  readonly profileVersion: number;
  readonly profileInputs: {
    readonly location: string;
    readonly budgetRange: { readonly min: number; readonly max: number; readonly currency: "IDR" };
    readonly experienceLevel: string;
    readonly timeCommitment: string;
    readonly interests: readonly string[];
    readonly customerSegments: readonly string[];
    readonly salesChannels: readonly string[];
    readonly preferredProductType: string | null;
    readonly businessObjective: string | null;
  };
  readonly opportunity: {
    readonly id: string;
    readonly name: string;
    readonly category: string;
    readonly trendId: string;
    readonly trendTitle: string;
    readonly trendSummary: string;
  };
  readonly evidence: readonly {
    readonly id: string;
    readonly sourceName: string;
    readonly sourceReference: string | null;
  }[];
  readonly availableSignals: {
    readonly opportunityScore: number | null;
    readonly fitScore: number | null;
    readonly riskLevel: "LOW" | "MEDIUM" | "HIGH" | null;
  };
  readonly unavailableInputs: readonly string[];
  readonly assumptions: readonly string[];
  readonly limitations: readonly string[];
};

export type RoadmapListItem = {
  readonly id: string;
  readonly roadmapType: "STARTUP" | "GROWTH";
  readonly createdAt: string;
  readonly opportunity: { readonly id: string; readonly name: string };
};

export type RoadmapDetail = RoadmapListItem & {
  readonly generationContext: RoadmapGenerationContext;
  readonly steps: readonly RoadmapStepRecord[];
};

export type RoadmapPage = {
  readonly items: readonly RoadmapListItem[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly totalPages: number;
};

export type RoadmapProfileContext = {
  readonly profileVersion: number;
  readonly locationText: string;
  readonly countryCode: string;
  readonly budgetMin: number;
  readonly budgetMax: number;
  readonly experienceLevel: string;
  readonly timeCommitment: string;
  readonly preferredProductType: string | null;
  readonly businessObjective: string | null;
  readonly interests: readonly string[];
  readonly customerSegments: readonly string[];
  readonly salesChannels: readonly string[];
};

export type RoadmapOpportunityContext = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly categoryName: string;
  readonly opportunityType: string;
  readonly targetConsumerSummary: string | null;
  readonly competitionLevel: string | null;
  readonly competitionSummary: string | null;
  readonly trend: {
    readonly id: string;
    readonly title: string;
    readonly signalSummary: string;
    readonly signalDescription: string;
    readonly lifecycleState: string;
    readonly affectedUserTypes: readonly string[];
  };
  readonly evidence: readonly {
    readonly id: string;
    readonly sourceName: string;
    readonly sourceReference: string | null;
    readonly sourceUrl: string | null;
  }[];
};

export type RoadmapAnalysisContext = {
  readonly id: string;
  readonly scoreStatus: string;
  readonly opportunityScore: string | null;
  readonly fitScore: string | null;
  readonly riskLevel: string | null;
  readonly riskReasons: readonly unknown[];
};
