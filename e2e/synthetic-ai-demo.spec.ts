import { expect, test } from "@playwright/test";
import type { SyntheticDemoFixtureId, SyntheticDemoResult } from "../src/ai-analysis/synthetic-demo/contracts";
import { BRIGHTDATA_DEMO_SOURCE_CONTEXT } from "../src/ai-analysis/synthetic-demo/source-preview-contract";

const MOCK_TEST_EXECUTION = {
  mode: "MOCK",
  provider: "local-mock",
  model: "synthetic-fixture-v1",
  displayLabel: "Contoh hasil simulasi — bukan respons 9Router live",
} as const;

function syntheticStubResult(fixtureId: SyntheticDemoFixtureId): { data: SyntheticDemoResult } {
  const entrepreneur = fixtureId === "DEMO_ENTREPRENEUR";
  const personaLabel = entrepreneur
    ? "Calon pengusaha — profil sintetis"
    : "Pelaku UMKM — profil sintetis";
  const profileSummary = entrepreneur
    ? "Profil sintetis untuk calon pengusaha."
    : "Profil sintetis untuk usaha minuman fiktif.";
  const opportunityName = entrepreneur
    ? "Konsep simulasi pengusaha"
    : "Varian simulasi UMKM";
  const prefix = entrepreneur ? "ENTREPRENEUR" : "UMKM";

  return {
    data: {
      fixtureId,
      fixtureVersion: "synthetic-fixture-v1",
      fixtureContentHash: entrepreneur ? "a".repeat(64) : "b".repeat(64),
      personaLabel,
      profile: { summary: profileSummary },
      opportunity: {
        name: opportunityName,
        description: `Hipotesis browser sintetis khusus ${prefix}.`,
        hypothesisLabel: "Hipotesis simulasi",
      },
      evidence: {
        status: "UNAVAILABLE",
        records: [],
        reason: "Stub browser tidak memuat evidence pasar.",
      },
      decisionSupport: {
        opportunityScore: { status: "UNAVAILABLE", reason: "Skor tidak dihitung di demo." },
        fitScore: { status: "UNAVAILABLE", reason: "Fit tidak dihitung di demo." },
        riskAssessment: { status: "UNAVAILABLE", reason: "Risk tidak dihitung di demo." },
      },
      limitations: ["Respons ini adalah TEST DATA sintetis, bukan output 9Router."],
      analysis: {
        summary: `Ringkasan sintetis ${prefix}.`,
        whyRelevant: `Relevansi simulasi ${prefix}.`,
        targetConsumer: `Target simulasi ${prefix}.`,
        competition: `Kompetisi ${prefix} tidak tersedia.`,
        potential: `Potensi ${prefix} belum dinilai.`,
        risks: [`Risiko sintetis ${prefix}.`],
        nextAction: `Langkah sintetis ${prefix}.`,
      },
      evidenceReferences: [],
      execution: MOCK_TEST_EXECUTION,
    },
  };
}

function mockSourcePreview() {
  return {
    ...BRIGHTDATA_DEMO_SOURCE_CONTEXT,
    mode: "MOCK_VERIFIED" as const,
    attempted: false as const,
    notice: "TEST DATA sintetis; bukan respons Bright Data.",
    retrievedAt: "2026-10-14T10:30:00.000Z",
    response: {
      httpStatus: 200,
      contentType: "application/json",
      responseBytes: 256,
      rootType: "array",
      arrayLength: 1,
      firstRecordFields: [{ name: "query", type: "string" }, { name: "volume", type: "number" }],
    },
    completeness: "PARTIAL" as const,
    records: {
      total: 1,
      accepted: 1,
      rejected: 0,
      screenedGroups: 1,
      classifications: { LIKELY_FNB: 1, REVIEW_REQUIRED: 0, OUT_OF_SCOPE: 0 },
      relatedQueries: { available: 0, unavailable: 1, invalid: 0, uninspectable: 0 },
      candidates: [{
        title: "contoh uji sintetis teh tarik",
        classification: "LIKELY_FNB",
        observationCount: 1,
        active: true,
        startedAtUnixSeconds: 1_760_435_400,
        volume: 1200,
        volumeChange: "+300%",
        categoriesCount: 1,
        relatedQueries: { availability: "UNAVAILABLE", count: null },
        displayTruncated: false,
      }],
      omittedCandidates: 0,
    },
  };
}

