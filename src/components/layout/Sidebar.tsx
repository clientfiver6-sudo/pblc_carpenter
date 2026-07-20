"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  Briefcase,
  MessageSquare,
  Zap,
  CreditCard,
  BarChart3,
  CalendarDays,
  X,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Lock,
  Phone,
  ClipboardList,
  Stethoscope,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { getBusinessConfig, type BusinessType, type BusinessTerminology } from "@/lib/config/business-types";
import { BrandMark } from "@/components/BrandMark";
import { spring, backdropVariants, sidebarVariants } from "@/lib/motion";

interface SidebarProps {
  businessType: BusinessType;
  terminology?: BusinessTerminology;
  unreadConversations?: number;
  isOpen?: boolean;
  onClose?: () => void;
  plan?: "starter" | "pro" | "medical";
}

function getWorkItemLabel(type: BusinessType): string {
  switch (type) {
    case "ac_commercial": return "Ordens de Serviço";
    case "cleaning":      return "Agendamentos";
    default:              return "Chamados";
  }
}

const PRO_HREFS = new Set([
  "/dashboard/analytics",
  "/dashboard/approvals",
  "/dashboard/canvas",
  "/dashboard/retornai",
  "/dashboard/settings/skills",
  "/dashboard/automations",
  "/dashboard/team-tasks",
]);

