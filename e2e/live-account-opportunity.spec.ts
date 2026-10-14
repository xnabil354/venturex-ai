import { expect, test } from "@playwright/test";

const expectedModel = "cx/gpt-6-luna-xhigh";

function responsePath(response: { url(): string }): string {
  return new URL(response.url()).pathname;
}

async function fillIfEmpty(locator: import("@playwright/test").Locator, value: string): Promise<void> {
  if (!(await locator.inputValue()).trim()) await locator.fill(value);
}

async function completeEntrepreneurProfile(page: import("@playwright/test").Page): Promise<void> {
  if (new URL(page.url()).pathname === "/onboarding") {
    await page.getByRole("radio", { name: /Saya ingin memulai bisnis F&B/i }).check();
    await page.getByRole("button", { name: "Lanjutkan" }).click();
    await page.waitForURL(/\/onboarding\/entrepreneur/u);
  }
  if (new URL(page.url()).pathname !== "/onboarding/entrepreneur") return;

  await expect(page.getByLabel(/Lokasi utama/)).toBeVisible();
  await fillIfEmpty(page.locator("#location-text"), "Jakarta");
  const categoryGroup = page.locator("fieldset").filter({ hasText: /Kategori yang diminati/iu }).first();
  const foodChoice = categoryGroup.locator("label").filter({ hasText: /^\s*Makanan\s*/iu }).getByRole("checkbox");
  if (await foodChoice.count() === 0) {
    throw new Error("The entrepreneur reference data does not contain the approved food category.");
  }
  if (!(await foodChoice.isChecked())) await foodChoice.check();
  await page.getByRole("button", { name: "Lanjutkan" }).click();

  await fillIfEmpty(page.locator("#budget-min"), "1000000");
  await fillIfEmpty(page.locator("#budget-max"), "5000000");
  const segmentGroup = page.locator("fieldset").filter({ hasText: /Kelompok pelanggan/iu }).first();
  const segmentChoice = segmentGroup.getByRole("checkbox").first();
  if (!(await segmentChoice.isChecked())) await segmentChoice.check();
  await page.getByRole("button", { name: "Lanjutkan" }).click();

  const channelGroup = page.locator("fieldset").filter({ hasText: /Cara penjualan/iu }).first();
  const channelChoice = channelGroup.getByRole("checkbox").first();
  if (!(await channelChoice.isChecked())) await channelChoice.check();
  await page.locator("#experience-level").selectOption("BEGINNER");
  await page.locator("#time-commitment").selectOption("LIMITED");
  await page.locator("#preferred-product-type").fill("Bakso");
  await page.getByRole("button", { name: "Simpan profil" }).click();
  await page.waitForURL(/\/dashboard/u);
}

