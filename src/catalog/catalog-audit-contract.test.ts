import { describe, expect, it } from "vitest";

import {
  CatalogAuditContractError,
  catalogAuditEventV2Schema,
  hashVersionedCatalogAuditEventPayload,
  verifyVersionedCatalogAuditLedger,
  type CatalogAuditEventV2,
  type VersionedCatalogAuditEvent,
} from "./catalog-audit-contract";

const shaA = "A".repeat(64);
const shaB = "B".repeat(64);
const shaC = "C".repeat(64);
const trendId = "22222222-2222-4222-8222-222222222222";
const manifestId = "synthetic-audit-fixture";

const legacyV1Payload = {
  schemaVersion: 1,
  sequence: 1,
  id: "11111111-1111-4111-8111-111111111111",
  recordedAt: "2026-10-13T03:00:00.000Z",
  action: "FACTUAL_REVIEW",
  manifestId,
  manifestSha256: shaA,
  trendId,
  contentSha256: shaB,
  actor: {
    osAccount: "synthetic-reviewer",
    role: "FACTUAL_REVIEWER",
    identityAssurance: "LOCAL_OS_ACCOUNT_WITH_SELF_ATTESTED_ROLE",
  },
  decision: "APPROVED",
  rationale: "Synthetic golden v1 factual review event.",
  evidenceLimitations: ["Synthetic fixture; no factual review occurred."],
  transition: null,
  previousHash: null,
} as const;

const legacyV1GoldenHash = "1BD3E98A3A8EE5FFB0363E8B4FF3A5163F7737BB7C11AD81CD55E319E3C8CFFF";

function createV2Event(
  payload: Omit<CatalogAuditEventV2, "hash">,
): CatalogAuditEventV2 {
  return {
    ...payload,
    hash: hashVersionedCatalogAuditEventPayload(payload),
  };
}

function createV2Review(
  overrides: Partial<Omit<CatalogAuditEventV2, "hash" | "schemaVersion" | "action" | "actor" | "decision" | "transition" | "factualReviewReference">> = {},
  options: {
    readonly id?: string;
    readonly decision?: "APPROVED" | "REJECTED";
    readonly contentSha256?: string;
    readonly fingerprintVersion?: 1 | 2;
    readonly previousHash?: string | null;
  } = {},
): CatalogAuditEventV2 {
  return createV2Event({
    schemaVersion: 2,
    sequence: options.previousHash ? 2 : 1,
    id: options.id ?? "33333333-3333-4333-8333-333333333333",
    recordedAt: "2026-10-13T03:01:00.000Z",
    action: "FACTUAL_REVIEW",
    manifestId,
    manifestSha256: shaA,
    trendId,
    fingerprintVersion: options.fingerprintVersion ?? 2,
    contentSha256: options.contentSha256 ?? shaC,
    actor: {
      osAccount: "synthetic-reviewer",
      role: "FACTUAL_REVIEWER",
      identityAssurance: "LOCAL_OS_ACCOUNT_WITH_SELF_ATTESTED_ROLE",
    },
    decision: options.decision ?? "APPROVED",
    rationale: "Synthetic review event for versioned audit contract tests.",
    evidenceLimitations: ["Synthetic fixture only; no real source was reviewed."],
    transition: null,
    factualReviewReference: null,
    previousHash: options.previousHash ?? null,
    ...overrides,
  });
}

function createV2PublicationApproval(
  review: VersionedCatalogAuditEvent,
  overrides: Partial<Omit<CatalogAuditEventV2, "hash" | "schemaVersion" | "action" | "actor" | "decision" | "transition">> = {},
): CatalogAuditEventV2 {
  return createV2Event({
    schemaVersion: 2,
    sequence: 2,
    id: "44444444-4444-4444-8444-444444444444",
    recordedAt: "2026-10-13T03:02:00.000Z",
    action: "PUBLICATION_APPROVAL",
    manifestId,
    manifestSha256: shaA,
    trendId,
    fingerprintVersion: review.schemaVersion === 1 ? 1 : review.fingerprintVersion,
    contentSha256: review.contentSha256,
    actor: {
      osAccount: "synthetic-owner",
      role: "PRODUCT_DATA_OWNER",
      identityAssurance: "LOCAL_OS_ACCOUNT_WITH_SELF_ATTESTED_ROLE",
    },
    decision: "APPROVED",
    rationale: "Synthetic publication approval for contract testing only.",
    evidenceLimitations: review.evidenceLimitations,
    transition: null,
    factualReviewReference: { eventId: review.id, eventHash: review.hash },
    previousHash: review.hash,
    ...overrides,
  });
}

