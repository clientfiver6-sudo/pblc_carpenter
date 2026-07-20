"use client";

import Link from "next/link";
import { Calendar, Users, MessageCircle, CreditCard, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
          "flex items-center gap-3 p-3 rounded-md border border-border bg-surface",
          "hover:bg-surface-2 hover:border-border-2 hover:-translate-y-0.5 transition-[color,background-color,border-color,transform] duration-150 ease-brand-out active:scale-[0.98] cursor-pointer"
        )}
      >
        <div
          className={cn(
            "w-9 h-9 rounded-md flex items-center justify-center shrink-0 transition-colors",
            iconBg
          )}
        >
          <Icon className={cn("w-4 h-4", iconColor)} />
        </div>
        <span className="text-sm font-semibold text-ink leading-tight flex-1">
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
    <Card className="bg-surface border border-border rounded-lg shadow-1 p-5">
      <CardHeader className="p-0 mb-3">
        <CardTitle className="text-sm font-bold text-ink">
          Ações Rápidas
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-1 gap-2">
          {actions.map((action) => (
            <ActionItem key={action.href} {...action} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
