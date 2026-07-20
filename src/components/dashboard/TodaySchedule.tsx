"use client";

import { useState } from "react";
import { Calendar, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { getBusinessConfig, type BusinessType } from "@/lib/config/business-types";
import { createClient } from "@/lib/supabase/client";
import type { WorkItemWithRelations, WorkItemStatus } from "@/types/database";

interface TodayScheduleProps {
  items: WorkItemWithRelations[] | null;
  businessType: BusinessType;
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "moss" | "amber" | "warm" | "info";

const STATUS_CONFIG: Record<
  WorkItemStatus,
  { label: string; variant: BadgeVariant }
> = {
  new: {
    label: "Novo",
    variant: "secondary",
  },
  scheduled: {
    label: "Agendado",
    variant: "info",
  },
  pending_confirmation: {
    label: "Aguardando",
    variant: "amber",
  },
  confirmed: {
    label: "Confirmado",
    variant: "info",
  },
  in_progress: {
    label: "Em Andamento",
    variant: "warm",
  },
  waiting_customer: {
    label: "Aguard. Cliente",
    variant: "amber",
  },
  waiting_parts: {
    label: "Aguard. Peças",
    variant: "amber",
  },
  completed: {
    label: "Concluído",
    variant: "moss",
  },
  cancelled: {
    label: "Cancelado",
    variant: "destructive",
  },
  no_show: {
    label: "Não Compareceu",
    variant: "destructive",
  },
};

const STATUS_TRANSITIONS: Partial<Record<WorkItemStatus, WorkItemStatus>> = {
  new: "confirmed",
  pending_confirmation: "confirmed",
  confirmed: "in_progress",
  in_progress: "completed",
};

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "--:--";
  return formatDate(dateStr, "HH:mm");
}

interface WorkItemRowProps {
  item: WorkItemWithRelations;
  onStatusChange: (id: string, status: WorkItemStatus) => Promise<void>;
}

function WorkItemRow({ item, onStatusChange }: WorkItemRowProps) {
  const [loading, setLoading] = useState(false);
  const statusConf = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.new;
  const nextStatus = STATUS_TRANSITIONS[item.status];

  const nextStatusLabel: Partial<Record<WorkItemStatus, string>> = {
    confirmed: "Confirmar",
    in_progress: "Iniciar",
    completed: "Concluir",
  };

  async function handleAdvance() {
    if (!nextStatus) return;
    setLoading(true);
    try {
      await onStatusChange(item.id, nextStatus);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-4 py-3.5 px-5 border-b border-border last:border-0 hover:bg-surface-2 transition-colors group">
      {/* Time */}
      <div className="w-12 shrink-0">
        <span className="font-mono text-sm font-bold text-ink leading-tight">
          {formatTime(item.scheduled_start)}
        </span>
      </div>

      {/* Staff avatar */}
      <Avatar className="w-9 h-9 shrink-0 bg-tint border border-border">
        <AvatarFallback className="text-sm font-semibold text-brand-2 bg-tint">
          {item.assigned_staff ? getInitials(item.assigned_staff.name) : "?"}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink truncate leading-tight">
          {item.customer?.full_name ?? "Cliente não informado"}
        </p>
        <p className="text-xs text-ink-2 truncate mt-0.5">
          {item.service?.name ?? item.title}
        </p>
      </div>

      {/* Status badge */}
      <Badge
        className="text-[10px] font-mono px-2 py-0.5 shrink-0"
        variant={statusConf.variant}
      >
        {statusConf.label}
      </Badge>

      {/* Quick action */}
      {nextStatus && nextStatusLabel[nextStatus] && (
        <Button
          size="sm"
          variant="ghost"
          disabled={loading}
          onClick={handleAdvance}
          className={cn(
            "h-6 px-2 text-[10px] font-mono shrink-0 opacity-0 group-hover:opacity-100 transition-opacity",
            "text-brand hover:bg-tint"
          )}
        >
          {loading ? "..." : nextStatusLabel[nextStatus]}
          <ChevronRight className="w-3 h-3 ml-0.5" />
        </Button>
      )}
    </div>
  );
}

function ScheduleSkeleton() {
  return (
    <Card className="bg-surface border border-border rounded-lg shadow-1">
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="h-4 w-32 bg-surface-2 rounded animate-pulse" />
      </CardHeader>
      <CardContent className="px-0 pb-0 space-y-0">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 py-3.5 px-5 border-b border-border last:border-0">
            <div className="w-12 h-4 bg-surface-2 rounded animate-pulse" />
            <div className="w-9 h-9 bg-surface-2 rounded-full animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-surface-2 rounded animate-pulse w-3/4" />
              <div className="h-2.5 bg-surface-2 rounded animate-pulse w-1/2" />
            </div>
            <div className="h-5 w-20 bg-surface-2 rounded animate-pulse" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function TodaySchedule({ items, businessType }: TodayScheduleProps) {
  const [localItems, setLocalItems] = useState<WorkItemWithRelations[] | null>(items);
  const config = getBusinessConfig(businessType);

  if (localItems === null) {
    return <ScheduleSkeleton />;
  }

  const sorted = [...localItems].sort((a, b) => {
    if (!a.scheduled_start) return 1;
    if (!b.scheduled_start) return -1;
    return new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime();
  });

  async function handleStatusChange(id: string, status: WorkItemStatus) {
    const supabase = createClient();
    const { error } = await supabase
      .from("work_items")
      .update({ status } as never)
      .eq("id", id);

    if (!error) {
      setLocalItems((prev) =>
        prev
          ? prev.map((item) => (item.id === id ? { ...item, status } : item))
          : prev
      );
    }
  }

  return (
    <Card className="bg-surface border border-border rounded-lg shadow-1">
      <CardHeader className="flex items-center justify-between px-5 py-4 border-b border-border pb-4 pt-4">
        <CardTitle className="text-base font-bold text-ink flex items-center gap-2">
          <Calendar className="w-4 h-4 text-brand" />
          {config.workItemLabel} de Hoje
          {localItems.length > 0 && (
            <span className="font-mono text-ink-3 text-xs ml-auto">
              {localItems.length} {localItems.length === 1 ? "item" : "itens"}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-5">
            <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center mb-3">
              <Calendar className="w-6 h-6 text-ink-3" />
            </div>
            <p className="text-ink-3 text-sm">
              Nenhum{config.workItemSingular ? ` ${config.workItemSingular.toLowerCase()}` : ""} hoje
            </p>
            <p className="text-ink-4 text-xs mt-1">
              Aproveite para organizar a agenda de amanhã
            </p>
          </div>
        ) : (
          <div>
            {sorted.map((item) => (
              <WorkItemRow
                key={item.id}
                item={item}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
