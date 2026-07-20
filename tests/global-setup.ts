import { chromium } from "playwright/test"
import * as dotenv from "dotenv"
import * as fs from "fs"
import * as path from "path"

dotenv.config({ path: ".env.local" })

export default async function globalSetup() {
  const email = process.env.TEST_EMAIL
  const password = process.env.TEST_PASSWORD
  if (!email || !password) {
    throw new Error("Set TEST_EMAIL and TEST_PASSWORD in .env.local to run AI ball tests")
  }

  const browser = await chromium.launch()
  const page = await browser.newPage()

  await page.goto("http://localhost:3000/login")
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL("**/dashboard**", { timeout: 20_000 })

  const dir = path.join(process.cwd(), ".playwright")
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  await page.context().storageState({ path: path.join(dir, "auth.json") })

  await browser.close()
}
