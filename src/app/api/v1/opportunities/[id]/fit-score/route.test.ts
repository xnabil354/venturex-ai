import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  calculateForOpportunity: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../../../../auth/current-user", () => ({ getCurrentUser: vi.fn() }));
vi.mock("../../../../../../scoring/fit-score-service", () => ({
  FitScoreService: class {
    calculateForOpportunity = mocks.calculateForOpportunity;
  },
}));

import {
  OpportunityFitInputContextAccessContextError,
  OpportunityFitInputContextEligibilityError,
  OpportunityFitInputContextUnauthenticatedError,
} from "../../../../../../opportunity/fit-input-context-service";
import type { FitScoreMvpResult } from "../../../../../../scoring/fit-score-mvp";
import { GET } from "./route";

const OPPORTUNITY_ID = "60000000-0000-4000-8000-000000000001";
const USER_ID = "10000000-0000-4000-8000-000000000001";
const PRIVATE_PROFILE_VALUE = "private-profile-value";

const availableResult: FitScoreMvpResult = {
  label: "MVP Heuristic Fit Score",
  policyVersion: "FIT_MVP_HEURISTIC_V1",
  modelType: "ENTREPRENEUR_FIT",
  confidence: null,
  status: "AVAILABLE",
  score: 80,
  activeComponents: [
    {
      component: "budgetFit",
      interpretation: "Budget affordability compares persisted budgetMax with Opportunity capitalMin.",
      normalizedValue: 100,
      weight: 0.4,
      weightedContribution: 40,
      signal: {
        status: "NORMALIZED",
        fitComponent: "budgetFit",
        value: 100,
        signal: {
          component: "budgetAffordability",
          status: "OBSERVED",
          relation: "BUDGET_SUFFICIENT",
          reason: "BUDGET_AFFORDABILITY_COMPARISON",
          budgetMax: PRIVATE_PROFILE_VALUE,
          capitalMin: "50",
        },
      },
    },
  ],
  excludedComponents: ["locationFit", "experienceFit", "timeFit"],
  disclaimer: "Fit Score menunjukkan kesesuaian berdasarkan profil dan kriteria terbatas yang tersedia, bukan jaminan keberhasilan bisnis.",
  missingComponents: [],
};

function routeContext(id = OPPORTUNITY_ID) {
  return { params: Promise.resolve({ id }) };
}

async function responseFor(result: FitScoreMvpResult | null) {
  mocks.calculateForOpportunity.mockResolvedValue(result);
  return GET(new Request(`http://localhost/api/v1/opportunities/${OPPORTUNITY_ID}/fit-score`), routeContext());
}

afterEach(() => vi.clearAllMocks());

describe("GET /api/v1/opportunities/{id}/fit-score", () => {
  it.each([
    ["ENTREPRENEUR", "ENTREPRENEUR_FIT"],
    ["UMKM_EXISTING", "BUSINESS_FIT"],
  ])("returns a private AVAILABLE DTO for %s", async (_userType, modelType) => {
    mocks.calculateForOpportunity.mockResolvedValue({ ...availableResult, modelType });

    const response = await GET(
      new Request(`http://localhost/api/v1/opportunities/${OPPORTUNITY_ID}/fit-score`),
      routeContext(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toMatchObject({
      success: true,
      data: {
        fitScore: {
          status: "AVAILABLE",
          value: 80,
          modelType,
          policyVersion: "FIT_MVP_HEURISTIC_V1",
          confidence: null,
          label: "MVP Heuristic Fit Score",
          disclaimer: expect.any(String),
          breakdown: [{
            component: "budgetFit",
            value: 100,
            weightedContribution: 40,
          }],
        },
      },
      requestId: expect.stringMatching(/^req_/),
    });
    expect(body.data.fitScore.breakdown[0]).not.toHaveProperty("weight");
    expect(JSON.stringify(body)).not.toContain(PRIVATE_PROFILE_VALUE);
    expect(JSON.stringify(body)).not.toContain(USER_ID);
    expect(body.data.fitScore).not.toHaveProperty("profile");
    expect(body.data).not.toHaveProperty("analysisId");
    expect(body.data).not.toHaveProperty("generatedAt");
    expect(body.data).not.toHaveProperty("opportunityScore");
    expect(body.data).not.toHaveProperty("risk");
    expect(mocks.calculateForOpportunity).toHaveBeenCalledWith(OPPORTUNITY_ID);
  });

  it("returns INSUFFICIENT_DATA as a successful response with no numeric value", async () => {
    const insufficient: FitScoreMvpResult = {
      ...availableResult,
      status: "INSUFFICIENT_DATA",
      score: null,
      activeComponents: [],
      missingComponents: ["budgetFit", "interestFit", "channelFit"],
      reason: "ACTIVE_COMPONENTS_UNAVAILABLE",
    };

    const response = await responseFor(insufficient);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.fitScore).toMatchObject({
      status: "INSUFFICIENT_DATA",
      value: null,
      policyVersion: "FIT_MVP_HEURISTIC_V1",
      confidence: null,
      missingComponents: ["budgetFit", "interestFit", "channelFit"],
      reason: "ACTIVE_COMPONENTS_UNAVAILABLE",
    });
  });

  it("returns 400 for invalid UUID without invoking the service", async () => {
    const response = await GET(
      new Request("http://localhost/api/v1/opportunities/not-a-uuid/fit-score"),
      routeContext("not-a-uuid"),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    expect(mocks.calculateForOpportunity).not.toHaveBeenCalled();
  });

  it("returns 401 when the upstream authenticated context rejects an anonymous request", async () => {
    mocks.calculateForOpportunity.mockRejectedValue(new OpportunityFitInputContextUnauthenticatedError());

    const response = await GET(new Request("http://localhost"), routeContext());

    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("maps incomplete onboarding/profile context to 422 PROFILE_INCOMPLETE", async () => {
    mocks.calculateForOpportunity.mockRejectedValue(new OpportunityFitInputContextAccessContextError());

    const response = await GET(new Request("http://localhost"), routeContext());

    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("PROFILE_INCOMPLETE");
  });

  it("returns the same 404 for missing and ineligible Opportunities", async () => {
    const missing = await responseFor(null);
    expect(missing.status).toBe(404);
    expect((await missing.json()).error.code).toBe("RESOURCE_NOT_FOUND");

    mocks.calculateForOpportunity.mockRejectedValue(new OpportunityFitInputContextEligibilityError());
    const ineligible = await GET(new Request("http://localhost"), routeContext());
    expect(ineligible.status).toBe(404);
    expect((await ineligible.json()).error.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("sanitizes unexpected service failures and never reports a score", async () => {
    mocks.calculateForOpportunity.mockRejectedValue(new Error("secret database detail"));

    const response = await GET(new Request("http://localhost"), routeContext());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toMatchObject({ code: "INTERNAL_ERROR", message: "Terjadi kesalahan pada server." });
    expect(JSON.stringify(body)).not.toContain("secret database detail");
    expect(body).not.toHaveProperty("data");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("exposes no persistence or mutation dependency at the route boundary", async () => {
    await responseFor(availableResult);

    expect(mocks.calculateForOpportunity).toHaveBeenCalledTimes(1);
    expect(Object.keys(mocks)).toEqual(["calculateForOpportunity"]);
  });
});
