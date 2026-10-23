import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  generateForUser: vi.fn(),
  listForUser: vi.fn(),
  setSavedForUser: vi.fn(),
  removeForUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/auth/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/ai-analysis/ninerouter", () => ({ NINEROUTER_ALLOW_PUBLIC_HTTP_DEV_ONLY_FLAG: "NINEROUTER_ALLOW_PUBLIC_HTTP_DEV_ONLY" }));
vi.mock("@/opportunity/private-hypothesis-service", () => ({
  PrivateOpportunityError: class extends Error {
    constructor(readonly code: string) { super(code); }
  },
  PrivateOpportunityHypothesisService: class {
    generateForUser(...args: unknown[]) { return mocks.generateForUser(...args); }
    listForUser(...args: unknown[]) { return mocks.listForUser(...args); }
    setSavedForUser(...args: unknown[]) { return mocks.setSavedForUser(...args); }
    removeForUser(...args: unknown[]) { return mocks.removeForUser(...args); }
  },
}));
vi.mock("@/opportunity/private-opportunity-error-message", () => ({ messageForPrivateOpportunityError: () => "Request failed." }));

import { DELETE, POST, PATCH } from "./route";
import { PrivateHypothesisStateError } from "@/opportunity/private-hypothesis-repository";

const currentUser = { id: "80000000-0000-4000-8000-000000000011", userType: "UMKM_EXISTING" };
const requestBody = {
  sourceToken: `v1.${"x".repeat(100)}`,
  consent: true,
  disclosureVersion: "searchapi-google-trends-v1",
};
const hypothesisId = "90000000-0000-4000-8000-000000000021";

function postRequest(): Request {
  return new Request("http://localhost/api/v1/opportunities/ideas", {
    method: "POST",
    headers: {
      origin: "http://localhost",
      host: "localhost",
      "content-type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });
}

function deleteRequest(body: unknown = { id: hypothesisId }, origin = "http://localhost"): Request {
  return new Request("http://localhost/api/v1/opportunities/ideas", {
    method: "DELETE",
    headers: {
      origin,
      host: "localhost",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("Opportunity Finder route response compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue(currentUser);
  });

  it("returns validated hypothesis items in the existing data envelope", async () => {
    const items = [{ id: "90000000-0000-4000-8000-000000000001", hypothesis: { title: "Uji menu" } }];
    mocks.generateForUser.mockResolvedValue({ outcome: "HYPOTHESES", items });

    const response = await POST(postRequest());
    const payload = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({ data: items, outcome: "HYPOTHESES" });
    expect(payload.requestId).toEqual(expect.any(String));
    expect(mocks.generateForUser).toHaveBeenCalledWith(currentUser, requestBody, expect.any(AbortSignal));
  });

  it("returns an empty data list for insufficient evidence without changing the response envelope", async () => {
    mocks.generateForUser.mockResolvedValue({
      outcome: "INSUFFICIENT_EVIDENCE",
      reason: "Kueri terlalu umum untuk mendukung hipotesis yang dapat diuji.",
      limitations: ["Minat penelusuran bukan bukti transaksi."],
    });

    const response = await POST(postRequest());
    const payload = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      data: [],
      outcome: "INSUFFICIENT_EVIDENCE",
      reason: "Kueri terlalu umum untuk mendukung hipotesis yang dapat diuji.",
      limitations: ["Minat penelusuran bukan bukti transaksi."],
    });
    expect(mocks.generateForUser).toHaveBeenCalledOnce();
  });

  it("deletes an owner's private hypothesis and returns no content", async () => {
    const response = await DELETE(deleteRequest());

    expect(response.status).toBe(204);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("X-Request-Id")).toBeTruthy();
    expect(mocks.removeForUser).toHaveBeenCalledWith(currentUser, hypothesisId);
  });

  it("rejects malformed delete requests before reaching the service", async () => {
    const response = await DELETE(deleteRequest({ id: "not-a-uuid", extra: true }));
    const payload = await response.json() as { error?: { code?: string } };

    expect(response.status).toBe(400);
    expect(payload.error?.code).toBe("INVALID_REQUEST");
    expect(mocks.removeForUser).not.toHaveBeenCalled();
  });

  it("rejects cross-origin delete requests", async () => {
    const response = await DELETE(deleteRequest({ id: hypothesisId }, "https://attacker.example"));

    expect(response.status).toBe(403);
    expect(mocks.removeForUser).not.toHaveBeenCalled();
  });

  it("passes the reviewed snapshot identity to the save service", async () => {
    mocks.setSavedForUser.mockResolvedValue({ id: hypothesisId, saved: true });
    const body = { id: hypothesisId, saved: true, reviewed: true, analysisFingerprint: "a".repeat(64) };
    const response = await PATCH(new Request(deleteRequest(body), { method: "PATCH" }));
    expect(response.status).toBe(200);
    expect(mocks.setSavedForUser).toHaveBeenCalledWith(currentUser, hypothesisId, true, true, body.analysisFingerprint);
  });

  it("returns conflict when deleting a permanent saved opportunity", async () => {
    mocks.removeForUser.mockRejectedValueOnce(new PrivateHypothesisStateError("SAVED_PERMANENT"));
    const response = await DELETE(deleteRequest());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "SAVED_PERMANENT" } });
  });

  it("rejects a malformed snapshot fingerprint before saving", async () => {
    const response = await PATCH(new Request(deleteRequest({ id: hypothesisId, saved: true, reviewed: true, analysisFingerprint: "wrong" }), { method: "PATCH" }));
    expect(response.status).toBe(400);
    expect(mocks.setSavedForUser).not.toHaveBeenCalled();
  });
});