async function choosePersonaAndGenerate(page: import("@playwright/test").Page, fixtureId: SyntheticDemoFixtureId) {
  const name = fixtureId === "DEMO_ENTREPRENEUR" ? /Calon pengusaha/ : /Pelaku UMKM/;
  await page.getByRole("radio", { name }).check();
  await page.getByRole("button", { name: "Tampilkan contoh analisis" }).click();
}

test("synthetic demo is visibly local and produces the entrepreneur fixture", async ({ page, baseURL }) => {
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname !== "127.0.0.1") externalRequests.push(url.hostname);
  });

  await page.goto("/local-demo/ai-analysis");
  await expect(page.getByRole("heading", { name: "Analisis Peluang AI" })).toBeVisible();
  await expect(page.getByText("Analisis demo — profil sintetis")).toBeVisible();
  await page.getByRole("radio", { name: /Calon pengusaha/ }).check();
  await page.getByRole("button", { name: "Tampilkan contoh analisis" }).click();
  await expect(page.getByText("Contoh hasil simulasi — bukan respons 9Router live")).toBeVisible();
  await expect(page.getByText("Mode MOCK · tidak ada request ke 9Router.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Calon pengusaha — profil sintetis" })).toBeVisible();
  await page.getByText("Identitas fixture simulasi", { exact: true }).click();
  await expect(page.getByText("DEMO_ENTREPRENEUR", { exact: true })).toBeVisible();
  await expect(page.getByText("synthetic-fixture-v1", { exact: true })).toBeVisible();
  await expect(page.getByText("Opportunity Score: tidak tersedia", { exact: false })).toBeVisible();
  await expect(page.getByText("Evidence pasar", { exact: true })).toBeVisible();
  expect(externalRequests).toEqual([]);
  expect(baseURL).toContain("127.0.0.1");
});

test("synthetic demo produces a separate UMKM fixture without live AI", async ({ page }) => {
  const providerRequests: string[] = [];
  page.on("request", (request) => {
    const hostname = new URL(request.url()).hostname;
    if (hostname.includes("googleapis.com") || hostname.includes("brightdata.com")) providerRequests.push(hostname);
  });

  await page.goto("/local-demo/ai-analysis");
  await page.getByRole("radio", { name: /Pelaku UMKM/ }).check();
  await page.getByRole("button", { name: "Tampilkan contoh analisis" }).click();
  await expect(page.getByText("Contoh hasil simulasi — bukan respons 9Router live")).toBeVisible();
  await expect(page.getByText("Mode MOCK · tidak ada request ke 9Router.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pelaku UMKM — profil sintetis" })).toBeVisible();
  await expect(page.getByText("Tidak tersedia. Demo ini tidak memuat sumber pasar atau evidence eksternal.", { exact: true })).toBeVisible();
  expect(providerRequests).toEqual([]);
});

