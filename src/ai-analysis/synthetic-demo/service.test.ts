import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { SyntheticDemoRequestLimiter } from "./limiter";
import {
  SyntheticDemoInvalidRequestError,
  SyntheticDemoProviderFailureError,
  SyntheticDemoProviderTimeoutError,
  SyntheticDemoRateLimitedError,
  SyntheticDemoResponseInvalidError,
  SyntheticDemoService,
} from "./service";
import { DeterministicSyntheticDemoProvider, type SyntheticDemoProvider } from "./provider";
import { getSyntheticDemoFixture } from "./fixtures";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("SyntheticDemoService", () => {
  it("generates separate deterministic examples from the trusted registry only", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const service = new SyntheticDemoService({ provider: new DeterministicSyntheticDemoProvider() });
    const entrepreneur = await service.generate({ fixtureId: "DEMO_ENTREPRENEUR" });
    const umkm = await service.generate({ fixtureId: "DEMO_UMKM" });

    expect(entrepreneur.fixtureId).toBe("DEMO_ENTREPRENEUR");
    expect(umkm.fixtureId).toBe("DEMO_UMKM");
    expect(entrepreneur.analysis.summary).not.toBe(umkm.analysis.summary);
    expect(entrepreneur.execution).toEqual({
      mode: "MOCK",
      provider: "local-mock",
      model: "synthetic-fixture-v1",
      displayLabel: "Contoh hasil simulasi — bukan respons 9Router live",
    });
    expect(entrepreneur.evidenceReferences).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unknown fixture identifiers, extra fields, and client-supplied context", async () => {
    const generate = vi.fn();
    const service = new SyntheticDemoService({ provider: { execution: new DeterministicSyntheticDemoProvider().execution, generate } });
    await expect(service.generate({ fixtureId: "DEMO_ADMIN" })).rejects.toBeInstanceOf(SyntheticDemoInvalidRequestError);
    await expect(service.generate({ fixtureId: "DEMO_ENTREPRENEUR", profile: { name: "client" } }))
      .rejects.toBeInstanceOf(SyntheticDemoInvalidRequestError);
    await expect(service.generate({ fixtureId: "DEMO_UMKM", opportunity: { score: 99 } }))
      .rejects.toBeInstanceOf(SyntheticDemoInvalidRequestError);
    expect(generate).not.toHaveBeenCalled();
  });

  it("validates provider output and never returns an invalid response", async () => {
    const service = new SyntheticDemoService({ provider: { execution: new DeterministicSyntheticDemoProvider().execution, generate: async () => ({ summary: "incomplete" }) } });
    await expect(service.generate({ fixtureId: "DEMO_ENTREPRENEUR" })).rejects.toBeInstanceOf(SyntheticDemoResponseInvalidError);
  });

  it("sanitizes provider failures and makes exactly one provider call without retry", async () => {
    const generate = vi.fn(async () => { throw new Error("private synthetic provider body"); });
    const service = new SyntheticDemoService({ provider: { execution: new DeterministicSyntheticDemoProvider().execution, generate } });
    await expect(service.generate({ fixtureId: "DEMO_UMKM" })).rejects.toBeInstanceOf(SyntheticDemoProviderFailureError);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("enforces its independent timeout and does not retry", async () => {
    vi.useFakeTimers();
    const generate = vi.fn(() => new Promise<never>(() => undefined));
    const service = new SyntheticDemoService({ provider: { execution: new DeterministicSyntheticDemoProvider().execution, generate } });
    const pending = service.generate({ fixtureId: "DEMO_ENTREPRENEUR" });
    const assertion = expect(pending).rejects.toBeInstanceOf(SyntheticDemoProviderTimeoutError);
    await vi.advanceTimersByTimeAsync(2_000);
    await assertion;
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("limits requests per minute and permits only one concurrent generation", async () => {
    const limiter = new SyntheticDemoRequestLimiter({ windowMs: 60_000, maximumRequests: 2, maximumConcurrent: 1 });
    const releaseFirst = limiter.acquire(1_000);
    expect(releaseFirst.allowed).toBe(true);
    const busy = limiter.acquire(1_001);
    expect(busy).toEqual({ allowed: false, reason: "BUSY" });
    if (releaseFirst.allowed) releaseFirst.release();

    const releaseSecond = limiter.acquire(1_002);
    expect(releaseSecond.allowed).toBe(true);
    if (releaseSecond.allowed) releaseSecond.release();
    expect(limiter.acquire(1_003)).toEqual({ allowed: false, reason: "RATE_LIMITED" });
    expect(limiter.acquire(62_000).allowed).toBe(true);
  });

  it("maps limiter rejection without invoking the provider", async () => {
    const limiter = new SyntheticDemoRequestLimiter({ maximumRequests: 0 });
    const generate = vi.fn();
    const service = new SyntheticDemoService({ limiter, provider: { execution: new DeterministicSyntheticDemoProvider().execution, generate } });
    await expect(service.generate({ fixtureId: "DEMO_ENTREPRENEUR" })).rejects.toBeInstanceOf(SyntheticDemoRateLimitedError);
    expect(generate).not.toHaveBeenCalled();
  });

  it("passes the exact trusted fixture to an injected provider", async () => {
    const generate: SyntheticDemoProvider["generate"] = vi.fn(async (fixture) => ({ analysis: fixture.mockAnalysis, evidenceReferences: [] }));
    const service = new SyntheticDemoService({ provider: { execution: new DeterministicSyntheticDemoProvider().execution, generate } });
    await service.generate({ fixtureId: "DEMO_UMKM" });
    expect(generate).toHaveBeenCalledWith(getSyntheticDemoFixture("DEMO_UMKM"), expect.any(AbortSignal));
  });

  it("rejects fabricated evidence references and unsupported numerical or guaranteed claims", async () => {
    const fixture = getSyntheticDemoFixture("DEMO_ENTREPRENEUR");
    const outputs = [
      { analysis: fixture.mockAnalysis, evidenceReferences: ["market-report"] },
      { analysis: { ...fixture.mockAnalysis, potential: "Permintaan mencapai 500 pelanggan." }, evidenceReferences: [] },
      { analysis: { ...fixture.mockAnalysis, potential: "Konsep ini dijamin berhasil." }, evidenceReferences: [] },
    ];
    for (const output of outputs) {
      const service = new SyntheticDemoService({
        provider: { execution: new DeterministicSyntheticDemoProvider().execution, generate: async () => output },
      });
      await expect(service.generate({ fixtureId: "DEMO_ENTREPRENEUR" })).rejects.toBeInstanceOf(SyntheticDemoResponseInvalidError);
    }
  });

  it("does not accept provider-claimed mode metadata from generated content", async () => {
    const fixture = getSyntheticDemoFixture("DEMO_ENTREPRENEUR");
    const service = new SyntheticDemoService({
      provider: {
        execution: new DeterministicSyntheticDemoProvider().execution,
        generate: async () => ({
          analysis: fixture.mockAnalysis,
          evidenceReferences: [],
          execution: {
            mode: "LIVE_SYNTHETIC",
            provider: "ninerouter",
            model: "claimed-by-generated-output",
            displayLabel: "claimed live",
          },
        }),
      },
    });
    await expect(service.generate({ fixtureId: "DEMO_ENTREPRENEUR" }))
      .rejects.toBeInstanceOf(SyntheticDemoResponseInvalidError);
  });
});
