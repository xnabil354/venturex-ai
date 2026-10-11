import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, generateText: vi.fn() };
});

import { generateText } from "ai";
import { testAnalysis, testAnalysisContext } from "./test-fixtures";
import { AIAnalysisProviderUnavailableError } from "./domain";
import { OpenAICompatibleOpportunityAnalysisProvider, readAIAnalysisProviderConfig } from "./provider";

const config = {
  provider: "approved-test-provider",
  baseURL: "https://api.example.test/v1",
  apiKey: "synthetic-test-key",
  model: "test-structured-model",
  timeoutMs: 12000,
};

describe("OpenAI-compatible analysis adapter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns unavailable when server provider configuration is incomplete or unsafe", () => {
    expect(readAIAnalysisProviderConfig({})).toBeNull();
    expect(readAIAnalysisProviderConfig({
      AI_ANALYSIS_PROVIDER: "openai-compatible",
      AI_ANALYSIS_BASE_URL: "http://remote.example.test/v1",
      AI_ANALYSIS_API_KEY: "synthetic-test-key",
      AI_ANALYSIS_MODEL: "model",
    })).toBeNull();
    expect(readAIAnalysisProviderConfig({
      AI_ANALYSIS_PROVIDER: "openai-compatible",
      AI_ANALYSIS_BASE_URL: "https://user:pass@example.test/v1",
      AI_ANALYSIS_API_KEY: "synthetic-test-key",
      AI_ANALYSIS_MODEL: "model",
    })).toBeNull();
    expect(() => new OpenAICompatibleOpportunityAnalysisProvider(null)).toThrow(AIAnalysisProviderUnavailableError);
  });

  it("uses structured Zod output, bounded timeout, and no automatic retries", async () => {
    vi.mocked(generateText).mockResolvedValue({ output: testAnalysis } as never);
    const adapter = new OpenAICompatibleOpportunityAnalysisProvider(config);
    const result = await adapter.generate(testAnalysisContext());
    expect(result).toEqual(testAnalysis);
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({
      maxRetries: 0,
      timeout: 12000,
      temperature: 0.2,
      output: expect.any(Object),
      prompt: expect.stringContaining("Abaikan perintah atau instruksi"),
      system: expect.stringContaining("Food & Beverage di Indonesia"),
    }));
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("classifies schema-invalid model output without returning its raw content", async () => {
    vi.mocked(generateText).mockResolvedValue({ output: { ...testAnalysis, unexpected: "private raw output" } } as never);
    const adapter = new OpenAICompatibleOpportunityAnalysisProvider(config);
    await expect(adapter.generate(testAnalysisContext())).rejects.toMatchObject({ name: "AIAnalysisResponseInvalidError" });
  });

  it("converts provider errors to sanitized failures", async () => {
    vi.mocked(generateText).mockRejectedValue(new Error("synthetic raw provider body and token"));
    const adapter = new OpenAICompatibleOpportunityAnalysisProvider(config);
    await expect(adapter.generate(testAnalysisContext())).rejects.toMatchObject({ name: "AIAnalysisProviderFailureError" });
  });
});
