import { z } from "zod";

import { opportunityAnalysisSchema } from "../domain";

export const syntheticDemoFixtureIdSchema = z.enum(["DEMO_ENTREPRENEUR", "DEMO_UMKM"]);
export type SyntheticDemoFixtureId = z.infer<typeof syntheticDemoFixtureIdSchema>;

export const syntheticDemoRequestSchema = z.object({
  fixtureId: syntheticDemoFixtureIdSchema,
}).strict();

export const syntheticDemoExecutionSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("MOCK"),
    provider: z.literal("local-mock"),
    model: z.literal("synthetic-fixture-v1"),
    displayLabel: z.literal("Contoh hasil simulasi — bukan respons 9Router live"),
  }).strict(),
  z.object({
    mode: z.literal("LIVE_SYNTHETIC"),
    provider: z.literal("ninerouter"),
    model: z.literal("cx/gpt-6-luna-xhigh"),
    displayLabel: z.literal("Analisis 9Router — menggunakan profil demo sintetis"),
  }).strict(),
]);
export type SyntheticDemoExecution = z.infer<typeof syntheticDemoExecutionSchema>;

export const syntheticDemoProviderOutputSchema = z.object({
  analysis: opportunityAnalysisSchema,
  evidenceReferences: z.array(z.string().trim().min(1).max(160)).max(20),
}).strict();
export type SyntheticDemoProviderOutput = z.infer<typeof syntheticDemoProviderOutputSchema>;

const unavailableSchema = z.object({
  status: z.literal("UNAVAILABLE"),
  reason: z.string().min(1).max(300),
}).strict();

export const syntheticDemoResultSchema = z.object({
  fixtureId: syntheticDemoFixtureIdSchema,
  fixtureVersion: z.literal("synthetic-fixture-v1"),
  fixtureContentHash: z.string().regex(/^[a-f0-9]{64}$/u),
  personaLabel: z.string().min(1).max(120),
  profile: z.object({ summary: z.string().min(1).max(500) }).strict(),
  opportunity: z.object({
    name: z.string().min(1).max(160),
    description: z.string().min(1).max(700),
    hypothesisLabel: z.literal("Hipotesis simulasi"),
  }).strict(),
  evidence: z.object({
    status: z.literal("UNAVAILABLE"),
    records: z.array(z.never()).length(0),
    reason: z.string().min(1).max(300),
  }).strict(),
  decisionSupport: z.object({
    opportunityScore: unavailableSchema,
    fitScore: unavailableSchema,
    riskAssessment: unavailableSchema,
  }).strict(),
  limitations: z.array(z.string().min(1).max(300)).min(1).max(8),
  analysis: opportunityAnalysisSchema,
  evidenceReferences: z.array(z.string().min(1).max(160)).max(20),
  execution: syntheticDemoExecutionSchema,
}).strict();
export type SyntheticDemoResult = z.infer<typeof syntheticDemoResultSchema>;
