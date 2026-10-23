import type { PrivateOpportunityIdeaDto } from "@/opportunity/private-hypothesis";
import type { PrivateStartupRoadmap } from "./private-startup-contract";

export function conciseRoadmapText(text: string, limit: number, fallback: string): string {
  if (text.length <= limit) return text.replace(/[.!?]+$/u, "");
  const boundary = text.lastIndexOf(" ", limit - 1);
  return boundary > 0 ? `${text.slice(0, boundary).replace(/[;,.!?]+$/u, "")}\u2026` : fallback;
}

// Repair only a known generated display fragment; the saved roadmap stays unchanged.
export function startupRoadmapDisplayAction(item: PrivateOpportunityIdeaDto, step: PrivateStartupRoadmap["steps"][number]): string {
  const action = step.action.replace(" berdasarkan defisit berbobot;", ";");
  const roadmap = item.hypothesis.startupRoadmap;
  const needs = item.hypothesis.analysis?.requirements?.initialNeeds;
  if (!roadmap || !needs || ![undefined, "personalized-v2", "personalized-v3"].includes(roadmap.generatorVersion) || step.sequence !== 3) return action;
  const original = needs.slice(0, 2).join("; ");
  for (const limit of [70, 100, 220]) {
    const fragment = `Kebutuhan awal: ${original.slice(0, limit)}. `;
    if (action.includes(fragment)) return action.replace(fragment, "Gunakan rincian kebutuhan awal di bawah. ");
  }
  return action;
}
