import { it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { privateEntrepreneurFixture } from "@/opportunity/test-fixtures/private-entrepreneur";
const mocks = vi.hoisted(() => ({ find: vi.fn() }));
vi.mock("@/auth/current-user", () => ({ getCurrentUser: async () => ({ id: "owner", userType: "ENTREPRENEUR", onboardingStatus: "COMPLETED" }) }));
vi.mock("@/opportunity/private-hypothesis-repository", () => ({ PrivateOpportunityHypothesisRepository: class { findForEntrepreneur = mocks.find; } }));
vi.mock("@/components/opportunities/private-comparison-recovery", () => ({ PrivateComparisonRecovery: () => null }));
vi.mock("@/components/opportunities/private-comparison", () => ({ PrivateComparison: () => null }));
import Page from "./page";
it.each([0, 1, 2])("recovers with %i available items without revealing absent owners", async count => {
  const first = privateEntrepreneurFixture(); const second = { ...first, id: "90000000-0000-4000-8000-000000000022" };
  mocks.find.mockImplementation(async (_owner: string, id: string) => [first, second].slice(0, count).find(x => x.id === id) ?? null);
  const result = await Page({ searchParams: Promise.resolve({ ids: `${first.id},${second.id}`, from: "finder" }) });
  const [recovery, comparison] = result.props.children;
  expect(recovery.props.removedIds).toHaveLength(2 - count);
  expect(comparison.props.items).toHaveLength(count);
  expect(comparison.props.from).toBe("finder");
  expect(mocks.find).toHaveBeenCalledWith("owner", first.id);
});
