import { describe, expect, it } from "vitest";
import { generatePrivateGrowthRoadmap } from "./private-growth-generator";
import { privateBusinessFixture } from "../opportunity/test-fixtures/private-business";
describe("private Growth Roadmap", () => {
  it("rejects legacy unreviewed requirements even when scores are complete", () => {
    const item = privateBusinessFixture(); delete item.hypothesis.businessAnalysis.conceptAlignmentVersion;
    expect(() => generatePrivateGrowthRoadmap(item)).toThrow("ANALYSIS_REQUIRED");
  });
  it("creates five bounded stages tied to a business analysis without changing it", () => {
    const item = privateBusinessFixture(), before = JSON.stringify(item);
    const plan = generatePrivateGrowthRoadmap(item);
    expect(plan.steps.map(s => s.stage)).toEqual(["Customer Validation", "Product Prototype", "Limited Test Selling", "Margin / Feedback Review", "Rollout / Revise / Stop"]);
    expect(plan.sourceFingerprint).toBe(item.hypothesis.businessAnalysis.inputFingerprint);
    expect(JSON.stringify(item)).toBe(before); expect(plan.steps[3]?.action).toContain("biaya aktual");
  });
  it("rejects unsaved or incomplete analysis instead of inventing data", () => {
    const item = privateBusinessFixture();
    expect(() => generatePrivateGrowthRoadmap({ ...item, saved: false })).toThrow("ANALYSIS_REQUIRED");
    item.hypothesis.businessAnalysis.fit.score = null;
    expect(() => generatePrivateGrowthRoadmap(item)).toThrow("ANALYSIS_REQUIRED");
  });
});
