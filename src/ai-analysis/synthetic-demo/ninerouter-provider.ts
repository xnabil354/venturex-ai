import "server-only";

import { SyntheticDemoProviderFailureError, SyntheticDemoRateLimitedError, SyntheticDemoResponseInvalidError } from "./errors";
import { syntheticDemoProviderOutputSchema, type SyntheticDemoExecution, type SyntheticDemoProviderOutput } from "./contracts";
import type { SyntheticDemoFixture } from "./fixtures";
import type { SyntheticDemoProvider } from "./provider";
import { generateNineRouterJson, NineRouterError, type NineRouterConfig } from "../ninerouter";
import { consumeProcessRequestBudget } from "../../lib/process-request-budget";

export const MAX_LIVE_NINEROUTER_REQUESTS_PER_PROCESS = 1;
export const syntheticNineRouterLimits = Object.freeze({
  timeoutMs: 15_000,
  maxRequestBytes: 24 * 1024,
  maxResponseBytes: 64 * 1024,
  automaticRetries: 0,
});

export interface NineRouterRequestBudget {
  consume(): boolean;
}

export class ProcessNineRouterRequestBudget implements NineRouterRequestBudget {
  consume(): boolean {
    return consumeProcessRequestBudget(
      "__venturexSyntheticNineRouterRequestCount",
      MAX_LIVE_NINEROUTER_REQUESTS_PER_PROCESS,
    );
  }
}

function registered(fixture: SyntheticDemoFixture): boolean {
  return (fixture.fixtureId === "DEMO_ENTREPRENEUR" || fixture.fixtureId === "DEMO_UMKM")
    && fixture.fixtureVersion === "synthetic-fixture-v1"
    && /^[a-f0-9]{64}$/u.test(fixture.fixtureContentHash);
}

function promptFor(fixture: SyntheticDemoFixture): string {
  return [
    "Keluarkan hanya satu objek JSON valid tanpa Markdown atau teks pembuka/penutup.",
    "Bentuk objek wajib tepat seperti ini: {\"analysis\":{\"summary\":\"...\",\"whyRelevant\":\"...\",\"targetConsumer\":\"...\",\"competition\":\"...\",\"potential\":\"...\",\"risks\":[\"...\"],\"nextAction\":\"...\"},\"evidenceReferences\":[]}.",
    "Objek `analysis` wajib berisi tepat tujuh field: summary, whyRelevant, targetConsumer, competition, potential, risks, nextAction. Semua selain risks berupa string; risks berupa array string.",
    "Semua konteks adalah sintetis tetap, bukan data orang/usaha nyata dan bukan bukti pasar.",
    "Jangan mengarang fakta pasar, angka, pendapatan, margin, skor, statistik, atau prediksi. Jangan mengklaim hasil dijamin.",
    "Gunakan hipotesis dan batasan secara eksplisit. `evidenceReferences` wajib berupa array kosong karena fixture tidak menyediakan evidence. Jangan menambahkan field lain.",
    "Konteks fixture:",
    JSON.stringify({
      persona: fixture.userType,
      personaLabel: fixture.personaLabel,
      profile: fixture.profile,
      opportunity: fixture.opportunity,
      evidence: fixture.evidence,
      decisionSupport: fixture.decisionSupport,
      limitations: fixture.limitations,
    }),
  ].join("\n\n");
}

function mapError(error: unknown): never {
  if (error instanceof NineRouterError) {
    if (error.category === "RATE_LIMITED") throw new SyntheticDemoRateLimitedError("RATE_LIMITED", error.upstreamStatus);
    const category = error.category === "TIMEOUT" ? "TIMEOUT"
      : error.category === "NETWORK" ? "NETWORK_ERROR"
        : error.category === "UPSTREAM_UNAVAILABLE" ? "UPSTREAM_UNAVAILABLE"
          : error.category === "UPSTREAM_AUTH" ? "UPSTREAM_AUTH"
            : error.category === "INVALID_RESPONSE" ? "INVALID_PROVIDER_RESPONSE"
              : error.category === "CONFIGURATION_UNAVAILABLE" ? "PROVIDER_CONFIGURATION_INVALID"
                : error.category === "UPSTREAM_HTTP" ? "UPSTREAM_HTTP"
                  : "LOCAL_REQUEST_REJECTED";
    throw new SyntheticDemoProviderFailureError(category, error.upstreamStatus, error.outboundAttempted, error.responseDiagnostic);
  }
  throw new SyntheticDemoProviderFailureError();
}

export class NineRouterSyntheticDemoProvider implements SyntheticDemoProvider {
  readonly execution: SyntheticDemoExecution = {
    mode: "LIVE_SYNTHETIC",
    provider: "ninerouter",
    model: "cx/gpt-6-luna-xhigh",
    displayLabel: "Analisis 9Router — menggunakan profil demo sintetis",
  };
  readonly timeoutMs = syntheticNineRouterLimits.timeoutMs;

  private readonly config: NineRouterConfig;
  private readonly fetcher: typeof fetch;
  private readonly budget: NineRouterRequestBudget;

  constructor(config: NineRouterConfig, options: { readonly fetcher?: typeof fetch; readonly budget?: NineRouterRequestBudget } = {}) {
    if (config.provider !== "ninerouter" || config.model !== this.execution.model) {
      throw new Error("Synthetic 9Router configuration rejected.");
    }
    this.config = { ...config, timeoutMs: Math.min(config.timeoutMs, syntheticNineRouterLimits.timeoutMs) };
    this.fetcher = options.fetcher ?? globalThis.fetch;
    this.budget = options.budget ?? new ProcessNineRouterRequestBudget();
  }

  async generate(fixture: SyntheticDemoFixture, signal: AbortSignal): Promise<SyntheticDemoProviderOutput> {
    if (!registered(fixture)) throw new SyntheticDemoResponseInvalidError();
    if (!this.budget.consume()) throw new SyntheticDemoRateLimitedError("RATE_LIMITED");
    try {
      return await generateNineRouterJson({
        config: this.config,
        system: "Anda membantu eksplorasi awal usaha F&B berdasarkan data sintetis tetap. Jangan menyatakan kesimpulan sebagai fakta pasar.",
        prompt: promptFor(fixture),
        schema: syntheticDemoProviderOutputSchema,
        requestBytesLimit: syntheticNineRouterLimits.maxRequestBytes,
        responseBytesLimit: syntheticNineRouterLimits.maxResponseBytes,
        fetcher: this.fetcher,
        signal,
      });
    } catch (error) {
      return mapError(error);
    }
  }
}
