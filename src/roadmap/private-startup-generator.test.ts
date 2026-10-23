import { describe, expect, it } from "vitest";
import { privateEntrepreneurFixture } from "@/opportunity/test-fixtures/private-entrepreneur";
import { generatePrivateStartupRoadmap } from "./private-startup-generator";
import { ROADMAP_STAGES } from "./domain";
import { privateStartupRoadmapSchema } from "./private-startup-contract";

describe("private Startup Roadmap", () => {
  it("uses archived context for six ordered stages without changing the analysis", () => {
    const item = privateEntrepreneurFixture();
    const before = JSON.stringify(item);
    const result = generatePrivateStartupRoadmap(item, new Date("2026-10-21T02:00:00Z"));
    expect(result.steps.map(step => step.stage)).toEqual(ROADMAP_STAGES);
    expect(result.sourceFingerprint).toBe(item.hypothesis.analysis!.inputFingerprint);
    expect(result.steps[2]?.action).toContain("500.000");
    expect(JSON.stringify(item)).toBe(before);
    const reversed = { ...result, steps: [...result.steps].reverse() };
    expect(privateStartupRoadmapSchema.safeParse(reversed).success).toBe(false);
  });
  it("rejects unreviewed or insufficient hypotheses", () => {
    const item = privateEntrepreneurFixture(); item.saved = false;
    expect(() => generatePrivateStartupRoadmap(item)).toThrow("ANALYSIS_REQUIRED");
    item.saved = true; item.hypothesis.analysis!.fit.score = null;
    expect(() => generatePrivateStartupRoadmap(item)).toThrow("ANALYSIS_REQUIRED");
  });
  it("bounds maximum-sized context and never substitutes missing capital", () => {
    const item = privateEntrepreneurFixture();
    item.hypothesis.analysis!.capitalMin = null;
    item.hypothesis.analysis!.targetConsumer = "a".repeat(500);
    item.hypothesis.analysis!.requirements!.initialNeeds = ["a".repeat(500), "b".repeat(500)];
    expect(generatePrivateStartupRoadmap(item).steps).toHaveLength(6);
    expect(generatePrivateStartupRoadmap(item).steps[2]?.action).not.toContain("Rp");
  });
});

it("adapts actions to archived mismatches and missing evidence", () => {
  const item = privateEntrepreneurFixture();
  const a = item.hypothesis.analysis!;
  a.fit.factors.forEach(f => { if (["channelFit", "experienceFit", "timeFit"].includes(f.key)) f.value = 0; });
  a.requirements!.salesChannelIds = ["90000000-0000-4000-8000-000000000099"];
  a.opportunity.factors[0]!.value = null;
  const steps = generatePrivateStartupRoadmap(item).steps;
  expect(steps[0]!.action).toContain("Lengkapi histori");
  expect(steps[1]!.action).toContain("Sampel lokal belum memadai");
  expect(steps[2]!.action).toContain("pendamping");
  expect(steps[3]!.action).toContain("belum cocok");
  expect(steps[3]!.action).toContain("Batasi jadwal");
  expect(steps[5]!.action).toContain("belum diketahui");
});

it("handles sparse history, unknown requirements and archived time capacity", () => {
  const item = privateEntrepreneurFixture(); const a = item.hypothesis.analysis!;
  a.trend = { query: "bakso", geo: "ID", period: "1y", retrievedAt: a.generatedAt, count: 5, observedMonths: 2, spanDays: 30, recentMean: 50, previousMean: null, positiveFraction: 1, coefficientOfVariation: 0 };
  a.requirements!.requiredExperience = null; a.requirements!.requiredTime = null;
  a.fit.factors.forEach(f => { if (["experienceFit", "channelFit", "timeFit"].includes(f.key)) f.value = null; });
  a.planningContext = { timeCommitment: "LIMITED" };
  const steps = generatePrivateStartupRoadmap(item).steps;
  expect(steps[0]!.action).toContain("Histori belum cukup");
  expect(steps[2]!.action).toContain("Konfirmasi kebutuhan pengalaman");
  expect(steps[3]!.action).toContain("Kecocokan kanal belum diketahui");
  expect(steps[3]!.action).toContain("Konfirmasi kebutuhan waktu");
  expect(steps.every(s => s.timeline.includes("Waktu terbatas"))).toBe(true);
});
it("prioritizes weighted impact and validates maximal context for every capacity", () => {
  const item = privateEntrepreneurFixture(); const a = item.hypothesis.analysis!;
  a.opportunity.factors.forEach(f => f.value = 100); a.fit.factors.forEach(f => f.value = 100);
  a.fit.factors.find(f => f.key === "budgetFit")!.value = 40;
  a.fit.factors.find(f => f.key === "experienceFit")!.value = 0;
  expect(generatePrivateStartupRoadmap(item).steps[4]!.action).toContain("budgetFit dan experienceFit");
  item.hypothesis.title = "a".repeat(140); a.targetConsumer = "b".repeat(500);
  a.requirements!.initialNeeds = ["c".repeat(500)];
  a.referenceLabels = { category: null, channels: ["d".repeat(500)] };
  a.fit.factors.forEach(f => f.value = 0); a.opportunity.factors.forEach(f => f.value = 0);
  for (const timeCommitment of ["LIMITED", "PART_TIME", "FULL_TIME", null] as const) {
    a.planningContext = { timeCommitment };
    expect(privateStartupRoadmapSchema.safeParse(generatePrivateStartupRoadmap(item)).success).toBe(true);
  }
});
