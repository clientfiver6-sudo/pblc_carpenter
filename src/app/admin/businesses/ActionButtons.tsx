"use client"

import { useTransition } from "react"
import { approveBusiness, suspendBusiness } from "@/app/admin/actions"

export function ActionButtons({ id, onboarded }: { id: string; onboarded: boolean }) {
  const [pending, start] = useTransition()

  return (
    <div className="flex items-center gap-2">
      {!onboarded ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => approveBusiness(id))}
          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-moss/10 text-moss hover:bg-moss/20 transition-colors disabled:opacity-40 border border-moss/20"
        >
          Aprovar
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => suspendBusiness(id))}
          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-danger/8 text-danger hover:bg-danger/15 transition-colors disabled:opacity-40 border border-danger/20"
        >
          Suspender
        </button>
      )}
    </div>
  )
}
