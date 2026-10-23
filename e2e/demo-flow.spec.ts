import { randomBytes, randomUUID } from "node:crypto";
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";

const STARTUP_TREND = "E2E synthetic fixture Trend A (not market evidence)";
const GROWTH_TREND = "E2E synthetic fixture Trend B (not market evidence)";
const STARTUP_OPPORTUNITY = "E2E synthetic opportunity - Startup path";
const GROWTH_OPPORTUNITY = "E2E synthetic opportunity - Growth path";
const COMPARE_OPPORTUNITY = "E2E synthetic opportunity - Compare path";
const TEST_PASSWORD = `B10-${randomBytes(24).toString("base64url")}aA1!`;

type AccountType = "entrepreneur" | "umkm";

function uniqueEmail(label: string): string {
  return `batch10-${label}-${randomUUID()}@example.test`;
}

async function registerAndLogin(page: Page, email: string): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByLabel("Konfirmasi password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Buat akun", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?registered=1/u);
  await expect(page.getByRole("status")).toContainText("Akun berhasil dibuat");

  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/u);
  await expect(page.getByText("Apa tujuan Anda menggunakan VENTUREX?", { exact: true })).toBeVisible();
}

async function currentUserId(page: Page): Promise<string> {
  const userId = await page.evaluate(async () => {
    const response = await fetch("/api/v1/me", { cache: "no-store" });
    const payload = await response.json() as { success?: boolean; data?: { id?: string } };
    return response.ok && payload.success && typeof payload.data?.id === "string" ? payload.data.id : null;
  });
  if (!userId) throw new Error("Authenticated test session did not return its user identity.");
  return userId;
}

async function completeEntrepreneurProfile(page: Page, location: string): Promise<void> {
  await page.getByRole("radio", { name: /Saya ingin memulai bisnis F&B/u }).check();
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding\/entrepreneur/u);

  await page.getByLabel("Lokasi utama *", { exact: true }).fill(location);
  await page.getByRole("checkbox", { name: "Minuman", exact: true }).check();
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();

  await page.getByLabel("Budget minimum (Rupiah) *", { exact: true }).fill("5000000");
  await page.getByLabel("Budget maksimum (Rupiah) *", { exact: true }).fill("8000000");
  await page.getByRole("checkbox", { name: /Pelajar dan mahasiswa/u }).check();
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();

  await page.getByRole("checkbox", { name: "Gerai atau toko offline", exact: true }).check();
  await page.getByLabel("Pengalaman *", { exact: true }).selectOption({ label: "Baru memulai" });
  await page.getByLabel("Komitmen waktu *", { exact: true }).selectOption({ label: "Paruh waktu" });
  await page.getByRole("button", { name: "Simpan profil", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/u);
  await expect(page.getByRole("heading", { name: "Ringkasan profil", exact: true })).toBeVisible();
  await expect(page.getByText(location, { exact: true })).toBeVisible();
}

async function completeBusinessProfile(page: Page): Promise<void> {
  await page.getByRole("radio", { name: /Saya sudah memiliki bisnis F&B/u }).check();
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding\/business/u);

  await page.getByLabel("Nama bisnis *", { exact: true }).fill("Warung E2E Pagi");
  await page.getByLabel("Kategori bisnis *", { exact: true }).selectOption({ label: "Minuman" });
  await page.getByLabel("Lokasi bisnis *", { exact: true }).fill("Bandung E2E");
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();

  await page.getByLabel("Nama produk *", { exact: true }).fill("Minuman sintetis uji alur");
  await page.getByLabel("Harga (Rupiah)", { exact: true }).fill("25000");
  await page.getByLabel("Harga minimum (Rupiah) *", { exact: true }).fill("20000");
  await page.getByLabel("Harga maksimum (Rupiah) *", { exact: true }).fill("30000");
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();

  await page.getByRole("checkbox", { name: /Pelajar dan mahasiswa/u }).check();
  await page.getByRole("checkbox", { name: "Gerai atau toko offline", exact: true }).check();
  await page.getByRole("button", { name: "Simpan profil", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/u);
  await expect(page.getByRole("heading", { name: "Ringkasan bisnis", exact: true })).toBeVisible();
  await expect(page.getByText("Warung E2E Pagi", { exact: true })).toBeVisible();
  await expect(page.getByText("Bandung E2E", { exact: true })).toBeVisible();
}

