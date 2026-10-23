import "server-only";

import type { SyntheticDemoExecution, SyntheticDemoProviderOutput } from "./contracts";
import type { SyntheticDemoFixture } from "./fixtures";

export interface SyntheticDemoProvider {
  readonly execution: SyntheticDemoExecution;
  readonly timeoutMs?: number;
  generate(fixture: SyntheticDemoFixture, signal: AbortSignal): Promise<unknown>;
}

/** A deterministic offline provider. It has no network, credentials, SDK, or retry path. */
export class DeterministicSyntheticDemoProvider implements SyntheticDemoProvider {
  readonly execution: SyntheticDemoExecution = {
    mode: "MOCK",
    provider: "local-mock",
    model: "synthetic-fixture-v1",
    displayLabel: "Contoh hasil simulasi — bukan respons 9Router live",
  };

  async generate(fixture: SyntheticDemoFixture, _signal: AbortSignal): Promise<SyntheticDemoProviderOutput> {
    return { analysis: fixture.mockAnalysis, evidenceReferences: [] };
  }
}
