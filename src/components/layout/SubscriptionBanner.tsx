"use client"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { useSubscription } from "@/lib/subscription/context"
import { usePathname } from "next/navigation"

export function SubscriptionBanner() {
  const { isActive } = useSubscription()
  const pathname = usePathname()

  if (isActive) return null
  // Settings/account pages are where users fix this — no need to interrupt
  if (pathname.startsWith("/dashboard/settings") || pathname.startsWith("/dashboard/account")) return null

  return (
    <div className="bg-danger/10 border-b border-danger/20 px-4 py-2.5 flex items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-2 text-sm text-danger">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span className="line-clamp-1">
          Assinatura inativa — acesso limitado a visualização apenas.
        </span>
      </div>
      <Link
        href="/dashboard/settings/subscription"
        className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border border-danger/30 text-danger hover:bg-danger/10 transition-colors"
      >
        Renovar plano
      </Link>
    </div>
  )
}
