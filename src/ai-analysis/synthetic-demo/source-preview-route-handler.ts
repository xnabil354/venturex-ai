import { isSyntheticDemoPostAllowed, type SyntheticDemoEnvironment } from "./access";
import { brightDataDemoSourcePreviewSchema, type BrightDataDemoSourcePreview } from "./source-preview-contract";

function json(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export function createBrightDataDemoSourcePreviewPOST(dependencies: {
  readonly env: SyntheticDemoEnvironment;
  readonly loadPreview: () => Promise<BrightDataDemoSourcePreview>;
}) {
  return async function POST(request: Request): Promise<Response> {
    if (!isSyntheticDemoPostAllowed(request, dependencies.env)) {
      return json({ error: "DEMO_UNAVAILABLE" }, 404);
    }

    try {
      const preview = brightDataDemoSourcePreviewSchema.parse(await dependencies.loadPreview());
      return json({ data: preview }, 200);
    } catch {
      return json({ error: "SOURCE_PREVIEW_UNAVAILABLE" }, 503);
    }
  };
}
