"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  Briefcase,
  MessageSquare,
  Users,
  MoreHorizontal,
  CalendarDays,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { BusinessType } from "@/lib/config/business-types"

function getWorkItemLabel(type: BusinessType): string {
  switch (type) {
    case "ac_commercial": return "OS"
    case "cleaning":      return "Agenda"
    default:              return "Chamados"
  }
}

interface BottomNavProps {
  businessType: BusinessType
  unreadConversations?: number
  onMenuClick: () => void
}

export function BottomNav({ businessType, unreadConversations = 0, onMenuClick }: BottomNavProps) {
  const pathname = usePathname()

  const tabs = [
    {
      href: "/dashboard",
      label: "Início",
      icon: Home,
      exact: true,
    },
    {
      href: "/dashboard/calendar",
      label: "Agenda",
      icon: CalendarDays,
    },
    {
      href: "/dashboard/conversations",
      label: "Conversas",
      icon: MessageSquare,
      badge: unreadConversations > 0 ? unreadConversations : undefined,
    },
    {
      href: "/dashboard/customers",
      label: "Clientes",
      icon: Users,
    },
  ]

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + "/")
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-surface/95 backdrop-blur-xl border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-end justify-around px-1 pt-2 pb-2">
        {tabs.map(({ href, label, icon: Icon, exact, badge }) => {
          const active = isActive(href, exact)
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 flex-1 min-h-[52px] justify-center relative"
            >
              <div className="relative flex items-center justify-center">
                {active && (
                  <span
                    className="absolute inset-0 -mx-3 -my-1 rounded-full"
                    style={{ background: "rgba(232,93,31,0.12)" }}
                  />
                )}
                <Icon
                  className={cn(
                    "relative w-6 h-6 transition-all duration-150",
                    active ? "text-brand scale-110" : "text-ink-4"
                  )}
                  strokeWidth={active ? 2.5 : 1.75}
                />
                {badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center px-1 leading-none z-10">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] leading-none transition-all duration-150",
                  active ? "font-bold text-brand" : "font-medium text-ink-4"
                )}
              >
                {label}
              </span>
            </Link>
          )
        })}

        {/* More — opens sidebar drawer */}
        <button
          type="button"
          onClick={onMenuClick}
          className="flex flex-col items-center gap-1 flex-1 min-h-[52px] justify-center"
        >
          <MoreHorizontal className="w-6 h-6 text-ink-4" strokeWidth={1.75} />
          <span className="text-[10px] font-medium leading-none text-ink-4">Menu</span>
        </button>
      </div>
    </nav>
  )
}