for (const fixtureId of ["DEMO_ENTREPRENEUR", "DEMO_UMKM"] as const) {
  test(`renders a server-stubbed MOCK result for ${fixtureId} without provider traffic`, async ({ page }) => {
    const providerRequests: string[] = [];
    page.on("request", (request) => {
      const hostname = new URL(request.url()).hostname;
      if (hostname !== "127.0.0.1") providerRequests.push(hostname);
    });
    await page.route("**/api/local/synthetic-ai-demo", async (route) => {
      expect(route.request().postDataJSON()).toEqual({ fixtureId });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(syntheticStubResult(fixtureId)),
      });
    });

    await page.goto("/local-demo/ai-analysis");
    await choosePersonaAndGenerate(page, fixtureId);

    const result = page.locator("article");
    await expect(result.getByText(MOCK_TEST_EXECUTION.displayLabel, { exact: true })).toBeVisible();
    await expect(result.getByText(/Mode MOCK/)).toBeVisible();
    await expect(result.getByText(/Mode LIVE_SYNTHETIC/)).toHaveCount(0);
    await expect(result.getByRole("heading", {
      name: fixtureId === "DEMO_ENTREPRENEUR" ? "Calon pengusaha — profil sintetis" : "Pelaku UMKM — profil sintetis",
    })).toBeVisible();
    await expect(result.getByRole("heading", { name: fixtureId === "DEMO_ENTREPRENEUR" ? "Konsep simulasi pengusaha" : "Varian simulasi UMKM" })).toBeVisible();

    for (const field of ["Ringkasan", "Mengapa relevan", "Target konsumen", "Persaingan", "Potensi", "Langkah berikutnya"]) {
      await expect(result.getByText(field, { exact: true })).toBeVisible();
    }
    await expect(result.getByRole("heading", { name: "Risiko dan batasan" })).toBeVisible();
    const persona = fixtureId === "DEMO_ENTREPRENEUR" ? "ENTREPRENEUR" : "UMKM";
    for (const value of [
      `Ringkasan sintetis ${persona}.`,
      `Relevansi simulasi ${persona}.`,
      `Target simulasi ${persona}.`,
      `Kompetisi ${persona} tidak tersedia.`,
      `Potensi ${persona} belum dinilai.`,
      `Risiko sintetis ${persona}.`,
      `Langkah sintetis ${persona}.`,
    ]) {
      await expect(result.getByText(value, { exact: true })).toBeVisible();
    }
    await expect(result.getByText("Tidak tersedia. Stub browser tidak memuat evidence pasar.", { exact: true })).toBeVisible();
    await expect(result.getByText("TEST DATA sintetis, bukan output 9Router", { exact: false })).toBeVisible();
    await expect(result.getByText("Opportunity Score: tidak tersedia", { exact: false })).toBeVisible();
    await expect(result.getByText("Fit Score: tidak tersedia", { exact: false })).toBeVisible();
    await expect(result.getByText("Risk Indicator: tidak tersedia", { exact: false })).toBeVisible();
    await expect(result.getByText("Evidence pasar", { exact: true })).toBeVisible();
    expect(providerRequests).toEqual([]);
  });
}

for (const fixtureId of ["DEMO_ENTREPRENEUR", "DEMO_UMKM"] as const) {
  test(`renders a clearly mocked source preview for ${fixtureId} without provider traffic`, async ({ page }) => {
    const providerRequests: string[] = [];
    let previewRequests = 0;
    page.on("request", (request) => {
      const hostname = new URL(request.url()).hostname;
      if (hostname !== "127.0.0.1") providerRequests.push(hostname);
    });
    await page.route("**/api/local/trend-source-preview", async (route) => {
      previewRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: mockSourcePreview() }),
      });
    });

    await page.goto("/local-demo/ai-analysis");
    await expect(page.getByText("Belum ada permintaan. Tidak ada panggilan provider otomatis saat halaman dibuka.")).toBeVisible();
    expect(previewRequests).toBe(0);
    const persona = fixtureId === "DEMO_ENTREPRENEUR" ? /Calon pengusaha/ : /Pelaku UMKM/;
    await page.getByRole("radio", { name: persona }).check();
    await page.getByRole("button", { name: "Periksa sumber sekali" }).click();
    const panel = page.getByTestId("brightdata-source-preview");
    await expect(panel.getByText(/MOCK_VERIFIED/)).toBeVisible();
    await expect(page.getByText("TEST DATA sintetis; bukan respons Bright Data.", { exact: true })).toBeVisible();
    await expect(page.getByText(/PARTIAL: 1 diterima, 0 ditolak dari 1 record/)).toBeVisible();
    await expect(page.getByText(/1 grup unik; 1 LIKELY_FNB, 0 perlu review, 0 di luar cakupan/)).toBeVisible();
    await expect(page.getByText(/Tersedia 0; tidak tersedia 1; invalid 0/)).toBeVisible();
    await expect(panel.getByText("contoh uji sintetis teh tarik", { exact: true })).toBeVisible();
    await expect(panel.getByText("1200", { exact: true })).toBeVisible();
    await expect(panel.getByText(/bukan Trend terpublikasi/)).toBeVisible();
    await expect(page.getByText("Hak dan batas tampilan", { exact: true })).toBeVisible();
    await expect(panel.getByText(/started_at \(UTC; bukan periode observasi\)/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Google Trends — Trending Now, Indonesia" })).toBeVisible();
    expect(previewRequests).toBe(1);
    expect(providerRequests).toEqual([]);
  });
}

