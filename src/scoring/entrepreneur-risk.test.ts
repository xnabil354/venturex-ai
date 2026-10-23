import { describe, expect, it } from "vitest";
import { privateEntrepreneurFixture } from "@/opportunity/test-fixtures/private-entrepreneur";
import { assessEntrepreneurRisk } from "./entrepreneur-risk";

describe("entrepreneur preparation risk", () => {
  it("requires complete coverage before assigning low risk", () => {
    const analysis = privateEntrepreneurFixture().hypothesis.analysis!;
    expect(assessEntrepreneurRisk(analysis)).toMatchObject({ level: "LOW", coverage: 100 });
    analysis.fit.factors.find(f => f.key === "timeFit")!.value = null;
    expect(assessEntrepreneurRisk(analysis).level).toBeNull();
  });
  it("uses pressure boundaries and explains high risk", () => {
    const analysis = privateEntrepreneurFixture().hypothesis.analysis!;
    for (const value of [70, 40, 0]) {
      for (const factor of [...analysis.opportunity.factors, ...analysis.fit.factors]) factor.value = value;
      expect(assessEntrepreneurRisk(analysis).level).toBe(value === 70 ? "MEDIUM" : "HIGH");
      expect(assessEntrepreneurRisk(analysis).reasons.length).toBeGreaterThan(0);
    }
  });
  it("does not infer safety from missing budget or missing market evidence", () => {
    const analysis = privateEntrepreneurFixture().hypothesis.analysis!;
    analysis.fit.factors.find(f => f.key === "budgetFit")!.value = null;
    expect(assessEntrepreneurRisk(analysis).level).toBeNull();
  });
});
