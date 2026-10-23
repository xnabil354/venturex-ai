import { readFile } from "node:fs/promises";
import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { reviewBusinessConcept } from "./business-concept-alignment";
import { generateNineRouterJson, readLocalProfileNineRouterConfig } from "../ai-analysis/ninerouter";
import { businessRequirementsSchema } from "./business-analysis-contract";

it.skipIf(process.env.RUN_BUSINESS_CONCEPT_LIVE_TEST !== "true")("live reviewer rejects the retained ayam-to-tempe incident", async () => {
  if (process.env.AI_ANALYSIS_TRENDS_USER_INFERENCE_ENABLED !== "true" || process.env.NINEROUTER_SEARCHAPI_PROCESSING_CONFIRMED !== "true") throw new Error("Live processing must be explicitly configured");
  const config = readLocalProfileNineRouterConfig();
  if (!config) throw new Error("Live provider unavailable");
  const root = "artifacts/live-existing-20261022/";
  const item = JSON.parse(await readFile(root + "hypothesis-2.response.txt", "utf8")).data[0];
  const analysis = JSON.parse(await readFile(root + "analysis-2.response.txt", "utf8")).data;
  const review = await reviewBusinessConcept({
    hypothesis: { title: item.hypothesis.title, concept: item.hypothesis.concept, targetCustomer: item.hypothesis.targetCustomer },
    requirements: businessRequirementsSchema.parse(analysis.requirements), referenceCatalog: { segments: [], channels: [] },
    config, generate: generateNineRouterJson, signal: AbortSignal.timeout(160_000),
  });
  console.info(JSON.stringify({ verdict: review.verdict, reason: review.reason }));
  expect(review.verdict).toBe("CONCEPT_DRIFT");
}, 165_000);
