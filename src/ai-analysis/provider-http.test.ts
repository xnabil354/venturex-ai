import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { testAnalysis, testAnalysisContext, testUser } from "./test-fixtures";
import {
  createGeminiSyntheticSmokeProvider,
  GEMINI_BASE_URL,
  GEMINI_FREE_TIER_CONFIRMED_FLAG,
  GEMINI_MODEL,
  GEMINI_PROVIDER,
  GEMINI_SYNTHETIC_SMOKE_FLAG,
} from "./provider";

describe("Gemini OpenAI-compatible HTTP contract", () => {
  it("uses the official chat-completions URL, stable model, bearer header, and JSON Schema with synthetic context", async () => {
    const requests: Request[] = [];
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      requests.push(request);
      return Response.json({
        id: "chatcmpl-synthetic",
        object: "chat.completion",
        created: 1,
        model: GEMINI_MODEL,
        choices: [{
          index: 0,
          message: { role: "assistant", content: JSON.stringify(testAnalysis) },
          finish_reason: "stop",
        }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });
    });
    const provider = createGeminiSyntheticSmokeProvider({
      AI_ANALYSIS_PROVIDER: GEMINI_PROVIDER,
      AI_ANALYSIS_BASE_URL: `${GEMINI_BASE_URL}/`,
      AI_ANALYSIS_API_KEY: "synthetic-test-key",
      AI_ANALYSIS_MODEL: GEMINI_MODEL,
      AI_ANALYSIS_TIMEOUT_MS: "12000",
      [GEMINI_SYNTHETIC_SMOKE_FLAG]: "true",
      [GEMINI_FREE_TIER_CONFIRMED_FLAG]: "true",
    }, fetcher);

    const output = await provider.generate(testAnalysisContext("ENTREPRENEUR"));
    expect(output).toEqual(testAnalysis);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const request = requests[0];
    expect(request?.url).toBe(`${GEMINI_BASE_URL}/chat/completions`);
    expect(request?.method).toBe("POST");
    expect(request?.headers.get("authorization")).toBe("Bearer synthetic-test-key");
    const body = await request?.clone().json() as {
      model: string;
      response_format: {
        type: string;
        json_schema: {
          schema: {
            required: string[];
            properties: { risks: { minItems: number; maxItems: number } };
          };
        };
      };
      messages: { content: string }[];
    };
    expect(body.model).toBe(GEMINI_MODEL);
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.schema.required).toEqual(expect.arrayContaining([
      "summary", "whyRelevant", "targetConsumer", "competition", "potential", "risks", "nextAction",
    ]));
    expect(body.response_format.json_schema.schema.properties.risks).toMatchObject({ minItems: 1, maxItems: 6 });
    expect(JSON.stringify(body.response_format.json_schema.schema)).not.toMatch(/"(?:minLength|maxLength)"/u);
    expect(JSON.stringify(body.messages)).not.toContain(testUser().email);
    expect(JSON.stringify(body.messages)).not.toContain(testUser().id);
  });
});
