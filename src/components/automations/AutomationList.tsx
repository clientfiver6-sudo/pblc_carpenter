"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { AutomationCard } from "@/components/automations/AutomationCard"
import { deleteAutomation } from "@/lib/automations/actions"
import type { Automation } from "@/types/database"

interface AutomationListProps {
  automations: Automation[]
}

export function AutomationList({ automations }: AutomationListProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteAutomation(id)
        router.refresh()
      } catch (err) {
        console.error("[AutomationList] deleteAutomation error:", err)
      }
    })
  }

  return (
    <div className="space-y-3">
      {automations.map((automation) => (
        <AutomationCard
          key={automation.id}
          automation={automation}
          onDelete={handleDelete}
        />
      ))}
    </div>
  )
}