async function chooseUserTypeAndProfile(page: Page, type: AccountType, location = "Jakarta Selatan E2E"): Promise<void> {
  if (type === "entrepreneur") {
    await completeEntrepreneurProfile(page, location);
  } else {
    await completeBusinessProfile(page);
  }
}

async function navigate(page: Page, label: string): Promise<void> {
  if ((page.viewportSize()?.width ?? 1365) < 768) {
    const menu = page.getByRole("button", { name: "Open navigation menu", exact: true });
    if (await menu.isVisible()) await menu.click();
    await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: label, exact: true }).click();
  } else {
    await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: label, exact: true }).click();
  }
}

async function verifyTrendSignalGate(page: Page): Promise<void> {
  const section = page.getByRole("region", { name: "Observasi Google Trends Indonesia", exact: true });
  const refreshButton = section.getByRole("button", { name: "Muat sinyal terbaru", exact: true });
  let refreshRequests = 0;
  const onRequest = (request: import("@playwright/test").Request) => {
    if (request.url().includes("/api/v1/trends/live-signals/refresh")) refreshRequests += 1;
  };
  page.on("request", onRequest);
  try {
    await expect(section).toBeVisible();
    await expect(refreshButton).toBeVisible();
    expect(refreshRequests).toBe(0);

    const responsePromise = page.waitForResponse((response) =>
      response.request().method() === "POST"
        && response.url().includes("/api/v1/trends/live-signals/refresh"),
    );
    await refreshButton.click();
    const response = await responsePromise;
    expect(response.status()).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "DISPLAY_RIGHTS_UNVERIFIED" },
    });
    await expect(section).toContainText("izin penggunaan output Bright Data dikonfirmasi");
    expect(refreshRequests).toBe(1);
  } finally {
    page.off("request", onRequest);
  }
}

