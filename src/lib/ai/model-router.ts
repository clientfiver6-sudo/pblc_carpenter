export enum TaskComplexity {
  SIMPLE = "SIMPLE",
  STANDARD = "STANDARD",
  COMPLEX = "COMPLEX",
}

const SIMPLE_MODEL = process.env.PREFERRED_SIMPLE_MODEL ?? "claude-haiku-4-5-20251001"
const COMPLEX_MODEL = process.env.PREFERRED_COMPLEX_MODEL ?? "claude-sonnet-4-20250514"

export function selectModel(complexity: TaskComplexity): string {
  if (complexity === TaskComplexity.SIMPLE) return SIMPLE_MODEL
  return COMPLEX_MODEL
}

export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  label: string,
): Promise<T> {
  try {
    return await primary()
  } catch (err) {
    console.warn(`[ModelRouter] ${label} primary failed, trying fallback:`, err)
    return await fallback()
  }
}

const SIMPLE_FUNCTIONS = new Set([
  "getDailyBriefing",
  "getNextBestActions",
  "answerFaq",
  "getStaffDayBriefing",
  "ambient.predictTomorrowNoShows",
  "analyzeConversation",
])

const COMPLEX_FUNCTIONS = new Set([
  "analyzeCustomer",
  "predictWorkItemRisk",
  "buildAutomationFromDescription",
  "generateReport",
])

export function classifyFunction(functionName: string): TaskComplexity {
  if (SIMPLE_FUNCTIONS.has(functionName)) return TaskComplexity.SIMPLE
  if (COMPLEX_FUNCTIONS.has(functionName)) return TaskComplexity.COMPLEX
  return TaskComplexity.COMPLEX
}
