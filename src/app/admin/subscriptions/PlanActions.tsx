"use client"

import { useTransition } from "react"
import { setBusinessPlan, setSubscriptionStatus } from "@/app/admin/actions"

export function PlanActions({
  id,
  plan,
  status,
}: {
  id: string
  plan: string
  status: string
}) {
  const [pending, start] = useTransition()
  const isCancelled = status === "cancelled"

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {isCancelled ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => setSubscriptionStatus(id, "active"))}
          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-moss/10 text-moss hover:bg-moss/20 border border-moss/20 transition-colors disabled:opacity-40"
        >
          Reativar
        </button>
      ) : (
        <>
          {plan !== "starter" && (
            <button type="button" disabled={pending} onClick={() => start(() => setBusinessPlan(id, "starter"))}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-surface-2 text-ink-2 hover:bg-border border border-border transition-colors disabled:opacity-40">
              → Starter
            </button>
          )}
          {plan !== "pro" && (
            <button type="button" disabled={pending} onClick={() => start(() => setBusinessPlan(id, "pro"))}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-brand/8 text-brand hover:bg-brand/15 border border-brand/20 transition-colors disabled:opacity-40">
              → Pro
            </button>
          )}
          {plan !== "medical" && (
            <button type="button" disabled={pending} onClick={() => start(() => setBusinessPlan(id, "medical"))}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-teal-500/10 text-teal-600 hover:bg-teal-500/20 border border-teal-500/20 transition-colors disabled:opacity-40">
              → Medical
            </button>
          )}
          <button type="button" disabled={pending} onClick={() => start(() => setSubscriptionStatus(id, "cancelled"))}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-danger/8 text-danger hover:bg-danger/15 border border-danger/20 transition-colors disabled:opacity-40">
            Cancelar
          </button>
        </>
      )}
    </div>
  )
}
