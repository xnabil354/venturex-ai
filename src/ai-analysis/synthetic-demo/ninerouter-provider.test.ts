import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { NINEROUTER_REQUESTED_MODEL, type NineRouterConfig } from "../ninerouter";
import { SYNTHETIC_DEMO_FIXTURES } from "./fixtures";
import { NineRouterSyntheticDemoProvider, MAX_LIVE_NINEROUTER_REQUESTS_PER_PROCESS } from "./ninerouter-provider";

const config: NineRouterConfig = {
  provider: "ninerouter",
  baseURL: "https://router.example.test/v1",
  apiKey: "synthetic-test-key",
  model: NINEROUTER_REQUESTED_MODEL,
  timeoutMs: 12_000,
};

function validOutput() {
  return {
    analysis: {
      summary: "Hipotesis ini hanya menggunakan profil dan peluang sintetis yang disediakan.",
      whyRelevant: "Profil sintetis menyebut minat pada minuman teh.",
      targetConsumer: "Belum tersedia evidence tentang konsumen.",
      competition: "Data kompetisi tidak tersedia pada fixture.",
      potential: "Gagasan ini masih perlu diuji dan bukan prediksi pasar.",
      risks: ["Tidak tersedia evidence pasar atau pesaing."],
      nextAction: "Tanyakan tanggapan calon konsumen sebelum mengambil keputusan.",
    },
    evidenceReferences: [],
  };
}

function completion(body: unknown): Response {
  return Response.json({
    id: "chatcmpl-synthetic",
    object: "chat.completion",
    created: 1,
    model: NINEROUTER_REQUESTED_MODEL,
    choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(body) }, finish_reason: "stop" }],
  });
}

describe("9Router synthetic demo adapter", () => {
  it("sends only the fixed server-owned persona fixture and returns validated output", async () => {
    const requests: Request[] = [];
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      requests.push(input instanceof Request ? input : new Request(input, init));
      return completion(validOutput());
    });
    const budget = { consume: vi.fn(() => true) };
    const provider = new NineRouterSyntheticDemoProvider(config, { fetcher, budget });
    const result = await provider.generate(SYNTHETIC_DEMO_FIXTURES.DEMO_UMKM, new AbortController().signal);
    const request = requests[0];
    const body = await request?.clone().json() as { model: string; messages: { content: string }[] };
    const contents = JSON.stringify(body.messages);

    expect(result).toEqual(validOutput());
    expect(fetcher).toHaveBeenCalledOnce();
    expect(budget.consume).toHaveBeenCalledOnce();
    expect(request?.headers.get("authorization")).toBe("Bearer synthetic-test-key");
    expect(body.model).toBe(NINEROUTER_REQUESTED_MODEL);
    expect(contents).toContain("UMKM_EXISTING");
    expect(contents).toContain("\\\"analysis\\\"");
    expect(contents).toContain("\\\"evidenceReferences\\\":[]");
    expect(contents).toContain("tepat tujuh field");
    expect(contents).not.toContain("ENTREPRENEUR");
    expect(contents).not.toContain("synthetic-user@example.test");
  });

  it("consumes the process allowance before an upstream failure and never retries", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response("upstream secret", { status: 503 }));
    const budget = { consume: vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false) };
    const provider = new NineRouterSyntheticDemoProvider(config, { fetcher, budget });
    await expect(provider.generate(SYNTHETIC_DEMO_FIXTURES.DEMO_ENTREPRENEUR, new AbortController().signal))
      .rejects.toMatchObject({ category: "UPSTREAM_UNAVAILABLE", outboundAttempted: true });
    await expect(provider.generate(SYNTHETIC_DEMO_FIXTURES.DEMO_UMKM, new AbortController().signal))
      .rejects.toMatchObject({ reason: "RATE_LIMITED" });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(budget.consume).toHaveBeenCalledTimes(2);
    expect(MAX_LIVE_NINEROUTER_REQUESTS_PER_PROCESS).toBe(1);
  });

  it("keeps output-shape diagnostics sanitized at the synthetic provider boundary", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => completion({
      summary: "provider-only-secret-text",
      additionalPrivateField: "private-value",
    }));
    const provider = new NineRouterSyntheticDemoProvider(config, { fetcher, budget: { consume: () => true } });

    let caught: unknown;
    try {
      await provider.generate(SYNTHETIC_DEMO_FIXTURES.DEMO_UMKM, new AbortController().signal);
    } catch (error) { caught = error; }
    expect(caught).toMatchObject({
        category: "INVALID_PROVIDER_RESPONSE",
        responseDiagnostic: {
          failure: "SCHEMA_VALIDATION_FAILED",
          jsonRootType: "object",
          issues: expect.any(Array),
        },
    });
    expect(JSON.stringify(caught)).not.toContain("provider-only-secret-text");
    expect(JSON.stringify(caught)).not.toContain("additionalPrivateField");
    expect(JSON.stringify(caught)).not.toContain("private-value");
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
