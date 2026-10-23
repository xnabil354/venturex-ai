import "server-only";

import { isSyntheticDemoEnabled } from "@/ai-analysis/synthetic-demo/access";
import { createBrightDataDemoSourcePreview } from "@/ai-analysis/synthetic-demo/source-preview";
import { createBrightDataDemoSourcePreviewPOST } from "@/ai-analysis/synthetic-demo/source-preview-route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const post = createBrightDataDemoSourcePreviewPOST({
  env: process.env,
  loadPreview: () => createBrightDataDemoSourcePreview({ env: process.env }),
});

export async function POST(request: Request): Promise<Response> {
  if (!isSyntheticDemoEnabled(process.env)) {
    return Response.json({ error: "DEMO_UNAVAILABLE" }, {
      status: 404,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  }
  return post(request);
}
