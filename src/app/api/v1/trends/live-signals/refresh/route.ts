import "server-only";

import { getCurrentUser } from "@/auth/current-user";
import { getLiveTrendSignalsService } from "@/trend/live-signals";
import { createLiveTrendSignalsRefreshPOST } from "@/trend/live-signals-route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const post = createLiveTrendSignalsRefreshPOST({
  resolveUser: getCurrentUser,
  service: getLiveTrendSignalsService(),
});

export async function POST(request: Request): Promise<Response> {
  return post(request);
}
