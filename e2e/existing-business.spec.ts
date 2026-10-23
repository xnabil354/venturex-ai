import { createHmac, randomUUID } from "node:crypto";
import { Client } from "pg";
import { expect, test } from "@playwright/test";
import { privateBusinessFixture } from "../src/opportunity/test-fixtures/private-business";
import { generatePrivateGrowthRoadmap } from "../src/roadmap/private-growth-generator";

test("Existing business private journey with explicitly synthetic evidence", async ({ page }, testInfo) => {
  const url = process.env.DATABASE_URL;
  if (!url || new URL(url).pathname !== "/venturex_batch10_e2e_test" || new URL(url).hostname !== "127.0.0.1" || new URL(url).port === "5432") throw new Error("Disposable E2E database required");
  const email = `existing-${randomUUID()}@example.test`, password = `Test-${randomUUID()}aA1!`;
  const registered = await page.request.post("/api/v1/auth/register", { data: { email, password, passwordConfirmation: password } });
  expect(registered.status()).toBe(201);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click(); await expect(page).toHaveURL(/\/onboarding$/u);
  const me = await (await page.request.get("/api/v1/me")).json();
  const userId = me.data.id as string;
  expect((await page.request.patch("/api/v1/me/user-type", { data: { userType: "UMKM_EXISTING" } })).ok()).toBe(true);
  const getRefs = async (path: string) => (await (await page.request.get(`/api/v1/reference/${path}`)).json()).data as { id: string; name: string }[];
  const [categories, segments, channels] = await Promise.all([getRefs("fnb-categories"), getRefs("customer-segments"), getRefs("sales-channels")]);
  const profile = { businessName: "Kedai Sintetis QA", businessCategoryId: categories[0]!.id, location: { text: "Jakarta sintetis", city: "Jakarta", province: "DKI Jakarta" }, averagePrice: { min: 10000, max: 20000 }, products: [{ name: "Bakso Sintetis", categoryId: categories[0]!.id, price: 15000 }], customerSegmentIds: [segments[0]!.id], salesChannelIds: [channels[0]!.id], notes: "Synthetic QA only" };
  expect((await page.request.put("/api/v1/profile/business", { data: profile })).ok()).toBe(true);
  const client = new Client({ connectionString: url }); await client.connect();
  const ids: string[] = [];
  const analysisContext = {
    profile: { persona: "UMKM_EXISTING", businessName: profile.businessName, businessCategory: categories[0]!.name, businessDescription: null, location: profile.location, averagePrice: { ...profile.averagePrice, currency: "IDR" }, products: [{ name: "Bakso Sintetis", category: categories[0]!.name, price: 15000 }], customerSegments: [segments[0]!.name], salesChannels: [channels[0]!.name], notes: profile.notes },
    selections: { categoryIds: [categories[0]!.id], segmentIds: [segments[0]!.id], channelIds: [channels[0]!.id], averagePrice: profile.averagePrice },
    options: { categories: categories.map(({ id, name }) => ({ id, name })), segments: segments.map(({ id, name }) => ({ id, name })), channels: channels.map(({ id, name }) => ({ id, name })) },
  };
  try {
    for (let i = 0; i < 62; i++) {
      const item = privateBusinessFixture(), id = randomUUID(); ids.push(id);
      item.hypothesis.title = `Peluang sintetis Existing ${String(i).padStart(2, "0")}`;
      if (i === 2) {
        item.hypothesis.businessAnalysis.generatedAt = new Date().toISOString();
        const { businessAnalysis: _analysis, ...base } = item.hypothesis;
        item.hypothesis.businessAnalysis.inputFingerprint = createHmac("sha256", process.env.AUTH_SECRET!).update("venturex:business-decision:v1\0").update(JSON.stringify({ context: analysisContext, hypothesis: base, source: item.source, proposedPrice: item.hypothesis.businessAnalysis.proposedPrice, model: "unavailable", version: "business-decision-v1", conceptAlignmentVersion: "business-concept-alignment-v1", competitorMatchingVersion: 2 })).digest("hex");
      }
      const hypothesis = i === 0 ? { ...item.hypothesis, growthRoadmap: generatePrivateGrowthRoadmap(item) } : item.hypothesis;
      await client.query("INSERT INTO user_generated_opportunities (id,user_id,user_type,hypothesis,source_reference,provider,model,generated_at,is_saved,saved_at,created_at,updated_at) VALUES ($1,$2,'UMKM_EXISTING',$3,$4,'ninerouter',$5,NOW(),true,NOW(),NOW()+($6::int * interval '1 second'),NOW())", [id, userId, JSON.stringify(hypothesis), JSON.stringify(item.source), item.model, i]);
    }
  } finally { await client.end(); }
  let providerCalls = 0;
  page.on("request", request => { if (request.method() === "POST" && /\/api\/v1\/(?:trend-radar|opportunities\/signals)/u.test(request.url())) providerCalls++; });
  await page.goto("/opportunities");
  await expect(page.getByRole("link", { name: "Lihat Detail Score" }).first()).toBeVisible();
  await page.getByLabel("Fokus pencarian bisnis").selectOption("product:0");
  await expect(page).toHaveURL(/queryKey=product%3A0/u); expect(providerCalls).toBe(0);
  await page.goto("/saved?page=6");
  await expect(page.getByRole("heading", { name: "Peluang sintetis Existing 00", exact: true })).toBeVisible();
  await page.goto(`/opportunities/hypotheses/${ids[1]}`);
  await expect(page.getByRole("heading", { name: "Business Fit", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Buat Growth Roadmap" })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(providerCalls).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("existing-analysis.png"), fullPage: true, caret: "initial" });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Perbarui analisis" }).click();
  await expect(page.getByRole("status")).toContainText("Analisis belum dapat");
  await expect(page.getByRole("heading", { name: "Business Fit", exact: true })).toBeVisible();
  await page.goto(`/opportunities/hypotheses/${ids[2]}`);
  await expect(page.getByRole("button", { name: "Buat Growth Roadmap" })).toBeEnabled();
  await page.getByRole("button", { name: "Buat Growth Roadmap" }).click();
  await expect(page.getByRole("heading", { name: "Growth Roadmap", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "5. Rollout / Revise / Stop", exact: true })).toBeVisible();
  await page.goto(`/opportunities/compare?ids=${ids[1]},${ids[2]}`);
  await expect(page.getByRole("heading", { name: "Bandingkan pengembangan bisnis" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Peluang sintetis Existing 01", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("existing-compare.png"), fullPage: true });
  await page.goto("/roadmaps");
  await page.getByRole("link", { name: "Buka roadmap", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Growth Roadmap", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "5. Rollout / Revise / Stop", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("existing-growth-roadmap.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto(`/opportunities/hypotheses/${ids[1]}`);
  await page.getByRole("button", { name: "Keluarkan dari simpanan" }).click();
  await expect(page.getByRole("button", { name: "Simpan peluang", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Simpan peluang", exact: true }).click();
  await expect(page.getByRole("button", { name: "Keluarkan dari simpanan" })).toBeVisible();
});
