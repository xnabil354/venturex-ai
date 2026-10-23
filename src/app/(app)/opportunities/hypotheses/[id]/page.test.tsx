import { describe, it, expect, vi } from "vitest";
import { privateEntrepreneurFixture } from "@/opportunity/test-fixtures/private-entrepreneur";
const mocks = vi.hoisted(() => ({ context: vi.fn(() => { throw new Error("PROFILE_UNAVAILABLE"); }), find: vi.fn() }));
vi.mock("@/auth/current-user", () => ({ getCurrentUser: async () => ({ id: "owner", userType: "ENTREPRENEUR", onboardingStatus: "COMPLETED" }) }));
vi.mock("@/opportunity/private-hypothesis-repository", () => ({ PrivateOpportunityHypothesisRepository: class { findForEntrepreneur = mocks.find; } }));
vi.mock("@/opportunity/entrepreneur-analysis-service", () => ({ loadEntrepreneurAnalysisContext: mocks.context, isEntrepreneurAnalysisFresh: vi.fn() }));
vi.mock("@/components/opportunities/private-hypothesis-score-detail", () => ({ PrivateHypothesisScoreDetail: () => null }));
import Page from "./page";
describe("permanent archive reads", () => {
  it("opens saved analyses without loading current profile or reference data", async () => {
    const item = privateEntrepreneurFixture(); mocks.find.mockResolvedValue(item);
    const result = await Page({ params: Promise.resolve({ id: item.id }) });
    expect(result.props.item).toEqual(item);
    expect(mocks.context).not.toHaveBeenCalled();
  });
});
