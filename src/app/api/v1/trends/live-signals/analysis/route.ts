import "server-only";

import { getCurrentUser } from "@/auth/current-user";
import { getLiveTrendSignalsService } from "@/trend/live-signals";
import { createLiveTrendSignalsAnalysisPOST } from "@/trend/live-signals-route-handler";
import { TrendSignalAnalysisError, TrendSignalAnalysisService, readTrendSignalNineRouterConfig } from "@/ai-analysis/trend-signal-analysis";
import { NineRouterTrendSignalAnalysisProvider } from "@/ai-analysis/trend-signal-ninerouter-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const service = new TrendSignalAnalysisService({
  resolveSignal: (userId, snapshotId, signalId) => getLiveTrendSignalsService().resolve(userId, snapshotId, signalId),
  providerFactory: (env) => {
    const config = readTrendSignalNineRouterConfig(env);
    if (!config) throw new TrendSignalAnalysisError("AI_SERVICE_UNAVAILABLE");
    return new NineRouterTrendSignalAnalysisProvider(config);
  },
});

const post = createLiveTrendSignalsAnalysisPOST({
  resolveUser: getCurrentUser,
  service,
});

export async function POST(request: Request): Promise<Response> {
  return post(request);
}