test("default local launcher reports source preview as not executed and issues no provider request", async ({ page }) => {
  const providerRequests: string[] = [];
  let sourceRequests = 0;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "brightdata.com") providerRequests.push(url.hostname);
    if (url.pathname === "/api/local/trend-source-preview") sourceRequests += 1;
  });

  await page.goto("/local-demo/ai-analysis");
  await expect(page.getByText("Belum ada permintaan. Tidak ada panggilan provider otomatis saat halaman dibuka.")).toBeVisible();
  expect(sourceRequests).toBe(0);
  await page.getByRole("button", { name: "Periksa sumber sekali" }).click();
  const panel = page.getByTestId("brightdata-source-preview");
  await expect(panel.getByText(/NOT_EXECUTED/)).toBeVisible();
  await expect(panel.getByText(/LIVE_REQUEST_NOT_AUTHORIZED/)).toBeVisible();
  expect(sourceRequests).toBe(1);
  expect(providerRequests).toEqual([]);
});

test("source preview failure is sanitized and the page does not retry", async ({ page }) => {
  let sourceRequests = 0;
  await page.route("**/api/local/trend-source-preview", async (route) => {
    sourceRequests += 1;
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "SOURCE_PREVIEW_UNAVAILABLE", detail: "secret" }) });
  });

  await page.goto("/local-demo/ai-analysis");
  const button = page.getByRole("button", { name: "Periksa sumber sekali" });
  await button.click();
  await expect(page.getByTestId("synthetic-ai-demo").getByRole("alert")).toContainText("Status pratinjau sumber tidak dapat dimuat");
  await expect(page.getByRole("button", { name: "Satu permintaan sudah dimulai" })).toBeDisabled();
  await expect(page.getByText("secret", { exact: true })).toHaveCount(0);
  expect(sourceRequests).toBe(1);
});

test("invalid source preview metadata is not rendered", async ({ page }) => {
  await page.route("**/api/local/trend-source-preview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { mode: "LIVE_VERIFIED", secret: "must-not-render" } }),
    });
  });

  await page.goto("/local-demo/ai-analysis");
  await page.getByRole("button", { name: "Periksa sumber sekali" }).click();
  await expect(page.getByTestId("synthetic-ai-demo").getByRole("alert")).toContainText("Metadata pratinjau tidak valid");
  await expect(page.getByText("must-not-render", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("brightdata-source-preview")).toHaveCount(0);
});

test("keeps the loading state until the synthetic server stub resolves", async ({ page }) => {
  let releaseResponse: (() => void) | undefined;
  let signalRequest: (() => void) | undefined;
  const responseGate = new Promise<void>((resolve) => { releaseResponse = resolve; });
  const requestArrived = new Promise<void>((resolve) => { signalRequest = resolve; });
  await page.route("**/api/local/synthetic-ai-demo", async (route) => {
    signalRequest?.();
    await responseGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(syntheticStubResult("DEMO_UMKM")),
    });
  });

  await page.goto("/local-demo/ai-analysis");
  await choosePersonaAndGenerate(page, "DEMO_UMKM");
  try {
    await requestArrived;
    await expect(page.getByRole("status")).toContainText("Menyiapkan contoh simulasi");
  } finally {
    releaseResponse?.();
  }
  await expect(page.getByText(MOCK_TEST_EXECUTION.displayLabel, { exact: true })).toBeVisible();
});

test("shows a sanitized provider failure and no analysis result", async ({ page }) => {
  const providerRequests: string[] = [];
  page.on("request", (request) => {
    const hostname = new URL(request.url()).hostname;
    if (hostname !== "127.0.0.1") providerRequests.push(hostname);
  });
  await page.route("**/api/local/synthetic-ai-demo", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "DEMO_PROVIDER_UNAVAILABLE" }),
    });
  });

  await page.goto("/local-demo/ai-analysis");
  await choosePersonaAndGenerate(page, "DEMO_UMKM");
  const errorAlert = page.getByTestId("synthetic-ai-demo").getByRole("alert");
  await expect(errorAlert).toContainText("Simulasi gagal dimuat");
  await expect(errorAlert).toContainText("Mode provider tidak tersedia");
  await expect(page.locator("article")).toHaveCount(0);
  expect(providerRequests).toEqual([]);
});
