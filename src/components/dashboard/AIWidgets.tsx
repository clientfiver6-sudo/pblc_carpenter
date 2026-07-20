"use client"

import dynamic from "next/dynamic"

const AICommandCenter = dynamic(
  () => import("@/components/ai/AICommandCenter").then(m => ({ default: m.AICommandCenter })),
  { ssr: false }
)
const AskAI = dynamic(
  () => import("@/components/ai/AskAI").then(m => ({ default: m.AskAI })),
  { ssr: false }
)

export function DashboardAICommandCenter({ businessId }: { businessId: string }) {
  return <AICommandCenter businessId={businessId} />
}

export function DashboardAskAI() {
  return <AskAI />
}
