import "server-only";

import { isSyntheticDemoEnabled } from "@/ai-analysis/synthetic-demo/access";
import { createConfiguredSyntheticDemoProvider } from "@/ai-analysis/synthetic-demo/provider-factory";
import { createSyntheticDemoPOST } from "@/ai-analysis/synthetic-demo/route-handler";
import { SyntheticDemoService } from "@/ai-analysis/synthetic-demo/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const service = new SyntheticDemoService({ provider: createConfiguredSyntheticDemoProvider(process.env) });
const post = createSyntheticDemoPOST({ env: process.env, service });

export async function POST(request: Request): Promise<Response> {
  if (!isSyntheticDemoEnabled(process.env)) {
    return Response.json({ error: "DEMO_UNAVAILABLE" }, {
      status: 404,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  }
  return post(request);
}
