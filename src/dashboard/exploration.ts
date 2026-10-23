import "server-only";

import type { SafeUser } from "@/auth/user-types";
import { PrivateOpportunityHypothesisRepository } from "@/opportunity/private-hypothesis-repository";
import type { PrivateOpportunityIdeaDto } from "@/opportunity/private-hypothesis";
import type { DashboardModules, DashboardTrendModuleState } from "./dto";
import { normalizeRadarProduct, radarContext, radarMetric } from "./radar-preview";

type ExplorationDependencies = {
  readonly listIdeas: (userId: string, savedOnly?: boolean) => Promise<readonly PrivateOpportunityIdeaDto[]>;
  readonly listRoadmaps: () => Promise<{ readonly totalCount: number }>;
};

export async function loadDashboardExploration(
  user: SafeUser,
  productQuery: string,
  dependencies?: ExplorationDependencies,
): Promise<DashboardModules> {
  const listIdeas = dependencies?.listIdeas ?? ((userId: string, savedOnly = false) => new PrivateOpportunityHypothesisRepository().listForUser(userId, savedOnly));
  const listRoadmaps = dependencies?.listRoadmaps ?? (async () => user.userType === "ENTREPRENEUR"
    ? { totalCount: (await new PrivateOpportunityHypothesisRepository().listPageForUser(user.id, 1, true, true)).items.length }
    : { totalCount: (await new PrivateOpportunityHypothesisRepository().listBusinessPage(user.id, 1, false, true)).items.length });
  const [ideasResult, savedResult, roadmapsResult] = await Promise.allSettled([
    Promise.resolve().then(() => listIdeas(user.id)),
    Promise.resolve().then(() => listIdeas(user.id, true)),
    Promise.resolve().then(listRoadmaps),
  ]);
  const ideas = ideasResult.status === "fulfilled"
    ? [...ideasResult.value].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt) || a.id.localeCompare(b.id))
    : [];
  const toPreview = (item: PrivateOpportunityIdeaDto, saved = false) => ({
    id: item.id,
    name: item.hypothesis.title,
    categoryName: "Ide awal · perlu dicoba",
    summary: item.hypothesis.concept,
    relatedTrendTitle: item.source.transport === "SearchApi.io" ? item.source.query : item.source.title,
    generatedAt: item.generatedAt,
    href: `${saved ? "/saved" : "/opportunities"}#hypothesis-${item.id}`,
  });
  const saved = savedResult.status === "fulfilled" ? [...savedResult.value].filter(item => item.saved).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt) || a.id.localeCompare(b.id)) : [];
  const sources = ideas.flatMap(item => item.source.transport === "SearchApi.io" && normalizeRadarProduct(item.source.productQuery) === normalizeRadarProduct(productQuery) ? [item.source] : [])
    .sort((a, b) => b.retrievedAt.localeCompare(a.retrievedAt));
  const latest = sources[0];
  const seen = new Set<string>();
  const trendPreview = sources.filter(source => {
    if (!latest || source.geo !== latest.geo || source.period !== latest.period || source.searchProperty !== latest.searchProperty || source.retrievedAt !== latest.retrievedAt) return false;
    const key = `${source.sourceType}:${source.query}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3).map(source => ({
    id: `${source.sourceType}:${source.query}`,
    title: source.query,
    categoryName: source.sourceType === "RELATED_QUERY_RISING" ? "Makin populer" : "Kueri populer",
    summary: radarMetric(source, source.sourceType === "RELATED_QUERY_RISING"),
    href: "/trends",
  }));
  const trends: DashboardTrendModuleState = {
    status: trendPreview.length ? "AVAILABLE" : ideasResult.status === "rejected" ? "ERROR" : "EMPTY",
    preview: trendPreview,
    ...(latest ? {
      context: `Sinyal dari hipotesis terakhir · ${radarContext(latest.productQuery, latest.geo, latest.period, latest.searchProperty, latest.providerTime)}`,
      observedAt: latest.retrievedAt,
    } : {}),
  };
  return {
    trends,
    opportunities: { status: ideasResult.status === "rejected" ? "ERROR" : ideas.length ? "AVAILABLE" : "EMPTY", preview: ideas.slice(0, 3).map(item => toPreview(item)) },
    savedOpportunities: { status: savedResult.status === "rejected" ? "ERROR" : saved.length ? "AVAILABLE" : "EMPTY", preview: saved.slice(0, 3).map(item => toPreview(item, true)) },
    roadmap: { status: roadmapsResult.status === "rejected" ? "ERROR" : roadmapsResult.value.totalCount ? "AVAILABLE" : "EMPTY" },
  };
}
