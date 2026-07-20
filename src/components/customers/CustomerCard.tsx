"use client";

import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatCurrency, formatPhone, getInitials } from "@/lib/utils";
import type { Customer } from "@/types/database";
import type { BusinessType } from "@/lib/config/business-types";
import { differenceInDays } from "date-fns";
import { MessageSquare, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface CustomerCardProps {
  customer: Customer;
  businessType: BusinessType;
  onClick?: () => void;
}

const STATUS_DOT: Record<string, string> = {
  active: "bg-moss",
  inactive: "bg-border",
  blocked: "bg-danger",
};

export function CustomerCard({ customer, onClick }: CustomerCardProps) {
  const router = useRouter();
  const [openingConv, setOpeningConv] = useState(false);

  async function handleSendMessage(e: React.MouseEvent) {
    e.stopPropagation();
    setOpeningConv(true);
    try {
      const res = await fetch("/api/conversations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: customer.id }),
      });
      const data = await res.json() as { conversationId?: string };
      if (data.conversationId) {
        router.push(`/dashboard/conversations?id=${data.conversationId}`);
      }
    } finally {
      setOpeningConv(false);
    }
  }

  const daysSinceVisit = customer.last_visit_at
    ? differenceInDays(new Date(), new Date(customer.last_visit_at))
    : null;

  const lastVisitLabel =
    daysSinceVisit === null
      ? "Nunca"
      : daysSinceVisit === 0
      ? "Hoje"
      : daysSinceVisit === 1
      ? "Ontem"
      : `Há ${daysSinceVisit} dias`;

  const isOverdue = daysSinceVisit !== null && daysSinceVisit > 60;

  const ticketMedio =
    customer.visit_count > 0
      ? customer.total_spent / customer.visit_count
      : 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 px-4 py-3 rounded-lg border border-border bg-surface cursor-pointer transition-[color,background-color,box-shadow] duration-150 ease-brand-out",
        "hover:bg-surface-2 hover:shadow-sm"
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
    >
      {/* Avatar + status dot */}
      <div className="relative shrink-0">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-tint text-brand-2 text-sm font-semibold">
            {getInitials(customer.full_name)}
          </AvatarFallback>
        </Avatar>
        <span
          className={cn(
            "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-surface",
            STATUS_DOT[customer.status] ?? "bg-border"
          )}
        />
      </div>

      {/* Middle: name + phone + tags */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink truncate leading-tight">
          {customer.full_name}
        </p>
        {customer.phone_number && (
          <p className="font-mono text-xs text-ink-3 mt-0.5">
            {formatPhone(customer.phone_number)}
          </p>
        )}
        {customer.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {customer.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-2 text-ink-3 border border-border"
              >
                {tag}
              </span>
            ))}
            {customer.tags.length > 3 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-2 text-ink-3 border border-border">
                +{customer.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right: last visit + ticket médio + send message */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex flex-col items-end gap-1 text-right">
          <p
            className={cn(
              "font-mono text-xs",
              isOverdue ? "text-danger" : "text-ink-3"
            )}
          >
            {lastVisitLabel}
          </p>
          {ticketMedio > 0 && (
            <p className="font-mono text-xs font-bold text-ink">
              {formatCurrency(ticketMedio * 100)}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleSendMessage}
          disabled={openingConv}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-surface-2 text-ink-3 hover:text-brand hover:border-brand/30 hover:bg-tint text-xs font-medium transition-colors disabled:opacity-50 shrink-0"
          title="Enviar mensagem"
        >
          {openingConv
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <MessageSquare className="w-3.5 h-3.5" />
          }
          <span className="hidden sm:inline">Mensagem</span>
        </button>
      </div>
    </div>
  );
}
