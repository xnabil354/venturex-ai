import { expect, test } from "@playwright/test";

import { syntheticDemoResultSchema } from "../src/ai-analysis/synthetic-demo/contracts";

const apiPath = "/api/local/synthetic-ai-demo";

test("one explicit DEMO_UMKM action renders genuine LIVE_SYNTHETIC 9Router analysis", async ({ page, baseURL }) => {
  let browserPostAttempts = 0;
  let requestPayloadFixtureOnly = false;
  const externalBrowserRequests: string[] = [];
  let httpStatus: number | null = null;
  let requestId: string | null = null;
  let providerError: string | null = null;
  let diagnosticCategory: string | null = null;
  let responseDiagnostic: { failure: string; jsonRootType?: string; issueCount?: number; issues?: { path: string; code: string }[] } | null = null;
  let outboundAttempted: boolean | null = null;
  let schemaValid = false;
  let mode: string | null = null;
  let provider: string | null = null;
  let model: string | null = null;
  let analysisFieldCount = 0;

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname !== "127.0.0.1") externalBrowserRequests.push(url.hostname);
    if (url.pathname === apiPath && request.method() === "POST") {
      browserPostAttempts += 1;
      try {
        requestPayloadFixtureOnly = JSON.stringify(request.postDataJSON()) === JSON.stringify({ fixtureId: "DEMO_UMKM" });
      } catch {
        requestPayloadFixtureOnly = false;
      }
    }
  });

  try {
    await page.goto("/local-demo/ai-analysis");
    await expect(page.getByRole("heading", { name: "Analisis Peluang AI" })).toBeVisible();
    await page.getByRole("radio", { name: /Pelaku UMKM/ }).check();

    const responsePromise = page.waitForResponse(
      (response) => new URL(response.url()).pathname === apiPath && response.request().method() === "POST",
      { timeout: 40_000 },
    );
    await page.getByRole("button", { name: "Tampilkan contoh analisis" }).click();
    const response = await responsePromise;
    httpStatus = response.status();
    requestId = response.headers()["x-request-id"] ?? null;
    const body: unknown = await response.json().catch(() => null);
    const data = typeof body === "object" && body !== null && "data" in body ? body.data : null;
    const parsed = syntheticDemoResultSchema.safeParse(data);
    const execution = parsed.success ? parsed.data.execution : null;
    schemaValid = parsed.success;
    mode = execution?.mode ?? null;
    provider = execution?.provider ?? null;
    model = execution?.model ?? null;
    analysisFieldCount = parsed.success ? Object.keys(parsed.data.analysis).length : 0;
    providerError = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
      ? body.error
      : null;
    if (typeof body === "object" && body !== null && "diagnostic" in body && typeof body.diagnostic === "object" && body.diagnostic !== null) {
      const diagnostic = body.diagnostic;
      diagnosticCategory = "category" in diagnostic && typeof diagnostic.category === "string" ? diagnostic.category : null;
      outboundAttempted = "outboundAttempted" in diagnostic && typeof diagnostic.outboundAttempted === "boolean"
        ? diagnostic.outboundAttempted
        : null;
      if ("response" in diagnostic && typeof diagnostic.response === "object" && diagnostic.response !== null) {
        const response = diagnostic.response;
        const failure = "failure" in response && typeof response.failure === "string" ? response.failure : null;
        const jsonRootType = "jsonRootType" in response && typeof response.jsonRootType === "string" ? response.jsonRootType : undefined;
        const issueCount = "issueCount" in response && typeof response.issueCount === "number" ? response.issueCount : undefined;
        const issues = "issues" in response && Array.isArray(response.issues)
          ? response.issues.flatMap((issue) => {
            if (typeof issue !== "object" || issue === null) return [];
            const path = "path" in issue && typeof issue.path === "string" ? issue.path : null;
            const code = "code" in issue && typeof issue.code === "string" ? issue.code : null;
            return path && code ? [{ path, code }] : [];
          }).slice(0, 8)
          : undefined;
        if (failure) responseDiagnostic = { failure, ...(jsonRootType ? { jsonRootType } : {}), ...(issueCount !== undefined ? { issueCount } : {}), ...(issues ? { issues } : {}) };
      }
    }
    if (parsed.success) outboundAttempted = true;

    expect(browserPostAttempts).toBe(1);
    expect(requestPayloadFixtureOnly).toBe(true);
    expect(externalBrowserRequests).toEqual([]);
    expect(response.status()).toBe(200);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.fixtureId).toBe("DEMO_UMKM");
    expect(parsed.data.execution).toMatchObject({
      mode: "LIVE_SYNTHETIC",
      provider: "ninerouter",
      model: "cx/gpt-6-luna-xhigh",
    });
    expect(Object.keys(parsed.data.analysis).sort()).toEqual([
      "competition",
      "nextAction",
      "potential",
      "risks",
      "summary",
      "targetConsumer",
      "whyRelevant",
    ]);

    const result = page.locator("article");
    const analysisSection = result.locator("section").filter({ hasText: "Analisis contoh" });
    await expect(result.getByText(/REAL_NINEROUTER.*LIVE_SYNTHETIC.*ninerouter.*cx\/gpt-6-luna-xhigh.*fixture sintetis\./)).toBeVisible();
    await expect(result.getByRole("heading", { name: /Pelaku UMKM/ })).toBeVisible();
    await expect(result.getByText("Eksplorasi varian minuman teh", { exact: true })).toBeVisible();

    for (const label of ["Ringkasan", "Mengapa relevan", "Target konsumen", "Persaingan", "Potensi", "Langkah berikutnya"]) {
      await expect(analysisSection.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(analysisSection.getByRole("heading", { name: "Risiko dan batasan" })).toBeVisible();
    await expect(analysisSection.locator("dl > div")).toHaveCount(6);
    await expect(analysisSection.locator("h4").locator("..").locator("li").first()).toBeVisible();
    await expect(result.getByText("Opportunity Score: tidak tersedia", { exact: false })).toBeVisible();
    await expect(result.getByText("Fit Score: tidak tersedia", { exact: false })).toBeVisible();
    await expect(result.getByText("Risk Indicator: tidak tersedia", { exact: false })).toBeVisible();
    await expect(result.getByText("Evidence pasar", { exact: true })).toBeVisible();
    await expect(result.getByText("Tidak ada evidence pasar yang disetujui atau diberikan ke analisis ini.", { exact: true })).toBeVisible();
    expect(baseURL).toMatch(/^http:\/\/127\.0\.0\.1:/u);
  } finally {
    console.info(JSON.stringify({
      event: "ninerouter_live_synthetic_browser_result",
      browserPostAttempts,
      requestPayloadFixtureOnly,
      providerRequestAllowance: 1,
      httpStatus,
      requestId,
      providerError,
      diagnosticCategory,
      responseDiagnostic,
      outboundAttempted,
      schemaValid,
      mode,
      provider,
      model,
      analysisFieldCount,
    }));
  }
});
