import { z } from "zod";
import { ROADMAP_STAGES, roadmapStepSchema } from "./domain";

export const privateStartupRoadmapSchema = z.object({
  version: z.literal("private-startup-v1"),
  generatorVersion: z.enum(["personalized-v2", "personalized-v3", "personalized-v4"]).optional(),
  createdAt: z.string().datetime(),
  sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
  steps: z.array(roadmapStepSchema).length(6).refine(steps => steps.every((step, index) => step.sequence === index + 1 && step.stage === ROADMAP_STAGES[index]), "Startup stages must be ordered and unique."),
}).strict();
export type PrivateStartupRoadmap = z.infer<typeof privateStartupRoadmapSchema>;
