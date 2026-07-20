"use client"
import { useState, useMemo } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { Sidebar } from "@/components/layout/Sidebar"
import { Topbar } from "@/components/layout/Topbar"
import { BottomNav } from "@/components/layout/BottomNav"
import { SubscriptionBanner } from "@/components/layout/SubscriptionBanner"
import { CommandPalette } from "@/components/ui/CommandPalette"
import { BrandMark } from "@/components/BrandMark"
import { getTerminology } from "@/lib/config/business-types"
import { SubscriptionProvider, isSubscriptionActive } from "@/lib/subscription/context"
import type { SubscriptionStatus } from "@/lib/subscription/context"
import type { Business, BusinessUser } from "@/types/database"
import type { Plan } from "@/lib/auth/plan"

const ONBOARDING_FEATURES = [
  "IA no WhatsApp",
  "Agendamentos automáticos",
  "PIX e cobranças",
  "Automações",
]

function OnboardingBanner() {
  return (
    <div className="flex items-center justify-center min-h-full px-4 py-16">
      <div className="w-full max-w-lg text-center space-y-7 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex justify-center">
          <div className="relative">
            <BrandMark size={80} />
            <div
              className="absolute inset-0 rounded-2xl blur-3xl opacity-40 -z-10"
              style={{ background: "var(--brand-grad)" }}
            />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-ink tracking-tight">
            Configure seu negócio
          </h1>
          <p className="text-ink-3 text-base leading-relaxed max-w-sm mx-auto">
            Leva menos de 3 minutos. Configure o RetornAI para conhecer sua empresa e ativar a IA no WhatsApp.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {ONBOARDING_FEATURES.map((f) => (
            <span
              key={f}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-tint text-brand border border-brand/20"
            >
              {f}
            </span>
          ))}
        </div>

        <div className="flex flex-col items-center gap-3">
          <Link
            href="/setup"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-white font-semibold text-sm glow-pulse transition-opacity hover:opacity-90"
            style={{ background: "var(--brand-grad)" }}
          >
            Configurar agora
            <ChevronRight className="w-4 h-4" />
          </Link>

        </div>
      </div>
    </div>
  )
}

interface DashboardShellProps {
  business: Business
  businessUser: BusinessUser
  children: React.ReactNode
  unreadConversations?: number
  onboarded?: boolean
  plan?: Plan
  subscriptionStatus?: string
}

export function DashboardShell({ business, children, unreadConversations, onboarded = true, plan, subscriptionStatus }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const terminology = useMemo(
    () => getTerminology({ type: business.type, settings: business.settings }),
    [business.type, business.settings]
  )
  // The RetornAI assistant page handles the non-onboarded state itself —
  // let it render so the user can see the AI ball right after registration.
  const skipOnboardingGate =
    pathname === "/dashboard/retornai" ||
    pathname === "/dashboard/account" ||
    (pathname.startsWith("/dashboard/settings") && pathname !== "/dashboard/settings/subscription")

  const status = (subscriptionStatus ?? "trialing") as SubscriptionStatus
  const subValue = useMemo(
    () => ({ isActive: isSubscriptionActive(status), plan: plan ?? "starter", status }),
    [plan, status]
  )

  return (
    <SubscriptionProvider value={subValue}>
      <div className="flex h-screen bg-bg overflow-hidden">
        <Sidebar
          businessType={business.type}
          terminology={terminology}
          unreadConversations={unreadConversations}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          plan={plan ?? "starter"}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar
            businessId={business.id}
            businessName={business.name}
            onMenuClick={() => setSidebarOpen(true)}
          />
          <SubscriptionBanner />
          <main className="flex-1 overflow-y-auto bg-bg relative">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={pathname}
                className="h-full"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              >
                {onboarded || skipOnboardingGate ? children : <OnboardingBanner />}
              </motion.div>
            </AnimatePresence>
          </main>
          <BottomNav
            businessType={business.type as import("@/lib/config/business-types").BusinessType}
            unreadConversations={unreadConversations}
            onMenuClick={() => setSidebarOpen(true)}
          />
        </div>
        <CommandPalette />
      </div>
    </SubscriptionProvider>
  )
}