export function Sidebar({
  businessType,
  terminology,
  unreadConversations = 0,
  isOpen = false,
  onClose,
  plan = "starter",
}: SidebarProps) {
  const pathname = usePathname();
  const config = getBusinessConfig(businessType);
  const customerLabel = terminology?.clientPlural ?? config.customerLabel;
  const workItemLabel = terminology?.workItemPlural ?? getWorkItemLabel(businessType);

  const diaADiaItems = plan === "medical" ? [
    { href: "/dashboard",                  label: "Dashboard",          icon: Home,          exact: true },
    { href: "/dashboard/medical",          label: "Medical",            icon: Stethoscope,   exact: true, tag: "MED" },
    { href: "/dashboard/medical/notes",    label: "Prontuários",        icon: ClipboardList, tag: "MED" },
    { href: "/dashboard/medical/anamnese", label: "Ficha dos Pacientes", icon: FileText,      tag: "MED" },
    { href: "/dashboard/calendar",         label: "Atendimentos",       icon: CalendarDays },
    { href: "/dashboard/customers",        label: "Pacientes",          icon: Users },
    { href: "/dashboard/conversations",    label: "Conversas",          icon: MessageSquare, badge: unreadConversations > 0 ? unreadConversations : undefined },
    { href: "/dashboard/payments",         label: "Pagamentos",         icon: CreditCard },
    { href: "/dashboard/staff",            label: "Equipe e Serviços",  icon: Users },
  ] : [
    { href: "/dashboard",              label: "Dashboard",             icon: Home,          exact: true },
    { href: "/dashboard/work-items",   label: workItemLabel,           icon: Briefcase },
    { href: "/dashboard/calendar",     label: "Calendário",            icon: CalendarDays },
    { href: "/dashboard/customers",    label: customerLabel,           icon: Users },
    { href: "/dashboard/conversations", label: "Conversas",            icon: MessageSquare, badge: unreadConversations > 0 ? unreadConversations : undefined },
    { href: "/dashboard/team-tasks",   label: "Instruções de Time",    icon: ClipboardList },
    { href: "/dashboard/payments",     label: "Pagamentos",            icon: CreditCard },
    { href: "/dashboard/staff",        label: "Equipe e Serviços",     icon: Users },
  ];

  const crescimentoItems = [
    { href: "/dashboard/analytics", label: "Análises",         icon: BarChart3 },
    { href: "/dashboard/approvals", label: "Aprovações para IA", icon: ShieldCheck },
    { href: "/dashboard/canvas",    label: "Gráficos com IA",  icon: TrendingUp },
  ];

  const funcoesItems = [
    { href: "/dashboard/settings/skills", label: "Instruções de IA",      icon: Sparkles },
    { href: "/dashboard/automations",     label: "Automações",             icon: Zap },
    { href: "/dashboard/calls",           label: "Retorno de Ligações",    icon: Phone },
  ];

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  function renderNavItem(item: {
    href: string;
    label: string;
    icon: React.ElementType;
    exact?: boolean;
    badge?: number;
    comingSoon?: boolean;
    tag?: string;
  }) {
    const active = isActive(item.href, item.exact);
    const isProLocked = plan === "starter" && PRO_HREFS.has(item.href);

    if (item.comingSoon) {
      return (
        <div key={item.href} className="relative">
          <div className="relative z-10 flex items-center gap-2.5 px-3 py-2 rounded-md text-sm w-full cursor-default text-ink-4">
            <item.icon className="w-[17px] h-[17px] shrink-0 text-ink-4" />
            <span className="flex-1 truncate">{item.label}</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-tint text-brand border border-brand/20 uppercase tracking-wide shrink-0">
              Em breve
            </span>
          </div>
        </div>
      );
    }

    return (
      <div key={item.href} className="relative">
        {/* Shared-element active background pill — slides between items */}
        {active && (
          <motion.div
            layoutId="sidebar-pill"
            className="absolute inset-0 bg-ink rounded-md"
            transition={spring.smooth}
          />
        )}
        <Link
          href={item.href}
          onClick={onClose}
          className={cn(
            "relative z-10 flex items-center gap-2.5 px-3 py-2 rounded-md text-sm w-full",
            "transition-colors duration-100",
            active
              ? "text-white font-semibold"
              : isProLocked
              ? "text-ink-4 hover:bg-surface-2 hover:text-ink-3"
              : "text-ink-2 hover:bg-surface-2 hover:text-ink"
          )}
        >
          <item.icon
            className={cn(
              "w-[17px] h-[17px] shrink-0",
              active ? "text-white" : isProLocked ? "text-ink-4" : "text-ink-3"
            )}
          />
          <span className="flex-1 truncate">{item.label}</span>
          {isProLocked && (
            <span className="flex items-center gap-1 shrink-0">
              <span className="text-[9px] font-semibold text-ink-4 uppercase tracking-wide">Pro</span>
              <Lock className="w-3 h-3 text-ink-4" />
            </span>
          )}
          {!isProLocked && item.badge !== undefined && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand text-white min-w-[18px] text-center leading-tight shrink-0">
              {item.badge > 99 ? "99+" : item.badge}
            </span>
          )}
          {item.tag && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-info/15 text-info border border-info/30 uppercase tracking-wide shrink-0">
              {item.tag}
            </span>
          )}
        </Link>
      </div>
    );
  }

  const sidebarContent = (
    <aside className="w-64 h-full bg-surface border-r border-border flex flex-col flex-shrink-0">
      {/* Close button — mobile only */}
      <motion.button
        className="md:hidden absolute top-4 right-4 text-ink-3 hover:text-ink"
        onClick={onClose}
        type="button"
        aria-label="Fechar menu"
        whileTap={{ scale: 0.9 }}
        transition={spring.snappy}
      >
        <X className="w-4 h-4" />
      </motion.button>

      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2.5 mb-2">
          <BrandMark size={32} />
          <span className="font-bold text-lg text-ink tracking-tight">
            retorn<span className="text-brand">.ai</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-base shrink-0 leading-none">{config.icon}</span>
          <span className="text-ink-3 text-xs truncate">{config.displayName}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0">
        {/* RetornAI assistant — gradient CTA */}
        <div className="pt-2 pb-3">
          <div className="relative">
            {isActive("/dashboard/retornai") && (
              <motion.div
                layoutId="sidebar-pill"
                className="absolute inset-0 rounded-lg opacity-0"
                transition={spring.smooth}
              />
            )}
            <motion.div whileHover={{ opacity: 0.92 }} whileTap={{ scale: 0.97 }} transition={spring.snappy}>
              <Link
                href="/dashboard/retornai"
                onClick={onClose}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold w-full text-white"
                style={{ background: "var(--brand-grad)" }}
              >
                <span className="w-5 h-5 flex items-center justify-center text-base font-bold shrink-0">✦</span>
                <span className="flex-1 truncate">RetornAI</span>
              </Link>
            </motion.div>
          </div>
        </div>

        <p className="text-ink-4 text-[10.5px] font-semibold uppercase tracking-widest px-2 pt-1 pb-1.5">Dia a dia</p>
        {diaADiaItems.map(renderNavItem)}

        <p className="text-ink-4 text-[10.5px] font-semibold uppercase tracking-widest px-2 pt-5 pb-1.5">Crescimento</p>
        {crescimentoItems.map(renderNavItem)}

        <p className="text-ink-4 text-[10.5px] font-semibold uppercase tracking-widest px-2 pt-5 pb-1.5">Funções do RetornAI</p>
        {funcoesItems.map(renderNavItem)}
      </nav>
    </aside>
  );

  return (
    <>
      {/* ── Desktop sidebar — always visible ─────────────────────────────── */}
      <div className="hidden md:flex h-full">
        {sidebarContent}
      </div>

      {/* ── Mobile sidebar — spring slide-in ─────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              variants={backdropVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              onClick={onClose}
            />
            <motion.div
              className="fixed inset-y-0 left-0 z-50 md:hidden"
              variants={sidebarVariants}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
