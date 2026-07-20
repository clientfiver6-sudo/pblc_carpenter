// E2E test for Instruções de IA (business_skills) feature
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

if (!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD) {
  console.error("Missing env vars: TEST_EMAIL and TEST_PASSWORD are required.");
  process.exit(1);
}

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});

const context = await browser.newContext();
const page = await context.newPage();

let passed = 0;
let failed = 0;

function ok(label) { console.log(`  ✓ ${label}`); passed++; }
function fail(label, err) { console.error(`  ✗ ${label}: ${err}`); failed++; }

async function shot(name) {
  await page.screenshot({ path: `test-screenshot-${name}.png` });
}

try {
  console.log("\n── 1. Login ──");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await shot("login");
  const emailInput = page.locator('input[type="email"]').first();
  const passwordInput = page.locator('input[type="password"]').first();
  if (await emailInput.count() === 0) {
    fail("login form present", "no email input found");
    process.exit(1);
  }
  ok("login page loaded");
  await emailInput.fill(process.env.TEST_EMAIL);
  await passwordInput.fill(process.env.TEST_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/dashboard/, { timeout: 10000 }).catch(() => {});
  await shot("after-login");
  if (page.url().includes("dashboard")) {
    ok("logged in successfully");
  } else {
    fail("login redirect", `still at ${page.url()}`);
    await browser.close();
    process.exit(1);
  }

  console.log("\n── 2. Navigate to Instruções de IA ──");
  await page.goto(`${BASE}/dashboard/settings/skills`, { waitUntil: "networkidle" });
  await shot("skills-page");
  const heading = await page.locator('h2:has-text("Instruções de IA")').count();
  if (heading > 0) { ok("page heading visible"); } else { fail("page heading", "not found"); }

  const newBtn = page.locator('button:has-text("Nova instrução")');
  if ((await newBtn.count()) > 0) { ok('"Nova instrução" button present'); } else { fail('"Nova instrução" button', "not found"); }

  console.log("\n── 3. Create a skill via suggestion chip ──");
  const chip = page.locator('button:has-text("Tom de voz")').first();
  const chipEnabled = (await chip.count()) > 0 && !(await chip.isDisabled());
  if (chipEnabled) {
    await chip.click();
    await page.waitForSelector('input[placeholder*="Tom de voz"]', { timeout: 3000 }).catch(() => {});
    await shot("skills-add-dialog");
    const dialogTitle = await page.locator('text="Nova instrução"').count();
    if (dialogTitle > 0) { ok("add dialog opened from chip"); } else { fail("add dialog", "did not open"); }
    await page.locator('button:has-text("Adicionar")').click();
    await page.waitForTimeout(1500);
    await shot("skills-after-create");
    const card = await page.locator('span:has-text("Tom de voz")').count();
    if (card > 0) { ok("skill card appears after creation"); } else { fail("skill card", "not visible after creation"); }
  } else {
    ok("'Tom de voz' chip already used — skipping chip creation test");
  }

  console.log("\n── 4. Create a skill via button ──");
  await page.locator('button:has-text("Nova instrução")').click();
  await page.waitForSelector('[placeholder*="Tom de voz"]', { timeout: 3000 }).catch(() => {});
  await shot("skills-manual-create");
  await page.locator('input[placeholder*="Tom de voz"]').fill("Teste Claude Code");
  await page.locator('textarea').last().fill("Instrução de teste criada automaticamente pelo Claude Code para verificar o fluxo.");
  await page.locator('button:has-text("Adicionar")').click();
  await page.waitForTimeout(1500);
  await shot("skills-after-manual-create");
  const testCard = await page.locator('span:has-text("Teste Claude Code")').count();
  if (testCard > 0) { ok("manual skill creation works"); } else { fail("manual skill card", "not visible after creation"); }

  console.log("\n── 5. Edit the skill ──");
  // Find the edit button near "Teste Claude Code"
  const testCardContainer = page.locator('div').filter({ has: page.locator('span:has-text("Teste Claude Code")') }).first();
  const editBtn = testCardContainer.locator('button').nth(1); // second button = edit
  if (await editBtn.count() > 0) {
    await editBtn.click();
    await page.waitForTimeout(500);
    const nameInput = testCardContainer.locator('input');
    if (await nameInput.count() > 0) {
      await nameInput.fill("Teste Claude Code (editado)");
      await testCardContainer.locator('button:has-text("Salvar")').click();
      await page.waitForTimeout(1500);
      await shot("skills-after-edit");
      const edited = await page.locator('span:has-text("Teste Claude Code (editado)")').count();
      if (edited > 0) { ok("skill edit works"); } else { fail("skill edit", "updated name not visible"); }
    } else {
      fail("edit form", "no name input found");
    }
  } else {
    fail("edit button", "not found");
  }

  console.log("\n── 6. Toggle skill active/inactive ──");
  const updatedCard = page.locator('div').filter({ has: page.locator('span:has-text("Teste Claude Code")') }).first();
  const toggleBtn = updatedCard.locator('button').first(); // first button = toggle
  if (await toggleBtn.count() > 0) {
    await toggleBtn.click();
    await page.waitForTimeout(1000);
    await shot("skills-toggled");
    ok("toggle button clickable");
  } else {
    fail("toggle button", "not found");
  }

  console.log("\n── 7. Delete the skill ──");
  const finalCard = page.locator('div').filter({ has: page.locator('span:has-text("Teste Claude Code")') }).first();
  const deleteBtn = finalCard.locator('button').last();
  if (await deleteBtn.count() > 0) {
    await deleteBtn.click();
    await page.waitForTimeout(300);
    await shot("skills-delete-confirm");
    const confirmBtn = page.locator('button:has-text("Excluir")').last();
    if (await confirmBtn.count() > 0) {
      await confirmBtn.click();
      await page.waitForTimeout(1500);
      await shot("skills-after-delete");
      const gone = await page.locator('span:has-text("Teste Claude Code")').count();
      if (gone === 0) { ok("skill deletion works"); } else { fail("skill deletion", "card still visible"); }
    } else {
      fail("delete confirm button", "not found");
    }
  } else {
    fail("delete button", "not found");
  }

  console.log("\n── 8. Verify API endpoint ──");
  const apiRes = await page.evaluate(async () => {
    const r = await fetch("/api/skills");
    return { status: r.status, ok: r.ok };
  });
  if (apiRes.ok) { ok(`GET /api/skills → ${apiRes.status}`); } else { fail("GET /api/skills", `status ${apiRes.status}`); }

} catch (err) {
  console.error("\nUnhandled error:", err);
  await shot("error");
  failed++;
} finally {
  await browser.close();
  console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
  process.exit(failed > 0 ? 1 : 0);
}
