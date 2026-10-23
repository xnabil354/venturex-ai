import { describe, expect, it } from "vitest";
import { calculateBusinessDecision } from "./business-decision-score";
import { businessRequirements as requirements, businessSelections as selections } from "../opportunity/test-fixtures/private-business";
const input = { selections, requirements, proposedPrice: null, trend: null, competitors: null, fallbackInterest: null };
describe("Existing business decision policy", () => {
  it("uses business factors and explicitly renormalizes available weights", () => {
    const result = calculateBusinessDecision(input);
    expect(result.fit.score).toBe(100); expect(result.fit.coverage).toBe(70);
    expect(result.fit.factors.map(f => f.key)).toEqual(["productFit", "customerFit", "channelFit", "priceFit"]);
    expect(result.fit.factors[3]?.value).toBeNull(); expect(result.risk.level).toBe("UNKNOWN");
  });
  it("does not promote a perfect Top index or zero competitors into a complete opportunity score", () => {
    const result = calculateBusinessDecision({ ...input, requirements: null, fallbackInterest: 100, competitors: { query: "Test", city: "Jakarta", retrievedAt: "2026-10-22T00:00:00.000Z", sampleCount: 0, places: [] } });
    expect(result.opportunity.score).toBeNull(); expect(result.opportunity.coverage).toBe(20); expect(result.fit.score).toBeNull();
  });
  it("treats proposed price as a separate confirmed estimate and counts conflicts", () => {
    const result = calculateBusinessDecision({ ...input, proposedPrice: { min: 90000, max: 100000 }, requirements: { ...requirements, customerSegmentIds: ["other"] } });
    expect(result.fit.factors.find(f => f.key === "priceFit")?.value).toBe(0); expect(result.risk.level).toBe("HIGH");
    const low = calculateBusinessDecision({ ...input, proposedPrice: { min: 20000, max: 20000 } });
    expect(low.fit.score).toBe(100); expect(low.risk.level).toBe("LOW");
    expect(low.risk.reasons.join(" ")).toContain("belum");
  });
});
