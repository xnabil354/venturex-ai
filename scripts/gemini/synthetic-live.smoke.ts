import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { testAnalysisContext } from "../../src/ai-analysis/test-fixtures";
import { opportunityAnalysisSchema } from "../../src/ai-analysis/domain";
import {
  createGeminiSyntheticSmokeProvider,
  GEMINI_FREE_TIER_CONFIRMED_FLAG,
  GEMINI_SYNTHETIC_SMOKE_FLAG,
} from "../../src/ai-analysis/provider";

const enabled = process.env[GEMINI_SYNTHETIC_SMOKE_FLAG] === "true"
  && process.env[GEMINI_FREE_TIER_CONFIRMED_FLAG] === "true";
const liveTest = enabled ? it : it.skip;

describe("Gemini isolated synthetic live smoke", () => {
  liveTest.each(["ENTREPRENEUR", "UMKM_EXISTING"] as const)("returns schema-valid output for %s fixture", async (userType) => {
    const provider = createGeminiSyntheticSmokeProvider();
    const output = await provider.generate(testAnalysisContext(userType));
    expect(opportunityAnalysisSchema.safeParse(output).success).toBe(true);
  });
});
