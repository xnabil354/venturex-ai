import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { BrightDataGoogleTrendsProvider, GOOGLE_TRENDS_INDONESIA_TARGET } from "./brightdata-google-trends";
import {
  CandidateCurationError,
  candidateCurationId,
  createCandidateCurationPackets,
} from "./candidate-curation";

const FIXED_TIME = new Date("2026-10-13T03:00:00.000Z");
const syntheticFixture = JSON.parse(
  readFileSync(
    new URL(
      "../../scripts/trend/fixtures/brightdata-candidate-preview.synthetic.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as unknown[];

async function makeBatch(records: unknown[] = syntheticFixture) {
  const fetcher = vi.fn(async () =>
    new Response(JSON.stringify(records), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
  const provider = new BrightDataGoogleTrendsProvider({
    environment: {
      BRIGHTDATA_TRENDS_ENABLED: "true",
      BRIGHTDATA_TRENDS_API_KEY: "synthetic-test-key",
    },
    fetcher,
    now: () => FIXED_TIME,
  });
  const batch = await provider.collectAndScreenCandidateBatch();
  return { batch, fetcher };
}

describe("Bright Data candidate curation packets", () => {
  it("prepares a selected review packet with provenance, raw metric semantics, and human-review gaps", async () => {
    const { batch, fetcher } = await makeBatch();
    const candidate = batch.candidates.find(
      ({ normalizedQuery }) => normalizedQuery === "kopi susu",
    );
    expect(candidate).toBeDefined();
    if (!candidate) return;

    const [packet] = createCandidateCurationPackets(
      batch,
      [candidateCurationId(candidate)],
      "OFFLINE_SYNTHETIC",
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(packet).toMatchObject({
      packetType: "VENTUREX_BRIGHTDATA_CANDIDATE_CURATION_REVIEW",
      schemaVersion: 1,
      mode: "OFFLINE_SYNTHETIC",
      operatorBoundary: "LOCAL_CLI_IDENTITY_NOT_AUTHENTICATED_OR_AUDIT_RECORDED",
      candidate: {
        query: "kopi susu",
        classification: "LIKELY_FNB",
        heuristicOnly: true,
      },
      response: {
        status: "PARTIAL",
        retrievedRecords: 5,
        acceptedRecords: 4,
        rejectedRecords: 1,
      },
      evidenceSufficiency: "INSUFFICIENT_FOR_CATALOG_VALIDATION",
      importReadiness: {
        status: "NOT_READY_FOR_IMPORT",
        compatibleWithCurrentManifest: false,
      },
    });
    expect(packet?.observations[0]).toMatchObject({
      sourceUrl: "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1",
      retrievalTimestamp: null,
      providerStartedAtUnixSeconds: 1767225600,
      fieldAvailability: {
        query: "AVAILABLE",
        volume: "AVAILABLE",
        volumeChange: "AVAILABLE",
        relatedQueries: "AVAILABLE",
      },
      observationPeriod: { status: "UNKNOWN", start: null, end: null },
      metrics: {
        volume: { value: 1200, unit: "UNSPECIFIED" },
        volumeChange: { value: 15, unit: "UNSPECIFIED" },
        active: { value: true, unit: null },
        relatedQueries: {
          availability: "AVAILABLE",
          itemCount: 1,
          valuesIncluded: false,
        },
      },
    });
    expect(packet?.supportingEvidence[0]).toMatchObject({
      kind: "SYNTHETIC_FIXTURE",
      sourceDate: null,
      retrievalTimestamp: null,
    });
    expect(packet?.supportingEvidence[0]?.supportingDetail).toContain("No provider response was observed");
    expect(packet?.limitations.join(" ")).toContain("not a real-world observation");
    expect(packet?.humanReviewRequired.length).toBeGreaterThan(0);
    expect(packet?.catalogFieldsNotSupplied).toContain(
      "Factual signal summary and description.",
    );
    expect(packet).not.toHaveProperty("opportunities");
    expect(packet).not.toHaveProperty("databaseWrites");
  });

  it("keeps missing auxiliary data unavailable and exposes PARTIAL completeness", async () => {
    const { batch } = await makeBatch();
    const candidate = batch.candidates.find(
      ({ normalizedQuery }) => normalizedQuery === "matcha",
    );
    expect(candidate).toBeDefined();
    if (!candidate) return;

    const [packet] = createCandidateCurationPackets(
      batch,
      [candidateCurationId(candidate)],
      "OFFLINE_SYNTHETIC",
    );

    expect(packet?.response.status).toBe("PARTIAL");
    expect(packet?.response.relatedQueriesAvailability).toEqual({
      available: 3,
      unavailable: 1,
      invalid: 1,
      uninspectable: 0,
    });
    expect(packet?.observations[0]?.metrics.relatedQueries).toEqual({
      availability: "UNAVAILABLE",
      itemCount: null,
      valuesIncluded: false,
    });
    expect(packet?.observations[0]?.metrics.volume).toEqual({
      value: null,
      unit: "UNSPECIFIED",
    });
    expect(packet?.observations[0]?.observationPeriod.status).toBe("UNKNOWN");
  });

  it("keeps OUT_OF_SCOPE records reviewable without creating an F&B relevance hypothesis", async () => {
    const { batch } = await makeBatch();
    const candidate = batch.candidates.find(
      ({ normalizedQuery }) => normalizedQuery === "pemilu 2024",
    );
    expect(candidate).toBeDefined();
    if (!candidate) return;

    const [packet] = createCandidateCurationPackets(
      batch,
      [candidateCurationId(candidate)],
      "OFFLINE_SYNTHETIC",
    );

    expect(packet?.candidate.classification).toBe("OUT_OF_SCOPE");
    expect(packet?.relevanceHypothesis).toMatchObject({
      status: "NO_FNB_HYPOTHESIS",
      factualApproval: false,
    });
    expect(packet?.importReadiness.reasons.join(" ")).toContain("OUT_OF_SCOPE");
  });

  it("does not claim sufficient evidence or readiness for the current manifest", async () => {
    const { batch } = await makeBatch();
    const candidate = batch.candidates[0];
    expect(candidate).toBeDefined();
    if (!candidate) return;

    const [packet] = createCandidateCurationPackets(
      batch,
      [candidateCurationId(candidate)],
      "OFFLINE_SYNTHETIC",
    );

    expect(packet?.evidenceSufficiency).toBe("INSUFFICIENT_FOR_CATALOG_VALIDATION");
    expect(packet?.importReadiness.status).toBe("NOT_READY_FOR_IMPORT");
    expect(packet?.importReadiness.reasons.join(" ")).toContain("Year in Search 2025");
    expect(packet?.importReadiness.reasons.join(" ")).toContain("Synthetic fixture data");
  });

  it("rejects invalid source references before preparing a packet", async () => {
    const { batch } = await makeBatch();
    const candidate = batch.candidates[0];
    expect(candidate).toBeDefined();
    if (!candidate) return;

    const invalidCandidate = {
      ...candidate,
      observations: candidate.observations.map((observation) => ({
        ...observation,
        provenance: {
          ...observation.provenance,
          sourceUrl: "file:///private/source",
        },
      })),
    } as unknown as typeof candidate;
    const invalidBatch = {
      ...batch,
      candidates: [invalidCandidate],
    };

    expect(() =>
      createCandidateCurationPackets(
        invalidBatch,
        [candidateCurationId(candidate)],
        "OFFLINE_SYNTHETIC",
      ),
    ).toThrowError(CandidateCurationError);
  });

  it("preserves a supported Trending Now time window in curation provenance", async () => {
    const { batch } = await makeBatch();
    const candidate = batch.candidates[0];
    expect(candidate).toBeDefined();
    if (!candidate) return;
    const windowedCandidate = {
      ...candidate,
      observations: candidate.observations.map((observation) => ({
        ...observation,
        provenance: { ...observation.provenance, sourceUrl: `${GOOGLE_TRENDS_INDONESIA_TARGET}&hours=168` },
      })),
    };
    const windowedBatch = { ...batch, candidates: [windowedCandidate] };
    const candidateId = candidateCurationId(windowedCandidate);
    const [packet] = createCandidateCurationPackets(windowedBatch, [candidateId], "OFFLINE_SYNTHETIC");

    expect(packet?.observations[0]?.sourceUrl).toBe(`${GOOGLE_TRENDS_INDONESIA_TARGET}&hours=168`);
    expect(packet?.supportingEvidence[0]?.sourceReference).toBe(`${GOOGLE_TRENDS_INDONESIA_TARGET}&hours=168`);

    const unsupportedWindow = {
      ...windowedCandidate,
      observations: windowedCandidate.observations.map((observation) => ({
        ...observation,
        provenance: { ...observation.provenance, sourceUrl: `${GOOGLE_TRENDS_INDONESIA_TARGET}&hours=1` },
      })),
    };
    expect(() => candidateCurationId(unsupportedWindow)).toThrowError(CandidateCurationError);
  });

  it("rejects duplicate identities, duplicate selections, and unknown selections", async () => {
    const { batch } = await makeBatch();
    const candidate = batch.candidates[0];
    expect(candidate).toBeDefined();
    if (!candidate) return;
    const id = candidateCurationId(candidate);

    expect(() =>
      createCandidateCurationPackets(
        { ...batch, candidates: [candidate, candidate] },
        [id],
        "OFFLINE_SYNTHETIC",
      ),
    ).toThrowError(CandidateCurationError);
    expect(() =>
      createCandidateCurationPackets(batch, [id, id], "OFFLINE_SYNTHETIC"),
    ).toThrowError(CandidateCurationError);
    expect(() =>
      createCandidateCurationPackets(batch, ["gtrends-not-found"], "OFFLINE_SYNTHETIC"),
    ).toThrowError(CandidateCurationError);
    expect(() =>
      createCandidateCurationPackets(batch, [], "OFFLINE_SYNTHETIC"),
    ).toThrowError(CandidateCurationError);
  });
});
