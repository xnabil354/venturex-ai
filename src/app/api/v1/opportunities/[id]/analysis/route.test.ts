import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generate: vi.fn(), getLatest: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/ai-analysis/service", () => ({
  AIAnalysisService: class {
    generate(...args: unknown[]) { return mocks.generate(...args); }
    getLatest(...args: unknown[]) { return mocks.getLatest(...args); }
  },
}));

import {
  AIAnalysisAccessContextError,
  AIAnalysisContextChangedError,
  AIAnalysisInsufficientDataError,
  AIAnalysisProfileIncompleteError,
  AIAnalysisProviderFailureError,
  AIAnalysisProviderUnavailableError,
  AIAnalysisRateLimitedError,
  AIAnalysisResourceNotFoundError,
  AIAnalysisResponseInvalidError,
  AIAnalysisUnauthenticatedError,
} from "@/ai-analysis/domain";
import { GET as latestGET } from "./latest/route";
import { POST } from "./route";

const opportunityId = "60000000-0000-4000-8000-000000000001";
const data = {
  analysisId: "b0000000-0000-4000-8000-000000000001",
  summary: "Ringkasan yang tervalidasi.",
  whyRelevant: "Relevansi berdasarkan profil.",
  targetConsumer: "Segmen untuk diwawancarai.",
  competition: "Kompetisi belum diverifikasi.",
  potential: "Hipotesis yang perlu diuji.",
  risks: ["Bukti terbatas."],
  nextAction: "Lakukan wawancara awal.",
  generatedAt: "2026-10-11T10:00:00.000Z",
  provider: "provider",
  model: "model",
  limitedEvidence: true,
};

function postRequest(body = "{}") {
  return new Request("http://localhost/api/v1/opportunities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("AI Opportunity Analysis API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generate.mockResolvedValue(data);
    mocks.getLatest.mockResolvedValue(null);
  });

  it("accepts an empty request and passes only the optional refresh flag", async () => {
    const response = await POST(postRequest(""), { params: Promise.resolve({ id: opportunityId }) });
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(data);
    expect(mocks.generate).toHaveBeenCalledWith(opportunityId, { forceRefresh: false });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("passes forceRefresh but rejects client-supplied authoritative context", async () => {
    const response = await POST(postRequest(JSON.stringify({ forceRefresh: true })), { params: Promise.resolve({ id: opportunityId }) });
    expect(response.status).toBe(200);
    expect(mocks.generate).toHaveBeenCalledWith(opportunityId, { forceRefresh: true });

    const invalid = await POST(postRequest(JSON.stringify({ profile: { budget: 1 }, evidence: [] })), { params: Promise.resolve({ id: opportunityId }) });
    expect(invalid.status).toBe(400);
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });

  it("maps authentication, profile, resource, throttle, provider, and validation failures", async () => {
    const cases: readonly [Error, number, string][] = [
      [new AIAnalysisUnauthenticatedError(), 401, "UNAUTHORIZED"],
      [new AIAnalysisAccessContextError(), 422, "PROFILE_INCOMPLETE"],
      [new AIAnalysisProfileIncompleteError(), 422, "PROFILE_INCOMPLETE"],
      [new AIAnalysisInsufficientDataError(), 422, "INSUFFICIENT_DATA"],
      [new AIAnalysisResourceNotFoundError(), 404, "RESOURCE_NOT_FOUND"],
      [new AIAnalysisRateLimitedError(42), 429, "RATE_LIMITED"],
      [new AIAnalysisResponseInvalidError(), 502, "AI_RESPONSE_INVALID"],
      [new AIAnalysisProviderUnavailableError(), 503, "AI_SERVICE_UNAVAILABLE"],
      [new AIAnalysisProviderFailureError(), 503, "AI_SERVICE_UNAVAILABLE"],
      [new AIAnalysisContextChangedError(), 409, "ANALYSIS_CONTEXT_CHANGED"],
    ];
    for (const [error, status, code] of cases) {
      mocks.generate.mockRejectedValueOnce(error);
      const response = await POST(postRequest(), { params: Promise.resolve({ id: opportunityId }) });
      const payload = await response.json();
      expect(response.status).toBe(status);
      expect(payload.error.code).toBe(code);
      expect(JSON.stringify(payload)).not.toContain("provider response");
      if (status === 429) expect(response.headers.get("Retry-After")).toBe("42");
    }
  });

  it("rejects invalid path IDs and malformed body without calling the service", async () => {
    const invalidId = await POST(postRequest(), { params: Promise.resolve({ id: "not-a-uuid" }) });
    const invalidBody = await POST(postRequest("{"), { params: Promise.resolve({ id: opportunityId }) });
    expect(invalidId.status).toBe(404);
    expect(invalidBody.status).toBe(400);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("returns the latest valid current analysis or a 200 null state", async () => {
    const empty = await latestGET(new Request("http://localhost"), { params: Promise.resolve({ id: opportunityId }) });
    expect(empty.status).toBe(200);
    expect((await empty.json()).data).toBeNull();

    mocks.getLatest.mockResolvedValueOnce(data);
    const available = await latestGET(new Request("http://localhost"), { params: Promise.resolve({ id: opportunityId }) });
    expect(available.status).toBe(200);
    expect((await available.json()).data).toEqual(data);
    expect(mocks.getLatest).toHaveBeenCalledWith(opportunityId);
  });
});
