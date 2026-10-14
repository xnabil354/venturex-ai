import { describe, expect, it, vi } from "vitest";

import { createBrightDataDemoSourcePreviewPOST } from "./source-preview-route-handler";
import { SYNTHETIC_DEMO_ENABLE_FLAG, SYNTHETIC_DEMO_LAUNCHER_FLAG, SYNTHETIC_DEMO_PORT_FLAG } from "./access";
import { BRIGHTDATA_DEMO_SOURCE_CONTEXT } from "./source-preview-contract";

const env = {
  NODE_ENV: "development",
  [SYNTHETIC_DEMO_ENABLE_FLAG]: "true",
  [SYNTHETIC_DEMO_LAUNCHER_FLAG]: "127.0.0.1",
  [SYNTHETIC_DEMO_PORT_FLAG]: "3016",
} as const;

function request(origin = "http://127.0.0.1:3016") {
  return new Request("http://127.0.0.1:3016/api/local/trend-source-preview", {
    method: "POST",
    headers: { host: "127.0.0.1:3016", origin },
  });
}

describe("local Bright Data preview route handler", () => {
  it("loads preview only for an allowed same-origin local POST and disables caching", async () => {
    const loadPreview = vi.fn().mockResolvedValue({
      ...BRIGHTDATA_DEMO_SOURCE_CONTEXT,
      mode: "NOT_EXECUTED",
      attempted: false,
      reason: "LIVE_REQUEST_DISABLED",
    });
    const post = createBrightDataDemoSourcePreviewPOST({ env, loadPreview });

    const response = await post(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({ data: { mode: "NOT_EXECUTED", attempted: false } });
    expect(loadPreview).toHaveBeenCalledTimes(1);
  });

  it("rejects cross-origin requests before invoking the preview service", async () => {
    const loadPreview = vi.fn();
    const post = createBrightDataDemoSourcePreviewPOST({ env, loadPreview });

    const response = await post(request("http://example.test"));
    expect(response.status).toBe(404);
    expect(loadPreview).not.toHaveBeenCalled();
  });

  it("keeps the local route unavailable when the demo guard is off", async () => {
    const loadPreview = vi.fn();
    const post = createBrightDataDemoSourcePreviewPOST({
      env: { ...env, [SYNTHETIC_DEMO_ENABLE_FLAG]: "false" },
      loadPreview,
    });

    expect((await post(request())).status).toBe(404);
    expect(loadPreview).not.toHaveBeenCalled();
  });

  it("does not expose unexpected service errors", async () => {
    const loadPreview = vi.fn().mockRejectedValue(new Error("secret provider response"));
    const post = createBrightDataDemoSourcePreviewPOST({ env, loadPreview });

    const response = await post(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "SOURCE_PREVIEW_UNAVAILABLE" });
  });
});
