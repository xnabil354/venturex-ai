import { describe, expect, it } from "vitest";

import { messageForPrivateOpportunityError } from "./private-opportunity-error-message";

describe("messageForPrivateOpportunityError", () => {
  it("maps schema, JSON, and empty-response failures to distinct safe messages", () => {
    const messages = [
      messageForPrivateOpportunityError({
        code: "AI_RESPONSE_INVALID",
        providerDiagnostic: { category: "INVALID_RESPONSE", failure: "SCHEMA_VALIDATION_FAILED" },
      }),
      messageForPrivateOpportunityError({
        code: "AI_RESPONSE_INVALID",
        providerDiagnostic: { category: "INVALID_RESPONSE", failure: "INVALID_JSON" },
      }),
      messageForPrivateOpportunityError({
        code: "AI_RESPONSE_INVALID",
        providerDiagnostic: { category: "INVALID_RESPONSE", failure: "EMPTY_TEXT" },
      }),
    ];

    expect(new Set(messages).size).toBe(2);
    expect(messages.every((message) => message.startsWith("Hasil analisis"))).toBe(true);
  });

  it("distinguishes unsupported number, financial, and business-metric claims without exposing provider text", () => {
    const rejectedRules = ["UNSUPPORTED_NUMBER", "UNSUPPORTED_FINANCIAL_CLAIM", "UNSUPPORTED_METRIC_CLAIM", "INVALID_EVIDENCE_GAP_REFERENCE"] as const;
    const messages = rejectedRules.map((rejectedRule) => messageForPrivateOpportunityError({
      code: "AI_RESPONSE_INVALID",
      providerDiagnostic: {
        category: "CONTENT_POLICY_REJECTED",
        failure: "MODEL_OUTPUT_REJECTED",
        rejectedRule,
      },
    }));

    expect(new Set(messages).size).toBe(1);
    expect(messages.every((message) => message.startsWith("Hasil analisis"))).toBe(true);
    expect(messages.join(" ")).not.toContain("MODEL_OUTPUT_REJECTED");
    expect(messages.join(" ")).not.toContain("rejectedRule");
    expect(messages[3]).toBe("Hasil analisis belum cukup didukung data. Coba lagi.");
  });

  it("distinguishes local timeout, upstream timeout, client abort, and generic provider failures", () => {
    expect(messageForPrivateOpportunityError({ code: "AI_RESPONSE_INVALID", providerDiagnostic: null }))
      .toBe("Hasil analisis tidak valid. Coba lagi.");
    expect(messageForPrivateOpportunityError({
      code: "AI_UPSTREAM_UNAVAILABLE",
      providerDiagnostic: { category: "TIMEOUT" },
    })).toBe("Analisis belum selesai. Coba lagi.");
    expect(messageForPrivateOpportunityError({
      code: "AI_UPSTREAM_UNAVAILABLE",
      providerDiagnostic: { category: "UPSTREAM_TIMEOUT" },
    })).toBe("Analisis belum selesai. Coba lagi.");
    expect(messageForPrivateOpportunityError({
      code: "AI_UPSTREAM_UNAVAILABLE",
      providerDiagnostic: { category: "CLIENT_ABORTED" },
    })).toBe("Analisis dibatalkan.");
    expect(messageForPrivateOpportunityError({ code: "AI_UPSTREAM_UNAVAILABLE", providerDiagnostic: null }))
      .toBe("Analisis belum selesai. Coba lagi.");
  });

  it.each([
    { outboundAttempted: false, responseHeadersReceivedAfterMs: null, expected: "sebelum permintaan dikirim" },
    { outboundAttempted: true, responseHeadersReceivedAfterMs: null, expected: "belum mengirim header respons" },
    { outboundAttempted: true, responseHeadersReceivedAfterMs: 2000, expected: "mulai merespons" },
  ])("uses measured timeout milestones: $expected", ({ expected, ...milestones }) => {
    expect(messageForPrivateOpportunityError({
      code: "AI_UPSTREAM_UNAVAILABLE",
      providerDiagnostic: { category: "TIMEOUT", ...milestones },
    })).toBe("Analisis belum selesai. Coba lagi.");
    expect(messageForPrivateOpportunityError({ code: "AI_UPSTREAM_UNAVAILABLE", providerDiagnostic: { category: "TIMEOUT", ...milestones } })).not.toContain(expected);
  });
});
