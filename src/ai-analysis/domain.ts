import { z } from "zod";

const field = (maximum: number) => z.string().trim().min(1).max(maximum);

export const opportunityAnalysisSchema = z.object({
  summary: field(1200),
  whyRelevant: field(1800),
  targetConsumer: field(1500),
  competition: field(1500),
  potential: field(1800),
  risks: z.array(field(700)).min(1).max(6),
  nextAction: field(1200),
}).strict();

export type OpportunityAnalysis = z.infer<typeof opportunityAnalysisSchema>;

export const opportunityAnalysisDtoSchema = opportunityAnalysisSchema.extend({
  analysisId: z.string().uuid(),
  generatedAt: z.string().datetime(),
  provider: z.string().min(1).max(80),
  model: z.string().min(1).max(120),
  limitedEvidence: z.boolean(),
}).strict();

export type OpportunityAnalysisDto = z.infer<typeof opportunityAnalysisDtoSchema>;

export const storedOpportunityAnalysisSchema = z.object({
  schemaVersion: z.literal(1),
  contextFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
  profileVersion: z.number().int().positive(),
  userType: z.enum(["ENTREPRENEUR", "UMKM_EXISTING"]),
  limitedEvidence: z.boolean(),
  generationContext: z.record(z.string(), z.unknown()),
  analysis: opportunityAnalysisSchema,
}).strict();

export type StoredOpportunityAnalysis = z.infer<typeof storedOpportunityAnalysisSchema>;

export class AIAnalysisUnauthenticatedError extends Error {
  override readonly name = "AIAnalysisUnauthenticatedError";
  constructor() { super("Authentication required."); }
}

export class AIAnalysisProfileIncompleteError extends Error {
  override readonly name = "AIAnalysisProfileIncompleteError";
  constructor() { super("A completed role-specific profile is required."); }
}

export class AIAnalysisAccessContextError extends Error {
  override readonly name = "AIAnalysisAccessContextError";
  constructor() { super("A completed user type is required."); }
}

export class AIAnalysisResourceNotFoundError extends Error {
  override readonly name = "AIAnalysisResourceNotFoundError";
  constructor() { super("The eligible Opportunity could not be found."); }
}

export class AIAnalysisInsufficientDataError extends Error {
  override readonly name = "AIAnalysisInsufficientDataError";
  constructor() { super("There is not enough trusted context to generate an analysis."); }
}

export class AIAnalysisProviderUnavailableError extends Error {
  override readonly name = "AIAnalysisProviderUnavailableError";
  constructor() { super("AI analysis provider configuration is unavailable."); }
}

export class AIAnalysisProviderFailureError extends Error {
  override readonly name = "AIAnalysisProviderFailureError";
  constructor() { super("AI analysis provider request failed."); }
}

export class AIAnalysisResponseInvalidError extends Error {
  override readonly name = "AIAnalysisResponseInvalidError";
  constructor() { super("AI analysis response did not satisfy the output contract."); }
}

export class AIAnalysisRateLimitedError extends Error {
  override readonly name = "AIAnalysisRateLimitedError";
  constructor(readonly retryAfterSeconds: number) { super("AI analysis requests are temporarily limited."); }
}

export class AIAnalysisContextChangedError extends Error {
  override readonly name = "AIAnalysisContextChangedError";
  constructor() { super("Trusted context changed during generation."); }
}
