import { describe, expect, it } from "vitest";
import { privateBusinessFixture } from "@/opportunity/test-fixtures/private-business";
import { privateEntrepreneurFixture } from "@/opportunity/test-fixtures/private-entrepreneur";
import { generatePrivateGrowthRoadmap } from "@/roadmap/private-growth-generator";
import { generatePrivateStartupRoadmap } from "@/roadmap/private-startup-generator";
import { journeyFingerprint, journeyReady, progressState, roadmapFingerprint } from "./journey";

describe("explicit roadmap completion gate", () => {
  it("ignores PostgreSQL JSONB key ordering but preserves stage ordering", () => {
    expect(roadmapFingerprint({ action: "a", nested: { b: 1, a: 2 }, steps: [1,2] })).toBe(roadmapFingerprint({ steps: [1,2], nested: { a: 2, b: 1 }, action: "a" }));
    expect(roadmapFingerprint({ steps: [1,2] })).not.toBe(roadmapFingerprint({ steps: [2,1] }));
  });
  for (const role of ["ENTREPRENEUR", "UMKM_EXISTING"] as const) {
    it(`${role}: a generated roadmap never implies completion; every stage must be marked`, () => {
      const item = role === "ENTREPRENEUR" ? privateEntrepreneurFixture() : privateBusinessFixture();
      if (role === "ENTREPRENEUR") item.hypothesis.startupRoadmap = generatePrivateStartupRoadmap(item);
      else item.hypothesis.growthRoadmap = generatePrivateGrowthRoadmap(item);
      expect(journeyReady(item, role)).toBe(true);
      expect(progressState(item, role, [])?.complete).toBe(false);
      const rows = Array.from({ length: role === "ENTREPRENEUR" ? 6 : 5 }, (_, i) => ({ stage: i + 1, completed_at: new Date() }));
      expect(progressState(item, role, rows.slice(1))?.complete).toBe(false);
      expect(progressState(item, role, rows)?.complete).toBe(true);
      item.saved = false;
      expect(progressState(item, role, rows)?.complete).toBe(false);
    });
  }
  it("rejects stale analysis and legacy unverified business concepts", () => {
    const item = privateBusinessFixture(); item.hypothesis.growthRoadmap = generatePrivateGrowthRoadmap(item);
    const fingerprint = journeyFingerprint(item, "UMKM_EXISTING");
    item.hypothesis.growthRoadmap.steps[0]!.action += " Catat hasil.";
    expect(journeyFingerprint(item, "UMKM_EXISTING")).not.toBe(fingerprint);
    delete item.hypothesis.businessAnalysis.conceptAlignmentVersion;
    expect(journeyReady(item, "UMKM_EXISTING")).toBe(false);
    item.hypothesis.businessAnalysis.conceptAlignmentVersion = "business-concept-alignment-v1";
    item.hypothesis.businessAnalysis.inputFingerprint = "c".repeat(64);
    expect(journeyReady(item, "UMKM_EXISTING")).toBe(false);
  });
});
