import { expect, test } from "@playwright/test";
import type { SyntheticDemoFixtureId, SyntheticDemoResult } from "../src/ai-analysis/synthetic-demo/contracts";

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
    if (hostname.includes("googleapis.com")) providerRequests.push(hostname);
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
