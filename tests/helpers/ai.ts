import type { Page } from "playwright/test"

function stripOrb(text: string | null): string {
  return (text ?? "").replace(/✦\s*/g, "").trim()
}

/**
 * Send a message to the AI ball and return the response.
 * Assumes page is already at /dashboard/retornai with a fresh (empty) conversation.
 * Returns the response text; prefixes with "[Q] " when the AI asked a follow-up question.
 */
export async function sendMessage(page: Page, text: string): Promise<string> {
  const textarea = page.locator("textarea").first()
  await textarea.fill(text)
  await textarea.press("Enter")

  // Wait for the AI to respond (new message OR question box appears)
  await Promise.race([
    page.waitForSelector('[data-testid="ai-message"]', { timeout: 45_000 }),
    page.waitForSelector('[data-testid="ai-question"]', { timeout: 45_000 }),
  ])

  // Brief settle wait
  await page.waitForTimeout(300)

  return extractResponse(page)
}

/**
 * Fill the follow-up answer when the AI has asked a [Q] question.
 * The question box must be visible before calling this.
 */
export async function sendFollowUp(page: Page, answer: string): Promise<string> {
  const msgsBefore = await page.locator('[data-testid="ai-message"]').count()

  const input = page.locator('input[placeholder="Sua resposta..."]')
  await input.fill(answer)
  await page.getByRole("button", { name: "Responder" }).click()

  // Wait for either a new regular message or the question box to disappear
  await page.waitForFunction(
    (before: number) => {
      const newCount = document.querySelectorAll('[data-testid="ai-message"]').length
      const stillHasQuestion = document.querySelector('[data-testid="ai-question"]') !== null
      return newCount > before || !stillHasQuestion
    },
    msgsBefore,
    { timeout: 45_000 }
  )

  await page.waitForTimeout(300)
  return extractResponse(page)
}

async function extractResponse(page: Page): Promise<string> {
  const questionBox = page.locator('[data-testid="ai-question"]')
  if ((await questionBox.count()) > 0 && await questionBox.isVisible()) {
    const p = questionBox.locator("p").first()
    return "[Q] " + stripOrb(await p.textContent())
  }

  const messages = page.locator('[data-testid="ai-message"]')
  const count = await messages.count()
  if (count === 0) return ""
  return stripOrb(await messages.nth(count - 1).textContent())
}
