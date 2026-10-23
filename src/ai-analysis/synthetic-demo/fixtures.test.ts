import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { SYNTHETIC_DEMO_FIXTURES, getSyntheticDemoFixture } from "./fixtures";

describe("synthetic AI demo fixture registry", () => {
  it("contains exactly the two approved fixed synthetic personas", () => {
    expect(Object.keys(SYNTHETIC_DEMO_FIXTURES).sort()).toEqual(["DEMO_ENTREPRENEUR", "DEMO_UMKM"]);
    expect(SYNTHETIC_DEMO_FIXTURES.DEMO_ENTREPRENEUR.userType).toBe("ENTREPRENEUR");
    expect(SYNTHETIC_DEMO_FIXTURES.DEMO_UMKM.userType).toBe("UMKM_EXISTING");
    expect(SYNTHETIC_DEMO_FIXTURES.DEMO_ENTREPRENEUR.fixtureVersion).toBe("synthetic-fixture-v1");
    expect(SYNTHETIC_DEMO_FIXTURES.DEMO_UMKM.fixtureVersion).toBe("synthetic-fixture-v1");
  });

  it("has a deterministic content hash and no available scores or evidence", () => {
    const entrepreneur = getSyntheticDemoFixture("DEMO_ENTREPRENEUR");
    const umkm = getSyntheticDemoFixture("DEMO_UMKM");
    expect(getSyntheticDemoFixture("DEMO_ENTREPRENEUR").fixtureContentHash).toBe(entrepreneur.fixtureContentHash);
    expect(entrepreneur.fixtureContentHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(entrepreneur.fixtureContentHash).not.toBe(umkm.fixtureContentHash);
    for (const fixture of [entrepreneur, umkm]) {
      expect(fixture.evidence.records).toEqual([]);
      expect(fixture.decisionSupport.opportunityScore.status).toBe("UNAVAILABLE");
      expect(fixture.decisionSupport.fitScore.status).toBe("UNAVAILABLE");
      expect(fixture.decisionSupport.riskAssessment.status).toBe("UNAVAILABLE");
      expect(fixture.limitations.length).toBeGreaterThan(0);
      expect(Object.isFrozen(fixture.profile)).toBe(true);
      expect(Object.isFrozen(fixture.mockAnalysis.risks)).toBe(true);
      expect(JSON.stringify(fixture)).not.toMatch(/api[_-]?key|authorization|gemini live response/iu);
    }
  });
});
