import { chromium, firefox, webkit, expect } from "@playwright/test";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createJiti } from "jiti";
const base = "http://localhost:3000";
if (!process.env.DATABASE_URL) throw new Error("Database configuration required");
const database = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1"].includes(database.hostname)) throw new Error("Local QA only");
const jiti = createJiti(import.meta.url, { alias: { "@": path.join(process.cwd(), "src") } });
const { privateBusinessFixture } = await jiti.import("../../src/opportunity/test-fixtures/private-business.ts");
const { privateEntrepreneurFixture } = await jiti.import("../../src/opportunity/test-fixtures/private-entrepreneur.ts");
const { generatePrivateGrowthRoadmap } = await jiti.import("../../src/roadmap/private-growth-generator.ts");
const { generatePrivateStartupRoadmap } = await jiti.import("../../src/roadmap/private-startup-generator.ts");
const output = "artifacts/journey-reports-20261022"; await fs.mkdir(output, { recursive: true });
const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
const engine = process.env.QA_BROWSER ?? "chrome";
const browser = await ({ chrome: chromium, firefox, webkit }[engine]).launch({ ...(engine === "chrome" ? { channel: "chrome" } : {}), headless: true });
const results = []; const privateIds = [];
try {
  for (const role of ["ENTREPRENEUR", "UMKM_EXISTING"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage(); const errors = []; page.on("pageerror", e => errors.push(e.message)); page.on("crash", () => console.log("PAGE CRASH", engine));
    const email = `report-qa-${role.toLowerCase()}-${Date.now()}@example.test`, password = `Qa-${randomUUID()}aA1!`;
    const registered = await page.request.post(`${base}/api/v1/auth/register`, { data: { email, password, passwordConfirmation: password } }); expect(registered.status()).toBe(201);
    await page.goto(`${base}/login`); await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill(password); await page.getByRole("button", { name: "Masuk", exact: true }).click(); await expect(page).toHaveURL(/onboarding/u);
    const headers = { Origin: base }; expect((await page.request.patch(`${base}/api/v1/me/user-type`, { headers, data: { userType: role } })).status()).toBe(200);
    const refs = await Promise.all(["fnb-categories", "customer-segments", "sales-channels"].map(async kind => (await (await page.request.get(`${base}/api/v1/reference/${kind}`)).json()).data));
    const location = { text: "Jakarta", city: "Jakarta", province: "DKI Jakarta", district: "Gambir", subdistrict: "Gambir" };
    const profile = role === "ENTREPRENEUR" ? { location, budget: { min: 1000000, max: 5000000 }, experienceLevel: "BEGINNER", timeCommitment: "PART_TIME", interestCategoryIds: [refs[0][0].id], customerSegmentIds: [refs[1][0].id], salesChannelIds: [refs[2][0].id], preferredProductType: "Bakso ayam", notes: "QA laporan sintetis" } : { businessName: "Kedai QA Laporan", businessCategoryId: refs[0][0].id, location, averagePrice: { min: 15000, max: 25000 }, products: [{ name: "Bakso ayam", categoryId: refs[0][0].id, price: 20000 }], customerSegmentIds: [refs[1][0].id], salesChannelIds: [refs[2][0].id], notes: "QA laporan sintetis" };
    const saved = await page.request.put(`${base}/api/v1/profile/${role === "ENTREPRENEUR" ? "entrepreneur" : "business"}`, { headers, data: profile }); expect(saved.status(), await saved.text()).toBe(200);
    const user = (await (await page.request.get(`${base}/api/v1/me`)).json()).data;
    const id = randomUUID(), item = role === "ENTREPRENEUR" ? privateEntrepreneurFixture() : privateBusinessFixture();
    item.hypothesis.title = `QA laporan ${role === "ENTREPRENEUR" ? "Startup" : "Growth"} — bakso ayam`;
    if (role === "ENTREPRENEUR") item.hypothesis.startupRoadmap = generatePrivateStartupRoadmap(item); else item.hypothesis.growthRoadmap = generatePrivateGrowthRoadmap(item);
    await client.query("INSERT INTO user_generated_opportunities(id,user_id,user_type,hypothesis,source_reference,provider,model,generated_at,is_saved,saved_at,created_at,updated_at) VALUES($1,$2,$3,$4,$5,'ninerouter','qa-synthetic',now(),true,now(),now(),now())", [id, user.id, role, JSON.stringify(item.hypothesis), JSON.stringify(item.source)]);
    const progressEndpoint = `${base}/api/v1/reports/journeys/${id}/progress`;
    expect((await page.request.patch(progressEndpoint, { headers, data: { stage: 1, completed: true, fingerprint: "f".repeat(64) } })).status()).toBe(409);
    expect((await page.request.patch(progressEndpoint, { headers: { Origin: "https://evil.test" }, data: { stage: 1, completed: true, fingerprint: "f".repeat(64) } })).status()).toBe(403);
    const anonymous = await browser.newContext();
    expect((await anonymous.request.get(`${base}/api/v1/reports/journeys/${id}?format=pdf`)).status()).toBe(401); await anonymous.close();
    await page.goto(`${base}/dashboard#laporan`); await expect(page.getByRole("heading", { name: "Laporan perjalanan" })).toBeVisible(); await expect(page.getByRole("button", { name: "Unduh PDF", exact: true })).toBeDisabled();
    expect((await page.request.get(`${base}/api/v1/reports/journeys/${id}?format=pdf`)).status()).toBe(409);
    if (privateIds.length) expect((await page.request.get(`${base}/api/v1/reports/journeys/${privateIds[0]}?format=pdf`)).status()).toBe(404);
    await page.getByRole("link", { name: "Lanjutkan roadmap", exact: true }).click(); await expect(page.getByRole("heading", { name: "Progres pelaksanaan" })).toBeVisible();
    const checkboxes = page.getByRole("checkbox"); await expect(checkboxes).toHaveCount(role === "ENTREPRENEUR" ? 6 : 5);
    for (let index = 0; index < await checkboxes.count(); index++) {
      await expect(checkboxes.nth(index)).toBeEnabled();
      console.log(role, "mark", index + 1);
      const persisted = page.waitForResponse(r => r.url().endsWith(`/${id}/progress`) && r.request().method() === "PATCH").catch(e => { console.log("PATCH response missing"); throw e; });
      await checkboxes.nth(index).click(); expect((await persisted).status()).toBe(200); await expect(checkboxes.nth(index)).toBeChecked();
    }
    await page.reload(); await expect(page.getByText(/Semua tahap selesai\. Laporan/u)).toBeVisible();
    await page.getByRole("link", { name: "Buka laporan di dashboard", exact: true }).click();
    await expect(page.getByRole("button", { name: "Unduh PDF", exact: true })).toBeEnabled();
    for (const [label, ext] of [["Unduh PDF", "pdf"], ["Unduh Excel", "xlsx"]]) {
      const download = page.waitForEvent("download"); await page.getByRole("button", { name: label, exact: true }).click(); await (await download).saveAs(`${output}/${role}-${engine}-live.${ext}`);
      await expect(page.getByRole("button", { name: label, exact: true })).toBeEnabled();
    }
    await page.locator("#laporan").screenshot({ path: `${output}/${role}-dashboard-desktop.png` });
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 900 }); await page.locator("#laporan").scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.locator("#laporan").screenshot({ path: `${output}/${role}-dashboard-${width}.png` });
    }
    await page.goto(`${base}/opportunities/hypotheses/${id}/roadmap`); await expect(checkboxes.first()).toBeChecked();
    const reopened = page.waitForResponse(r => r.url().endsWith(`/${id}/progress`) && r.request().method() === "PATCH"); await checkboxes.first().click(); expect((await reopened).status()).toBe(200); await expect(checkboxes.first()).not.toBeChecked();
    expect((await page.request.get(`${base}/api/v1/reports/journeys/${id}?format=xlsx`)).status()).toBe(409);
    console.log(engine, role, "opening notifications"); await page.goto(`${base}/notifications`, { waitUntil: "domcontentloaded" }); console.log("notification URL",page.url()); await expect(page.getByRole("heading", { name: "Notifikasi perangkat", exact: true })).toBeVisible();
    await page.screenshot({ path: `${output}/${role}-notifications-mobile.png`, fullPage: true });
    if (engine === "chrome") {
      const beforePermission = await page.evaluate(() => Notification.permission);
      await page.getByRole("button", { name: "Siapkan perangkat", exact: true }).click();
      await expect(page.getByRole("button", { name: "Aktifkan perangkat", exact: true })).toBeVisible({ timeout: 20000 });
      expect(await page.evaluate(() => Notification.permission)).toBe(beforePermission);
    }
    const capability = await page.evaluate(() => ({ secure: isSecureContext, serviceWorker: "serviceWorker" in navigator, push: "PushManager" in window }));
    results.push({ role, stages: role === "ENTREPRENEUR" ? 6 : 5, registerProfile: "PASS", generatedAloneLocked: "PASS", completedAndReloaded: "PASS", downloads: "PASS", reopenedLocked: "PASS", responsiveWidths: [320,390,768,1440], ownership: privateIds.length ? "PASS" : "covered on second account", capability, errors });
    privateIds.push(id);
    await page.setViewportSize({width:1440,height:1000});
    await page.getByRole("button", {name:"Menu profil",exact:true}).click();
    await page.getByRole("button", {name:"Keluar",exact:true}).click();
    await expect(page).toHaveURL(/\/login/u);
    expect((await page.request.get(`${base}/api/v1/reports/journeys/${id}?format=pdf`)).status()).toBe(401);
    results[results.length-1].logout = "PASS";
    await context.close();
  }
} catch (error) {
  for (const context of browser.contexts()) for (const page of context.pages()) { await page.screenshot({ path: `${output}/failure-${engine}.png`, fullPage: true, timeout: 5000 }).catch(() => {}); console.error(String(error)); console.error("URL",page.url()); console.error(await page.locator("body").innerText({timeout:3000}).then(s=>s.slice(-1800)).catch(()=>"DOM unavailable")); }
  process.exitCode = 1;
} finally {
  await fs.writeFile(`${output}/browser-results-${engine}.json`, JSON.stringify(results, null, 2)); await browser.close(); await client.end();
}
console.log(JSON.stringify(results));
