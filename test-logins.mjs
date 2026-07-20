import { chromium } from "playwright";

const BASE = "http://localhost:3099";

// 3 demo accounts use the card buttons on the login page; admin uses the email form
const DEMO_CARDS = [
  { label: "TechFrio",  cardText: "TechFrio" },
  { label: "ClimaCom",  cardText: "ClimaCom" },
  { label: "FrioCerto", cardText: "FrioCerto" },
];
const ADMIN = { label: "Admin", email: "admin@retornai.com.br", password: process.env.TEST_ADMIN_PASSWORD ?? "" };

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const results = [];

// ── Test demo card logins ──
for (const acct of DEMO_CARDS) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1500);

    // Click the demo card button by finding the card with matching label
    const card = page.locator("button").filter({ hasText: acct.cardText }).first();
    await card.waitFor({ state: "visible", timeout: 10000 });
    await card.click();

    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });
    await page.waitForTimeout(2000);

    const finalUrl = page.url();
    await page.screenshot({ path: `ss_${acct.label}.png`, fullPage: false });

    const verdict = finalUrl.includes("/onboarding")
      ? "⚠ /onboarding — business row missing in DB"
      : finalUrl.includes("/dashboard")
        ? "✓ dashboard loaded"
        : `✓ ${finalUrl}`;

    results.push({ label: acct.label, status: "PASS", url: finalUrl, verdict });
  } catch (err) {
    const finalUrl = page.url();
    await page.screenshot({ path: `ss_${acct.label}_FAIL.png`, fullPage: false }).catch(() => {});
    results.push({ label: acct.label, status: "FAIL", url: finalUrl, error: err.message.slice(0, 150) });
  } finally {
    await ctx.close();
  }
}

// ── Test admin via email form ──
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1500);

    // Open email form
    const toggle = page.locator("button", { hasText: /entrar com e-mail/i });
    await toggle.waitFor({ state: "visible", timeout: 10000 });
    await toggle.click();
    await page.waitForTimeout(400);

    await page.fill('input[name="email"]', ADMIN.email);
    await page.fill('input[name="password"]', ADMIN.password);
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });
    await page.waitForTimeout(2000);

    const finalUrl = page.url();
    await page.screenshot({ path: `ss_Admin.png`, fullPage: false });

    const verdict = finalUrl.includes("/admin") ? "✓ /admin panel" : `landed on ${finalUrl}`;
    results.push({ label: "Admin", status: "PASS", url: finalUrl, verdict });
  } catch (err) {
    const finalUrl = page.url();
    await page.screenshot({ path: `ss_Admin_FAIL.png`, fullPage: false }).catch(() => {});
    results.push({ label: "Admin", status: "FAIL", url: finalUrl, error: err.message.slice(0, 150) });
  } finally {
    await ctx.close();
  }
}

await browser.close();

console.log("\n=== LOGIN TEST RESULTS ===\n");
for (const r of results) {
  const icon = r.status === "PASS" ? "✓" : "✗";
  console.log(`${icon}  ${r.label}  →  ${r.url}`);
  if (r.verdict) console.log(`       ${r.verdict}`);
  if (r.error)   console.log(`       ERROR: ${r.error}`);
}
console.log();
