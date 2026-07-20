"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, Search, Settings, LogOut, UserCircle, CreditCard, FileText } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";
import { signOut } from "@/lib/auth/actions";
import { spring } from "@/lib/motion";

function getPageTitle(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1];

  const titles: Record<string, string> = {
    dashboard: "Retorn.AI",
    "work-items": "Serviços",
    customers: "Clientes",
    conversations: "Conversas",
    automations: "Automações",
    payments: "Pagamentos",
    canvas: "Canvas IA",
    staff: "Equipe",
    settings: "Configurações",
    new: "Novo",
  };

  return titles[last] ?? "Dashboard";
}

interface TopbarProps {
  businessId: string;
  businessName: string;
  onMenuClick?: () => void;
  unreadConversations?: number;
}

export function Topbar({ businessId, businessName, onMenuClick, unreadConversations = 0 }: TopbarProps) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileOpen) return;
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [profileOpen]);

  return (
    <header
      className="h-14 glass-subtle px-7 flex items-center justify-between shrink-0 overflow-visible sticky top-0"
      style={{ zIndex: 40 }}
    >
      <div className="flex items-center gap-2">
        <motion.button
          className="md:hidden p-2.5 rounded text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          onClick={onMenuClick}
          type="button"
          aria-label="Menu"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          transition={spring.snappy}
        >
          <Menu className="w-5 h-5" />
        </motion.button>
        {/* Title cross-fades when the route changes */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.h1
            key={title}
            className="text-ink font-bold text-lg tracking-tight"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {title}
          </motion.h1>
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2">
        {/* Desktop: search pill — hidden on mobile */}
        <motion.button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="hidden sm:flex items-center gap-1.5 px-3 h-8 rounded-md border border-border bg-surface text-sm text-ink-4 hover:border-brand/50 hover:text-ink-3 transition-colors duration-200"
          aria-label="Buscar"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.97 }}
          transition={spring.snappy}
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="w-40 text-left text-sm">Buscar...</span>
        </motion.button>
        {/* Mobile: icon-only search */}
        <motion.button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="sm:hidden p-2 rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
          aria-label="Buscar"
          whileTap={{ scale: 0.92 }}
          transition={spring.snappy}
        >
          <Search className="w-5 h-5" />
        </motion.button>

        <GlobalSearch
          businessId={businessId}
          open={searchOpen}
          onOpenChange={setSearchOpen}
        />

        <div className="min-h-[44px] min-w-[44px] flex items-center justify-center">
          <NotificationBell businessId={businessId} unreadConversations={unreadConversations} />
        </div>

        {/* Profile avatar */}
        <div className="relative" ref={profileRef}>
          <motion.button
            type="button"
            onClick={() => setProfileOpen((v) => !v)}
            className="w-8 h-8 rounded-full ring-2 ring-transparent hover:ring-brand/40 transition-[box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-brand/50"
            aria-label="Perfil"
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.93 }}
            transition={spring.snappy}
          >
            <Avatar className="w-8 h-8">
              <AvatarFallback className="text-[11px] font-bold text-brand-2 bg-tint">
                {getInitials(businessName)}
              </AvatarFallback>
            </Avatar>
          </motion.button>

          <AnimatePresence>
          {profileOpen && (
            <motion.div
              className="absolute right-0 top-full mt-2 w-52 bg-surface border border-border rounded-xl shadow-xl py-1.5 z-[100] origin-top-right"
              initial={{ opacity: 0, scale: 0.94, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -2 }}
              transition={spring.snappy}
            >
              <p className="px-3 py-1.5 text-[11px] text-ink-4 truncate font-medium">{businessName}</p>
              <div className="border-t border-border my-1 mx-2" />
              <Link
                href="/dashboard/account"
                onClick={() => setProfileOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-sm transition-colors mx-1 rounded-md",
                  pathname.startsWith("/dashboard/account") ? "bg-surface-2 text-ink font-medium" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                )}
              >
                <UserCircle className="w-4 h-4 text-ink-3 shrink-0" />
                Minha conta
              </Link>
              <Link
                href="/dashboard/account/documents"
                onClick={() => setProfileOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-sm transition-colors mx-1 rounded-md",
                  pathname === "/dashboard/account/documents" ? "bg-surface-2 text-ink font-medium" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                )}
              >
                <FileText className="w-4 h-4 text-ink-3 shrink-0" />
                Documentos
              </Link>
              <Link
                href="/dashboard/settings/subscription"
                onClick={() => setProfileOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-sm transition-colors mx-1 rounded-md",
                  pathname === "/dashboard/settings/subscription" ? "bg-surface-2 text-ink font-medium" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                )}
              >
                <CreditCard className="w-4 h-4 text-ink-3 shrink-0" />
                Plano & Assinatura
              </Link>
              <Link
                href="/dashboard/settings"
                onClick={() => setProfileOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-sm transition-colors mx-1 rounded-md",
                  pathname.startsWith("/dashboard/settings") && pathname !== "/dashboard/settings/subscription" ? "bg-surface-2 text-ink font-medium" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                )}
              >
                <Settings className="w-4 h-4 text-ink-3 shrink-0" />
                Configurações e Suporte
              </Link>
              <div className="border-t border-border my-1 mx-2" />
              <button
                type="button"
                onClick={() => signOut()}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-ink-2 hover:bg-surface-2 hover:text-danger transition-colors rounded-md mx-1 w-[calc(100%-8px)]"
              >
                <LogOut className="w-4 h-4 text-ink-3 shrink-0" />
                Sair da conta
              </button>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