describe("isolated versioned catalog audit contract", () => {
  it("preserves the historical v1 canonical hash and accepts the unversioned legacy event", () => {
    const hash = hashVersionedCatalogAuditEventPayload(legacyV1Payload);
    expect(hash).toBe(legacyV1GoldenHash);

    const [verified] = verifyVersionedCatalogAuditLedger([
      { ...legacyV1Payload, hash },
    ]);
    expect(verified).toEqual({ ...legacyV1Payload, hash });
    expect(verified).not.toHaveProperty("fingerprintVersion");
    expect(() => hashVersionedCatalogAuditEventPayload({
      ...legacyV1Payload,
      fingerprintVersion: 1,
    })).toThrow(CatalogAuditContractError);
  });

  it("verifies a v1-to-v2 chain and binds publication approval to the exact latest review", () => {
    const v1Review = { ...legacyV1Payload, hash: legacyV1GoldenHash } as unknown as VersionedCatalogAuditEvent;
    const v2Review = createV2Review({ sequence: 2, previousHash: legacyV1GoldenHash }, {
      id: "33333333-3333-4333-8333-333333333333",
      previousHash: legacyV1GoldenHash,
    });
    const approval = createV2PublicationApproval(v2Review, {
      sequence: 3,
      previousHash: v2Review.hash,
    });

    const verified = verifyVersionedCatalogAuditLedger([v1Review, v2Review, approval]);
    expect(verified.map((event) => event.schemaVersion)).toEqual([1, 2, 2]);
    expect(verified[0]).not.toHaveProperty("fingerprintVersion");
    expect(verified[2]).toMatchObject({
      action: "PUBLICATION_APPROVAL",
      factualReviewReference: { eventId: v2Review.id, eventHash: v2Review.hash },
    });
  });

  it("allows an explicitly versioned v2 audit event to reference a compatible legacy v1 review", () => {
    const v1Review = { ...legacyV1Payload, hash: legacyV1GoldenHash } as unknown as VersionedCatalogAuditEvent;
    const approval = createV2PublicationApproval(v1Review);

    expect(verifyVersionedCatalogAuditLedger([v1Review, approval])).toHaveLength(2);
    expect(approval.fingerprintVersion).toBe(1);
  });

  it("rejects missing, unsupported, and backward-moving schema or fingerprint versions", () => {
    const review = createV2Review();
    const { fingerprintVersion: _fingerprintVersion, ...missingVersion } = review;
    expect(() => verifyVersionedCatalogAuditLedger([missingVersion])).toThrow(CatalogAuditContractError);
    expect(() => verifyVersionedCatalogAuditLedger([{ ...review, fingerprintVersion: 3 } as unknown])).toThrow(CatalogAuditContractError);
    expect(() => verifyVersionedCatalogAuditLedger([{ ...review, schemaVersion: 3 } as unknown])).toThrow(/unsupported schema version/i);

    const v1Review = { ...legacyV1Payload, hash: legacyV1GoldenHash } as unknown as VersionedCatalogAuditEvent;
    const v2Review = createV2Review({}, { previousHash: v1Review.hash });
    const laterV1 = {
      ...legacyV1Payload,
      sequence: 3,
      id: "55555555-5555-4555-8555-555555555555",
      previousHash: v2Review.hash,
      hash: legacyV1GoldenHash,
    };
    expect(() => verifyVersionedCatalogAuditLedger([v1Review, v2Review, laterV1]))
      .toThrow(/cannot move backward/i);
  });

  it("rejects sequence gaps, incorrect previousHash values, and event mutation", () => {
    const first = createV2Review();
    const gap = createV2Review({
      sequence: 3,
      previousHash: first.hash,
      id: "55555555-5555-4555-8555-555555555555",
    }, {
      id: "55555555-5555-4555-8555-555555555555",
      previousHash: first.hash,
    });
    expect(() => verifyVersionedCatalogAuditLedger([first, gap])).toThrow(/discontinuous sequence/i);

    const wrongPreviousHash = createV2Review({
      sequence: 2,
      previousHash: shaB,
      id: "55555555-5555-4555-8555-555555555555",
    }, {
      id: "55555555-5555-4555-8555-555555555555",
      previousHash: shaB,
    });
    expect(() => verifyVersionedCatalogAuditLedger([first, wrongPreviousHash])).toThrow(/invalid previousHash/i);

    expect(() => verifyVersionedCatalogAuditLedger([
      first,
      {
        ...first,
        sequence: 2,
        id: "66666666-6666-4666-8666-666666666666",
        previousHash: first.hash,
        rationale: "This event was modified after its original hash was recorded.",
      },
    ])).toThrow(/hash verification failed/i);
  });

  it("rejects approval references with a wrong event hash, context, or review decision", () => {
    const review = createV2Review();
    const wrongHashApproval = createV2PublicationApproval(review, {
      sequence: 2,
      previousHash: review.hash,
      factualReviewReference: { eventId: review.id, eventHash: shaB },
    });
    expect(() => verifyVersionedCatalogAuditLedger([review, wrongHashApproval]))
      .toThrow(/unknown or mismatched audit event/i);

    const wrongContextApproval = createV2PublicationApproval(review, {
      sequence: 2,
      previousHash: review.hash,
      trendId: "66666666-6666-4666-8666-666666666666",
    });
    expect(() => verifyVersionedCatalogAuditLedger([review, wrongContextApproval]))
      .toThrow(/does not match the approved review context/i);

    const wrongFingerprintVersionApproval = createV2PublicationApproval(review, {
      sequence: 2,
      previousHash: review.hash,
      fingerprintVersion: 1,
    });
    expect(() => verifyVersionedCatalogAuditLedger([review, wrongFingerprintVersionApproval]))
      .toThrow(/does not match the approved review context/i);

    const changedLimitationsApproval = createV2PublicationApproval(review, {
      sequence: 2,
      previousHash: review.hash,
      evidenceLimitations: ["A different limitation was recorded at approval time."],
    });
    expect(() => verifyVersionedCatalogAuditLedger([review, changedLimitationsApproval]))
      .toThrow(/does not match the approved review context/i);

    const rejectedReview = createV2Review({ sequence: 1, previousHash: null }, {
      id: "77777777-7777-4777-8777-777777777777",
      decision: "REJECTED",
    });
    const rejectedApproval = createV2PublicationApproval(rejectedReview, {
      sequence: 2,
      previousHash: rejectedReview.hash,
    });
    expect(() => verifyVersionedCatalogAuditLedger([rejectedReview, rejectedApproval]))
      .toThrow(/does not match the approved review context/i);
  });

  it("rejects approval that points to an older review after a newer decision", () => {
    const firstReview = createV2Review();
    const laterRejectedReview = createV2Review({
      sequence: 2,
      previousHash: firstReview.hash,
      id: "77777777-7777-4777-8777-777777777777",
    }, {
      id: "77777777-7777-4777-8777-777777777777",
      decision: "REJECTED",
      previousHash: firstReview.hash,
    });
    const staleApproval = createV2PublicationApproval(firstReview, {
      sequence: 3,
      previousHash: laterRejectedReview.hash,
    });

    expect(() => verifyVersionedCatalogAuditLedger([firstReview, laterRejectedReview, staleApproval]))
      .toThrow(/latest factual review/i);
  });

  it("strictly rejects malformed action references, extra fields, and inconsistent actor/action metadata", () => {
    const review = createV2Review();
    const validApproval = createV2PublicationApproval(review);
    const malformedReference = {
      ...validApproval,
      factualReviewReference: {
        eventId: review.id,
        eventHash: review.hash,
        extra: "rejected",
      },
    };
    expect(() => verifyVersionedCatalogAuditLedger([review, malformedReference])).toThrow(CatalogAuditContractError);

    const { hash: _hash, ...payload } = review;
    expect(() => hashVersionedCatalogAuditEventPayload({ ...payload, unexpected: true })).toThrow(CatalogAuditContractError);

    expect(() => catalogAuditEventV2Schema.parse({
      ...review,
      actor: { ...review.actor, role: "OPERATOR" },
    })).toThrow();
  });
});
