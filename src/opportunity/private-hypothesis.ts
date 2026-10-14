import { z } from "zod";

export const privateOpportunityHypothesisSchema = z.object({
  title: z.string().trim().min(4).max(140),
  concept: z.string().trim().min(20).max(1200),
  targetCustomer: z.string().trim().min(8).max(500),
  validationSteps: z.array(z.string().trim().min(8).max(500)).min(2).max(5),
  assumptions: z.array(z.string().trim().min(8).max(500)).min(1).max(4),
}).strict();

export type PrivateOpportunityHypothesis = z.infer<typeof privateOpportunityHypothesisSchema>;

export const privateOpportunitySourceSchema = z.object({
  snapshotId: z.string().uuid(),
  signalId: z.string().uuid(),
  title: z.string().trim().min(1).max(180),
  publisher: z.literal("Google Trends"),
  transport: z.literal("Bright Data SERP API"),
  url: z.literal("https://trends.google.com/trending?geo=ID&hl=id&brd_json=1"),
  retrievedAt: z.string().datetime(),
  classification: z.enum(["LIKELY_FNB", "REVIEW_REQUIRED"]),
}).strict();

export type PrivateOpportunitySource = z.infer<typeof privateOpportunitySourceSchema>;

export const privateOpportunityIdeaResponseSchema = z.object({
  id: z.string().uuid(),
  hypothesis: privateOpportunityHypothesisSchema,
  source: privateOpportunitySourceSchema,
  provider: z.literal("ninerouter"),
  model: z.literal("cx/gpt-6-luna-xhigh"),
  generatedAt: z.string().datetime(),
  saved: z.boolean(),
}).strict();

export type PrivateOpportunityIdeaDto = z.infer<typeof privateOpportunityIdeaResponseSchema>;
