"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Building2, CreditCard, TrendingUp } from "lucide-react"
import type { LucideIcon } from "lucide-react"

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin",               label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/businesses",    label: "Empresas",    icon: Building2 },
  { href: "/admin/subscriptions", label: "Assinaturas", icon: CreditCard },
  { href: "/admin/financial",     label: "Financeiro",  icon: TrendingUp },
]

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) {
  const pathname = usePathname()
  const isActive = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href)

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
        isActive
          ? "bg-brand/8 text-brand"
          : "text-ink-3 hover:text-ink hover:bg-surface-2"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </Link>
  )
}

export function AdminNav() {
  return (
    <>
      {NAV.map(({ href, label, icon }) => (
        <NavLink key={href} href={href} label={label} icon={icon} />
      ))}
    </>
  )
}