test("registered Entrepreneur can use live Trends and save a private 9Router hypothesis", async ({ page }) => {
  const localBase = new URL(process.env.VENTUREX_E2E_BASE_URL ?? "http://127.0.0.1:3000");
  const reuseLiveSnapshot = process.env.VENTUREX_E2E_REUSE_LIVE_SNAPSHOT === "true";
  const saveLatestExistingHypothesisOnly = process.env.VENTUREX_E2E_SAVE_LATEST_HYPOTHESIS_ONLY === "true";
  const counts = { brightDataRefresh: 0, opportunityGeneration: 0, save: 0 };
  const statuses: Record<string, number> = {};
  let pageErrorCount = 0;
  let liveBatch: {
    batchStatus: string;
    cache: string;
    records: { retrieved: number; accepted: number; rejected: number };
    screening: { LIKELY_FNB: number; REVIEW_REQUIRED: number; OUT_OF_SCOPE: number };
    signalCount: number;
  } | null = null;

  page.on("request", (request) => {
    if (new URL(request.url()).origin !== localBase.origin) return;
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST" && path === "/api/v1/trends/live-signals/refresh") counts.brightDataRefresh += 1;
    if (request.method() === "POST" && path === "/api/v1/opportunities/ideas") counts.opportunityGeneration += 1;
    if (request.method() === "PATCH" && path === "/api/v1/opportunities/ideas") counts.save += 1;
  });
  page.on("response", (response) => {
    const path = responsePath(response);
    if (path.startsWith("/api/v1/trends/live-signals/") || path === "/api/v1/opportunities/ideas") {
      statuses[`${response.request().method()} ${path}`] = response.status();
    }
  });
  page.on("pageerror", () => { pageErrorCount += 1; });

  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.VENTUREX_E2E_EMAIL!);
  await page.getByLabel("Password").fill(process.env.VENTUREX_E2E_PASSWORD!);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/(?:onboarding(?:\/entrepreneur)?|dashboard)(?:[/?#]|$)/u, { timeout: 30_000 });
  const currentUserResponse = await page.request.get("/api/v1/me");
  if (!currentUserResponse.ok()) throw new Error(`Authenticated user state could not be read: HTTP ${currentUserResponse.status()}.`);
  const currentUserBody = await currentUserResponse.json() as {
    success?: boolean;
    data?: { userType?: string | null; onboardingStatus?: string };
  };
  if (!currentUserBody.success || !currentUserBody.data) throw new Error("Authenticated user state did not match the session contract.");
  if (currentUserBody.data.userType && currentUserBody.data.userType !== "ENTREPRENEUR") {
    throw new Error("The supplied test account is not registered as an Entrepreneur; no profile was changed.");
  }
  const onboardingStatus = currentUserBody.data.onboardingStatus;
  if (onboardingStatus === "NOT_STARTED") {
    await page.goto("/onboarding");
  } else if (onboardingStatus !== "COMPLETED") {
    await page.goto("/onboarding/entrepreneur");
  } else {
    await page.goto("/dashboard");
  }
  await completeEntrepreneurProfile(page);
  await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/u);

  if (!reuseLiveSnapshot) {
    await page.goto("/trends");
    await expect(page.getByRole("heading", { name: "Trend Radar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Muat sinyal terbaru" })).toBeVisible();
    const refreshResponsePromise = page.waitForResponse((response) =>
      response.request().method() === "POST" && responsePath(response) === "/api/v1/trends/live-signals/refresh");
    await page.getByRole("button", { name: "Muat sinyal terbaru" }).click();
    const refreshResponse = await refreshResponsePromise;
    const refreshBody = await refreshResponse.json() as { data?: Record<string, unknown>; error?: { code?: string } };
    if (!refreshResponse.ok()) {
      throw new Error(`Bright Data refresh failed: HTTP ${refreshResponse.status()} ${refreshBody.error?.code ?? "UNKNOWN"}.`);
    }
    const batch = refreshBody.data as {
      mode?: string;
      cache?: string;
      records?: { retrieved?: number; accepted?: number; rejected?: number };
      batchStatus?: string;
      screening?: { classifications?: { LIKELY_FNB?: number; REVIEW_REQUIRED?: number; OUT_OF_SCOPE?: number } };
      signals?: readonly { classification?: string }[];
    } | undefined;
    if (batch?.mode !== "LIVE_PROVIDER") throw new Error("Trend refresh was not identified as a live provider result.");
    const likelyCount = batch.screening?.classifications?.LIKELY_FNB ?? 0;
    if (likelyCount < 1 || !batch.signals?.some((signal) => signal.classification === "LIKELY_FNB")) {
      throw new Error(`Bright Data returned no LIKELY_FNB candidate; retrieved=${batch.records?.retrieved ?? 0}, accepted=${batch.records?.accepted ?? 0}, rejected=${batch.records?.rejected ?? 0}. AI generation was not attempted.`);
    }
    liveBatch = {
      batchStatus: batch.batchStatus ?? "UNKNOWN",
      cache: batch.cache ?? "UNKNOWN",
      records: {
        retrieved: batch.records?.retrieved ?? 0,
        accepted: batch.records?.accepted ?? 0,
        rejected: batch.records?.rejected ?? 0,
      },
      screening: {
        LIKELY_FNB: batch.screening?.classifications?.LIKELY_FNB ?? 0,
        REVIEW_REQUIRED: batch.screening?.classifications?.REVIEW_REQUIRED ?? 0,
        OUT_OF_SCOPE: batch.screening?.classifications?.OUT_OF_SCOPE ?? 0,
      },
      signalCount: batch.signals?.length ?? 0,
    };
  }

  await page.goto("/opportunities");
  await expect(page.getByRole("heading", { name: "Opportunity Finder" })).toBeVisible();
  if (saveLatestExistingHypothesisOnly) {
    const unsavedCards = page.locator("li[data-hypothesis-id]").filter({ has: page.getByRole("button", { name: "Simpan hipotesis" }) });
    const targetCard = unsavedCards.first();
    await expect(targetCard).toBeVisible();
    await expect(targetCard.getByText(/dihasilkan .* oleh ninerouter, model cx\/gpt-6-luna-xhigh/i)).toBeVisible();
    const targetId = await targetCard.getAttribute("data-hypothesis-id");
    if (!targetId) throw new Error("The latest unsaved 9Router hypothesis has no stable ID.");

    const saveResponsePromise = page.waitForResponse((response) =>
      response.request().method() === "PATCH" && responsePath(response) === "/api/v1/opportunities/ideas");
    await targetCard.getByRole("button", { name: "Simpan hipotesis" }).click();
    const saveResponse = await saveResponsePromise;
    if (!saveResponse.ok()) throw new Error(`Saving the generated hypothesis failed: HTTP ${saveResponse.status()}.`);
    await expect(page.getByRole("status").filter({ hasText: "Hipotesis tersimpan di akun Anda." })).toBeVisible();

    await page.goto("/saved");
    await expect(page.getByRole("heading", { name: "Saved Opportunities" })).toBeVisible();
    const savedCard = page.locator(`li[data-hypothesis-id="${targetId}"]`);
    await expect(savedCard).toHaveCount(1);
    await expect(savedCard.getByText(/dihasilkan .* oleh ninerouter, model cx\/gpt-6-luna-xhigh/i)).toBeVisible();
    if (counts.brightDataRefresh !== 0 || counts.opportunityGeneration !== 0 || counts.save !== 1) {
      throw new Error(`Unexpected resume operation count: Bright Data refresh ${counts.brightDataRefresh}, 9Router generation ${counts.opportunityGeneration}, save ${counts.save}.`);
    }
    if (pageErrorCount > 0) throw new Error(`Browser emitted ${pageErrorCount} uncaught page errors.`);
    console.log(JSON.stringify({
      result: "LIVE_PROVIDER_TO_SAVED_OPPORTUNITY_PASS",
      inferenceFromEarlierBrowserResponse: "LIVE 9Router 201; validated provider and model",
      brightDataRefreshRequestsInThisRun: 0,
      nineRouterGenerationRequests: 0,
      saveRequests: 1,
      savedGeneratedHypothesisVisible: true,
      provider: "ninerouter",
      model: expectedModel,
      pageErrors: pageErrorCount,
    }));
    return;
  }
  const sourceSelect = page.getByLabel("Sinyal Google Trends");
  const privateList = page.getByRole("list", { name: "Hipotesis peluang pribadi" });
  const privateCards = privateList.locator(":scope > li[data-hypothesis-id]");
  const privateItemCountBeforeGeneration = await privateCards.count();
  const candidateOption = sourceSelect.locator("option:not([disabled])").first();
  const candidateValue = await candidateOption.getAttribute("value");
  if (!candidateValue) throw new Error("No selectable F&B source signal was passed to Opportunity Finder.");
  await sourceSelect.selectOption(candidateValue);
  await expect(page.getByRole("alert").filter({ hasText: /HTTP publik tanpa enkripsi/iu })).toHaveCount(0);
  await page.getByRole("checkbox").check();
  const generateButton = page.getByRole("button", { name: "Buat hipotesis dengan 9Router" });
  await expect(generateButton).toBeEnabled();
  const aiResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "POST" && responsePath(response) === "/api/v1/opportunities/ideas");
  await generateButton.click();
  const aiResponse = await aiResponsePromise;
  const aiBody = await aiResponse.json() as {
    data?: readonly { id?: string; provider?: string; model?: string; hypothesis?: { title?: string } }[];
    error?: {
      code?: string;
      providerDiagnostic?: {
        category?: string;
        upstreamStatus?: number | null;
        outboundAttempted?: boolean;
        failure?: string;
        rejectedRule?: string;
        fields?: readonly string[];
        issues?: readonly { path: string; code: string }[];
      };
    };
  };
  if (aiResponse.status() !== 201) {
    const diagnostic = aiBody.error?.providerDiagnostic;
    const safeIssuePaths = diagnostic?.issues?.map((issue) => `${issue.path}:${issue.code}`).join(",") ?? "none";
    const safeFields = diagnostic?.fields?.join(",") ?? "none";
    throw new Error(`9Router opportunity generation failed: HTTP ${aiResponse.status()} ${aiBody.error?.code ?? "UNKNOWN"}; provider=${diagnostic?.category ?? "unreported"}; upstream=${diagnostic?.upstreamStatus ?? "unknown"}; outbound=${diagnostic?.outboundAttempted ?? "unknown"}; failure=${diagnostic?.failure ?? "none"}; rejectedRule=${diagnostic?.rejectedRule ?? "none"}; fields=${safeFields}; issues=${safeIssuePaths}. No retry was made.`);
  }
  const generated = aiBody.data ?? [];
  if (generated.length < 1 || generated.some((item) => !item.id || item.provider !== "ninerouter" || item.model !== expectedModel || !item.hypothesis?.title)) {
    throw new Error("The generated result did not match the validated 9Router model contract.");
  }
  await expect(page.getByText(/Tersimpan privat .* hipotesis dari 9Router/i)).toBeVisible();
  await expect(privateCards).toHaveCount(privateItemCountBeforeGeneration + generated.length);
  const createdHypothesisId = generated[0].id!;
  const createdCard = privateList.locator(`:scope > li[data-hypothesis-id="${createdHypothesisId}"]`);
  await expect(createdCard).toHaveCount(1);

  const saveResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "PATCH" && responsePath(response) === "/api/v1/opportunities/ideas");
  await createdCard.getByRole("button", { name: "Simpan hipotesis" }).click();
  const saveResponse = await saveResponsePromise;
  if (!saveResponse.ok()) throw new Error(`Saving the generated hypothesis failed: HTTP ${saveResponse.status()}.`);
  await expect(page.getByRole("status").filter({ hasText: "Hipotesis tersimpan di akun Anda." })).toBeVisible();

  await page.goto("/saved");
  await expect(page.getByRole("heading", { name: "Saved Opportunities" })).toBeVisible();
  const savedCard = page.getByRole("list", { name: "Hipotesis tersimpan pribadi" }).locator(`:scope > li[data-hypothesis-id="${createdHypothesisId}"]`);
  await expect(savedCard).toHaveCount(1);
  await expect(savedCard.getByText(/dihasilkan .* oleh ninerouter, model cx\/gpt-6-luna-xhigh/i)).toBeVisible();

  const expectedRefreshes = reuseLiveSnapshot ? 0 : 1;
  if (counts.brightDataRefresh !== expectedRefreshes || counts.opportunityGeneration !== 1 || counts.save !== 1) {
    throw new Error(`Unexpected operation count: Bright Data refresh ${counts.brightDataRefresh}, 9Router generation ${counts.opportunityGeneration}, save ${counts.save}.`);
  }
  if (pageErrorCount > 0) throw new Error(`Browser emitted ${pageErrorCount} uncaught page errors.`);
  console.log(JSON.stringify({
    result: "LIVE_PROVIDER_TO_SAVED_OPPORTUNITY_PASS",
    brightDataRefreshRequestsInThisRun: counts.brightDataRefresh,
    brightDataSnapshotSource: reuseLiveSnapshot ? "previous live snapshot in server memory" : "fresh explicit refresh",
    liveBatch,
    nineRouterGenerationRequests: counts.opportunityGeneration,
    nineRouterHttpStatus: aiResponse.status(),
    provider: "ninerouter",
    model: expectedModel,
    savedItemsVisible: 1,
    pageErrors: pageErrorCount,
    apiStatuses: statuses,
  }));
});
