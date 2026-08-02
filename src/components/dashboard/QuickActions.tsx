import Link from "next/link";
import { Calendar, Users, MessageCircle, CreditCard, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBusinessConfig, type BusinessType } from "@/lib/config/business-types";

interface QuickActionsProps {
  businessType: BusinessType;
}

interface ActionItemProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  iconColor: string;
  iconBg: string;
}

function ActionItem({ href, icon: Icon, label, iconColor, iconBg }: ActionItemProps) {
  return (
    <Link href={href} className="block group">
      <div
        className={cn(
          "flex items-center gap-3.5 p-4 rounded-xl border border-border/75 bg-white shadow-sm",
          "hover:bg-surface-2 hover:border-brand/20 hover:-translate-y-0.5 transition-all duration-200 ease-brand-out active:scale-[0.98] cursor-pointer"
        )}
      >
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-inner",
            iconBg
          )}
        >
          <Icon className={cn("w-5 h-5", iconColor)} />
        </div>
        <span className="text-xs sm:text-sm font-bold text-ink leading-tight flex-1">
          {label}
        </span>
        <ChevronRight className="text-ink-4 group-hover:text-ink-3 w-4 h-4 ml-auto transition-colors" />
      </div>
    </Link>
  );
}

function getNewWorkItemLabel(businessType: BusinessType): string {
  const config = getBusinessConfig(businessType);
  return `Novo(a) ${config.workItemSingular}`;
}

export function QuickActions({ businessType }: QuickActionsProps) {
  const newItemLabel = getNewWorkItemLabel(businessType);

  const actions: ActionItemProps[] = [
    {
      href: "/dashboard/work-items/new",
      icon: Calendar,
      label: newItemLabel,
      iconColor: "text-brand",
      iconBg: "bg-tint",
    },
    {
      href: "/dashboard/customers/new",
      icon: Users,
      label: "Novo Cliente",
      iconColor: "text-info",
      iconBg: "bg-info/10",
    },
    {
      href: "/dashboard/conversations",
      icon: MessageCircle,
      label: "Enviar Mensagem",
      iconColor: "text-brand",
      iconBg: "bg-tint",
    },
    {
      href: "/dashboard/payments",
      icon: CreditCard,
      label: "Cobrar",
      iconColor: "text-warning",
      iconBg: "bg-warning/10",
    },
  ];

  return (
    <div className="bg-white border border-border/75 rounded-2xl shadow-sm p-6 space-y-4">
      <h3 className="text-xs font-extrabold text-ink-3 uppercase tracking-wider">
        Ações Rápidas
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.map((action) => (
          <ActionItem key={action.href} {...action} />
        ))}
      </div>
    </div>
  );
}
