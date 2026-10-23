import "server-only";

import { getCurrentUser } from "@/auth/current-user";
import { getTrendRadarService } from "@/trend/trend-radar-service";
import { createTrendRadarRelatedQueriesPOST } from "@/trend/trend-radar-route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

const post = createTrendRadarRelatedQueriesPOST({
  resolveUser: getCurrentUser,
  service: getTrendRadarService(),
});

export async function POST(request: Request): Promise<Response> {
  return post(request);
}
