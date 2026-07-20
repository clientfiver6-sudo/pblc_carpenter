"use client"
import { useState } from "react"
import { AIAutomationBuilder } from "@/components/ai/AIAutomationBuilder"
import { NewAutomationForm } from "@/components/automations/NewAutomationForm"

interface AutomationConfig {
  name: string
  trigger_type: string
  message_template: string
  delay_minutes: number
}

interface Props {
  businessId: string
  initialTrigger?: string
}

export function NewAutomationPageClient({ businessId, initialTrigger }: Props) {
  const [aiConfig, setAiConfig] = useState<AutomationConfig | null>(null)

  return (
    <div>
      <AIAutomationBuilder onResult={(config) => setAiConfig(config)} />
      <NewAutomationForm
        key={aiConfig ? JSON.stringify(aiConfig) : "default"}
        businessId={businessId}
        initialTrigger={aiConfig?.trigger_type ?? initialTrigger}
        initialName={aiConfig?.name}
        initialMessage={aiConfig?.message_template}
        initialDelayMinutes={aiConfig?.delay_minutes}
      />
    </div>
  )
}
