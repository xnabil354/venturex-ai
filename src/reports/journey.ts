import { createHash } from "node:crypto";
import { hasVerifiedBusinessConcept } from "@/opportunity/business-analysis-contract";
import type { OpportunityPersona, PrivateOpportunityIdeaDto } from "@/opportunity/private-hypothesis";

export function journeyPlan(item: PrivateOpportunityIdeaDto, role: OpportunityPersona) {
  return role === "ENTREPRENEUR" ? item.hypothesis.startupRoadmap : item.hypothesis.growthRoadmap;
}
export function journeyFingerprint(item: PrivateOpportunityIdeaDto, role: OpportunityPersona): string | null {
  const plan = journeyPlan(item, role);
  return plan ? roadmapFingerprint(plan) : null;
}
export function roadmapFingerprint(plan: unknown): string {
  function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b, "en")).map(([key, nested]) => [key, canonical(nested)]));
    return value;
  }
  return createHash("sha256").update(JSON.stringify(canonical(plan))).digest("hex");
}
export function journeyReady(item: PrivateOpportunityIdeaDto, role: OpportunityPersona): boolean {
  const plan = journeyPlan(item, role);
  const analysis = role === "ENTREPRENEUR" ? item.hypothesis.analysis : item.hypothesis.businessAnalysis;
  return Boolean(item.saved && plan && analysis?.requirements && analysis.opportunity.score !== null && analysis.fit.score !== null && plan.sourceFingerprint === analysis.inputFingerprint && (role === "ENTREPRENEUR" || hasVerifiedBusinessConcept(item.hypothesis.businessAnalysis)));
}
export type JourneyProgress = {
  fingerprint: string;
  steps: { stage: number; title: string; completedAt: string | null }[];
  ready: boolean;
  complete: boolean;
};
export function progressState(item: PrivateOpportunityIdeaDto, role: OpportunityPersona, rows: readonly { stage: number; completed_at: Date | string }[]): JourneyProgress | null {
  const plan = journeyPlan(item, role), fingerprint = journeyFingerprint(item, role);
  if (!plan || !fingerprint) return null;
  const ready = journeyReady(item, role);
  const steps = plan.steps.map((step, i) => ({ stage: i + 1, title: step.stage, completedAt: rows.find(row => row.stage === i + 1)?.completed_at ? new Date(rows.find(row => row.stage === i + 1)!.completed_at).toISOString() : null }));
  return { fingerprint, steps, ready, complete: ready && steps.every(step => step.completedAt !== null) };
}
