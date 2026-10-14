import "server-only";

import {
  syntheticDemoExecutionSchema,
  syntheticDemoProviderOutputSchema,
  syntheticDemoRequestSchema,
  type SyntheticDemoResult,
} from "./contracts";
import {
  SyntheticDemoInvalidRequestError,
  SyntheticDemoProviderFailureError,
  SyntheticDemoProviderTimeoutError,
  SyntheticDemoRateLimitedError,
  SyntheticDemoResponseInvalidError,
} from "./errors";
import { getSyntheticDemoFixture } from "./fixtures";
import { SyntheticDemoRequestLimiter } from "./limiter";
import { DeterministicSyntheticDemoProvider, type SyntheticDemoProvider } from "./provider";

export {
  SyntheticDemoInvalidRequestError,
  SyntheticDemoProviderFailureError,
  SyntheticDemoProviderTimeoutError,
  SyntheticDemoRateLimitedError,
  SyntheticDemoResponseInvalidError,
} from "./errors";

const PROVIDER_TIMEOUT_MS = 2_000;
const MAX_PROVIDER_TIMEOUT_MS = 15_000;
const FORBIDDEN_NUMERICAL_OR_GUARANTEE_CLAIM = /\p{N}|\b(?:dijamin|pasti\s+(?:berhasil|sukses|laku|untung)|keberhasilan\s+terjamin|tanpa\s+risiko|jaminan\s+(?:sukses|keuntungan))\b/iu;

export class SyntheticDemoService {
  private readonly provider: SyntheticDemoProvider;
  private readonly limiter: SyntheticDemoRequestLimiter;

  constructor(options: {
    provider?: SyntheticDemoProvider;
    limiter?: SyntheticDemoRequestLimiter;
  } = {}) {
    this.provider = options.provider ?? new DeterministicSyntheticDemoProvider();
    this.limiter = options.limiter ?? new SyntheticDemoRequestLimiter();
  }

  async generate(input: unknown): Promise<SyntheticDemoResult> {
    const request = syntheticDemoRequestSchema.safeParse(input);
    if (!request.success) throw new SyntheticDemoInvalidRequestError();

    const permit = this.limiter.acquire();
    if (!permit.allowed) throw new SyntheticDemoRateLimitedError(permit.reason);

    const fixture = getSyntheticDemoFixture(request.data.fixtureId);
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let didTimeout = false;
    const configuredTimeout = this.provider.timeoutMs ?? PROVIDER_TIMEOUT_MS;
    const timeoutMs = Number.isInteger(configuredTimeout)
      ? Math.min(MAX_PROVIDER_TIMEOUT_MS, Math.max(1_000, configuredTimeout))
      : PROVIDER_TIMEOUT_MS;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => {
        didTimeout = true;
        controller.abort();
        reject(new SyntheticDemoProviderTimeoutError());
      }, timeoutMs);
    });

    try {
      const raw = await Promise.race([this.provider.generate(fixture, controller.signal), timeout]);
      const parsedOutput = syntheticDemoProviderOutputSchema.safeParse(raw);
      if (!parsedOutput.success) throw new SyntheticDemoResponseInvalidError();
      const execution = syntheticDemoExecutionSchema.safeParse(this.provider.execution);
      if (!execution.success) throw new SyntheticDemoResponseInvalidError();
      const analysisText = Object.values(parsedOutput.data.analysis).flat().join(" ");
      if (FORBIDDEN_NUMERICAL_OR_GUARANTEE_CLAIM.test(analysisText)) throw new SyntheticDemoResponseInvalidError();
      // Current demo fixtures intentionally provide no evidence IDs; any model-authored reference is unsupported.
      const allowedEvidenceReferences = new Set<string>();
      if (parsedOutput.data.evidenceReferences.some((reference) => !allowedEvidenceReferences.has(reference))) {
        throw new SyntheticDemoResponseInvalidError();
      }

      return {
        fixtureId: fixture.fixtureId,
        fixtureVersion: fixture.fixtureVersion,
        fixtureContentHash: fixture.fixtureContentHash,
        personaLabel: fixture.personaLabel,
        profile: fixture.profile,
        opportunity: fixture.opportunity,
        evidence: { ...fixture.evidence, records: [] },
        decisionSupport: fixture.decisionSupport,
        limitations: [...fixture.limitations],
        analysis: parsedOutput.data.analysis,
        evidenceReferences: parsedOutput.data.evidenceReferences,
        execution: execution.data,
      };
    } catch (error) {
      if (error instanceof SyntheticDemoResponseInvalidError
        || error instanceof SyntheticDemoProviderTimeoutError
        || error instanceof SyntheticDemoRateLimitedError) throw error;
      if (didTimeout) throw new SyntheticDemoProviderTimeoutError(this.provider.execution.mode === "LIVE_SYNTHETIC" ? null : false);
      if (error instanceof SyntheticDemoProviderFailureError) throw error;
      throw new SyntheticDemoProviderFailureError();
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      permit.release();
    }
  }
}