async function expectNoHorizontalOverflow(locator: Locator): Promise<void> {
  const dimensions = await locator.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

async function openOpportunityFromTrend(page: Page, trendTitle: string, opportunityName: string): Promise<void> {
  await navigate(page, "Opportunity Finder");
  await expect(page.getByRole("heading", { name: "Opportunity Finder", exact: true })).toBeVisible();
  const finderNotice = page.getByRole("note", { name: "Status dan batasan hipotesis peluang", exact: true });
  await expect(finderNotice).toBeVisible();
  await expect(finderNotice).toContainText("Hipotesis Peluang — Perlu Validasi");
  await expect(finderNotice).toContainText("Sinyal pencarian historis 2025 menunjukkan minat pencarian");
  await expect(finderNotice).toContainText("bukan bukti permintaan pasar, pendapatan, atau keberhasilan usaha.");
  await expectNoHorizontalOverflow(finderNotice);
  const finderCard = page.getByRole("article").filter({
    has: page.getByRole("link", { name: `Lihat detail ${opportunityName}`, exact: true }),
  });
  await expect(finderCard).toBeVisible();
  const finderIndicators = finderCard.getByRole("region", { name: `Indikator untuk ${opportunityName}`, exact: true });
  await expect(finderIndicators).toContainText(/MVP Heuristic Fit Score|Data belum cukup untuk menghitung Fit Score/u);
  await expect(finderIndicators).not.toContainText("Fit Score belum dapat dimuat.");

  await navigate(page, "Trend Radar");
  await expect(page.getByRole("heading", { name: "Trend Radar", exact: true })).toBeVisible();
  await verifyTrendSignalGate(page);
  await page.getByRole("link", { name: trendTitle, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Peluang terkait", exact: true })).toBeVisible();
  await page.getByRole("link", { name: opportunityName, exact: true }).click();
  await expect(page.getByRole("heading", { name: opportunityName, exact: true })).toBeVisible();
}

async function verifyOpportunityAndAIFallback(page: Page): Promise<void> {
  const hypothesisNotice = page.getByRole("note", { name: "Status dan batasan hipotesis peluang", exact: true });
  await expect(hypothesisNotice).toBeVisible();
  await expect(hypothesisNotice).toContainText("Hipotesis Peluang — Perlu Validasi");
  await expect(hypothesisNotice).toContainText("bukan bukti permintaan pasar, pendapatan, atau keberhasilan usaha.");
  await expectNoHorizontalOverflow(hypothesisNotice);

  const scoreSection = page.getByRole("region", { name: "Score, Fit, dan Risk", exact: true });
  await expect(scoreSection).toBeVisible();
  await expect(scoreSection).toContainText("Opportunity Score");
  await expect(scoreSection).toContainText("Data belum cukup untuk menghitung skor secara layak.");
  await expect(scoreSection).toContainText("Fit Score");
  await expect(scoreSection).toContainText(/MVP Heuristic Fit Score|Data belum cukup untuk menghitung Fit Score/u);
  await expect(scoreSection).not.toContainText("Fit Score belum dapat dimuat.");
  await expect(scoreSection).toContainText("Risiko belum dapat dinilai berdasarkan data dan kebijakan yang tersedia.");

  const evidence = page.getByRole("region", { name: "Evidence", exact: true });
  await expect(evidence).toBeVisible();
  await expect(evidence).toContainText("Synthetic E2E fixture (not market evidence)");
  await expect(evidence).toContainText("Synthetic local test data only; no real source or market claim.");

  const aiSection = page.getByRole("region", { name: "AI Analysis", exact: true });
  await expect(aiSection.getByText("Analisis belum dibuat. Pembuatan hanya dimulai saat Anda memilih tombol di bawah.", { exact: true })).toBeVisible();
  const opportunityId = new URL(page.url()).pathname.split("/").at(-1);
  if (!opportunityId) throw new Error("Opportunity detail route did not include an identifier.");
  const consent = aiSection.getByRole("checkbox");
  const generateButton = aiSection.getByRole("button", { name: "Generate AI Analysis", exact: true });
  await expect(consent).toBeVisible();
  await expect(generateButton).toBeDisabled();
  await consent.check();
  await expect(generateButton).toBeEnabled();
  const fallbackResponse = page.waitForResponse((response) =>
    response.request().method() === "POST"
      && response.url().includes(`/api/v1/opportunities/${opportunityId}/analysis`),
  );
  await generateButton.click();
  const response = await fallbackResponse;
  expect(response.status()).toBe(503);
  expect(await response.json()).toMatchObject({ success: false, error: { code: "AI_SERVICE_UNAVAILABLE" } });
  await expect(aiSection.getByText("Layanan AI tidak tersedia atau belum dikonfigurasi", { exact: false })).toBeVisible();
  await expect(aiSection.getByRole("button", { name: "Coba lagi", exact: true })).toBeVisible();
  await expect(aiSection.locator("dl")).toHaveCount(0);
  await expect(scoreSection).toBeVisible();
  await expect(evidence).toBeVisible();
}

async function saveOpportunity(page: Page, opportunityName: string): Promise<void> {
  await page.getByRole("button", { name: "Simpan opportunity", exact: true }).click();
  await expect(page.getByRole("button", { name: "Hapus dari simpanan", exact: true })).toBeVisible();
  await navigate(page, "Saved Opportunities");
  await expect(page.getByRole("heading", { name: "Saved Opportunities", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: opportunityName, exact: true })).toBeVisible();
}

async function compareTwoOpportunities(page: Page, firstOpportunity: string, secondOpportunity: string): Promise<void> {
  await navigate(page, "Opportunity Finder");
  await expect(page.getByRole("heading", { name: "Opportunity Finder", exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: `Pilih ${firstOpportunity} untuk perbandingan`, exact: true }).check();
  await page.getByRole("checkbox", { name: `Pilih ${secondOpportunity} untuk perbandingan`, exact: true }).check();
  await page.getByRole("button", { name: "Bandingkan (2/3)", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Hasil perbandingan", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Hasil perbandingan" })).toContainText(firstOpportunity);
  await expect(page.getByRole("region", { name: "Hasil perbandingan" })).toContainText(secondOpportunity);
}

async function createAndReopenRoadmap(page: Page, roadmapType: "STARTUP" | "GROWTH"): Promise<string> {
  const label = roadmapType === "STARTUP" ? "Startup Roadmap" : "Growth Roadmap";
  const button = roadmapType === "STARTUP" ? "Buat Startup Roadmap" : "Buat Growth Roadmap";
  await page.getByRole("button", { name: button, exact: true }).click();
  await expect(page).toHaveURL(/\/roadmaps\/[0-9a-f-]+$/iu);
  const roadmapUrl = page.url();
  await expect(page.getByRole("heading", { name: label, exact: true })).toBeVisible();
  const expectedSteps = roadmapType === "STARTUP"
    ? ["1. Market Validation", "2. Competitor Check", "3. Prototype", "4. Test Selling", "5. Evaluation", "6. Go / Revise / Stop"]
    : ["1. Customer Validation", "2. Product Prototype", "3. Limited Test Selling", "4. Margin / Feedback Review", "5. Rollout / Revise / Stop"];
  const renderedSteps = await page.locator("ol > li h2").allTextContents();
  expect(renderedSteps).toEqual(expectedSteps);
  await expect(page.getByText("Rencana ini dibuat dengan template deterministik", { exact: false })).toBeVisible();

  if (roadmapType === "GROWTH") {
    await expect(page.getByText("Profil bisnis yang digunakan: Warung E2E Pagi; Minuman; Bandung E2E.", { exact: true })).toBeVisible();
    await expect(page.getByText("Produk aktif: Minuman sintetis uji alur (harga tercatat Rp 25.000).", { exact: true })).toBeVisible();
    await expect(page.getByText(/omzet|pendapatan|revenue/i)).toHaveCount(0);
  }

  await page.reload();
  await expect(page.getByRole("heading", { name: label, exact: true })).toBeVisible();
  await navigate(page, "Roadmaps");
  await expect(page.getByRole("heading", { name: "Roadmap tersimpan", exact: true })).toBeVisible();
  await expect(page.getByText(roadmapType === "STARTUP" ? STARTUP_OPPORTUNITY : GROWTH_OPPORTUNITY, { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Buka roadmap", exact: true }).click();
  await expect(page).toHaveURL(roadmapUrl);
  await expect(page.getByRole("heading", { name: label, exact: true })).toBeVisible();
  expect(await page.locator("ol > li h2").allTextContents()).toEqual(expectedSteps);
  return roadmapUrl;
}

async function logout(page: Page): Promise<void> {
  if ((page.viewportSize()?.width ?? 1365) < 768) {
    await page.getByRole("button", { name: "Open navigation menu", exact: true }).click();
  } else {
    await page.getByText("Profile", { exact: true }).click();
  }
  await page.getByRole("button", { name: "Keluar", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/u);
  await expect(page.getByRole("heading", { name: "Masuk ke VENTUREX", exact: true })).toBeVisible();
}

async function createIsolatedContext(browser: Browser, page: Page) {
  const viewport = page.viewportSize() ?? { width: 1365, height: 900 };
  const isMobile = viewport.width < 768;
  return browser.newContext({ viewport, deviceScaleFactor: 1, isMobile, hasTouch: isMobile });
}

test("unauthenticated users cannot open protected application pages", async ({ page }) => {
  for (const route of ["/dashboard", "/trends", "/opportunities", "/saved", "/roadmaps"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/u);
    await expect(page.getByRole("heading", { name: "Masuk ke VENTUREX", exact: true })).toBeVisible();
  }
});

test("entrepreneur discovers an eligible Opportunity and reopens a private persisted Startup Roadmap", async ({ page, browser }, testInfo) => {
  const primaryEmail = uniqueEmail("entrepreneur");
  await registerAndLogin(page, primaryEmail);
  await chooseUserTypeAndProfile(page, "entrepreneur", "Jakarta Selatan E2E");
  const primaryUserId = await currentUserId(page);
  await openOpportunityFromTrend(page, STARTUP_TREND, STARTUP_OPPORTUNITY);
  await verifyOpportunityAndAIFallback(page);
  await saveOpportunity(page, STARTUP_OPPORTUNITY);
  await compareTwoOpportunities(page, STARTUP_OPPORTUNITY, COMPARE_OPPORTUNITY);
  await openOpportunityFromTrend(page, STARTUP_TREND, STARTUP_OPPORTUNITY);
  const roadmapUrl = await createAndReopenRoadmap(page, "STARTUP");

  const secondContext = await createIsolatedContext(browser, page);
  try {
    const secondUserPage = await secondContext.newPage();
    await registerAndLogin(secondUserPage, uniqueEmail("isolated-entrepreneur"));
    await chooseUserTypeAndProfile(secondUserPage, "entrepreneur", "Bandung E2E");
    expect(await currentUserId(secondUserPage)).not.toBe(primaryUserId);
    await expect(secondUserPage.getByText("Bandung E2E", { exact: true })).toBeVisible();
    await expect(secondUserPage.getByText("Jakarta Selatan E2E", { exact: true })).toHaveCount(0);

    const roadmapId = new URL(roadmapUrl).pathname.split("/").at(-1);
    if (!roadmapId) throw new Error("Startup Roadmap URL did not include an identifier.");
    const privateRoadmapApi = await secondUserPage.evaluate(async (id) => {
      const response = await fetch(`/api/v1/roadmaps/${id}`, { cache: "no-store" });
      return { status: response.status, body: await response.json() };
    }, roadmapId);
    expect(privateRoadmapApi).toMatchObject({
      status: 404,
      body: { success: false, error: { code: "RESOURCE_NOT_FOUND" } },
    });

    // A streamed notFound() page can return HTTP 200; assert that no private roadmap data renders.
    await secondUserPage.goto(roadmapUrl);
    await expect(secondUserPage.getByRole("heading", { name: "Startup Roadmap", exact: true })).toHaveCount(0);
    await expect(secondUserPage.getByText(STARTUP_OPPORTUNITY, { exact: true })).toHaveCount(0);
    await expect(secondUserPage.getByText("Jakarta Selatan E2E", { exact: true })).toHaveCount(0);

    await logout(secondUserPage);
    await secondUserPage.goto("/dashboard");
    await expect(secondUserPage).toHaveURL(/\/login$/u);

    await page.goto(roadmapUrl);
    await expect(page.getByRole("heading", { name: "Startup Roadmap", exact: true })).toBeVisible();
    await logout(page);
    await page.goto("/roadmaps");
    await expect(page).toHaveURL(/\/login$/u);
  } finally {
    await secondContext.close();
  }
  testInfo.annotations.push({ type: "fixture", description: "All Trends, Opportunities, and Evidence used here are explicitly synthetic local fixtures, not market evidence." });
});

test("UMKM uses its own business profile for a persisted Growth Roadmap without AI or market claims", async ({ page }, testInfo) => {
  await registerAndLogin(page, uniqueEmail("umkm"));
  await chooseUserTypeAndProfile(page, "umkm");
  await openOpportunityFromTrend(page, GROWTH_TREND, GROWTH_OPPORTUNITY);
  await expect(page.getByRole("button", { name: "Buat Growth Roadmap", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Buat Startup Roadmap", exact: true })).toHaveCount(0);
  await verifyOpportunityAndAIFallback(page);
  await saveOpportunity(page, GROWTH_OPPORTUNITY);
  await compareTwoOpportunities(page, GROWTH_OPPORTUNITY, COMPARE_OPPORTUNITY);
  await openOpportunityFromTrend(page, GROWTH_TREND, GROWTH_OPPORTUNITY);
  const roadmapUrl = await createAndReopenRoadmap(page, "GROWTH");
  expect(roadmapUrl).toMatch(/\/roadmaps\/[0-9a-f-]+$/iu);
  await logout(page);
  testInfo.annotations.push({ type: "fixture", description: "All Trends, Opportunities, and Evidence used here are explicitly synthetic local fixtures, not market evidence." });
});
