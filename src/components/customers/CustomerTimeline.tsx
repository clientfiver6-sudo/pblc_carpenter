"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatRelative } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { WorkItem, Message } from "@/types/database";
import { Calendar, MessageCircle, Wrench, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

interface CustomerTimelineProps {
  customerId: string;
}

type TimelineEvent =
  | { kind: "work_item"; date: string; item: WorkItem }
  | { kind: "message"; date: string; message: Message; conversationId: string };

const WORK_STATUS_LABELS: Record<string, string> = {
  new: "Novo",
  scheduled: "Agendado",
  pending_confirmation: "Aguardando",
  confirmed: "Confirmado",
  in_progress: "Em andamento",
  waiting_customer: "Aguardando cliente",
  waiting_parts: "Aguardando peças",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

// Map work statuses to Badge variants
type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "moss" | "amber" | "warm" | "info";

const WORK_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  new: "info",
  scheduled: "info",
  pending_confirmation: "amber",
  confirmed: "warm",
  in_progress: "info",
  waiting_customer: "amber",
  waiting_parts: "amber",
  completed: "moss",
  cancelled: "destructive",
  no_show: "destructive",
};

function groupByMonth(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
  const map = new Map<string, TimelineEvent[]>();
  for (const ev of events) {
    const key = formatDate(ev.date, "MMMM yyyy");
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  return map;
}

export function CustomerTimeline({ customerId }: CustomerTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = createClient();

      const [workItemsRes, conversationsRes] = await Promise.all([
        supabase
          .from("work_items")
          .select("*")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("conversations")
          .select("id, last_message_at")
          .eq("customer_id", customerId)
          .order("last_message_at", { ascending: false })
          .limit(20),
      ]);

      if (cancelled) return;

      const workItemEvents: TimelineEvent[] = ((workItemsRes.data as WorkItem[] | null) ?? []).map(
        (item) => ({
          kind: "work_item",
          date: item.scheduled_start ?? item.created_at,
          item,
        })
      );

      const convIds = ((conversationsRes.data as Array<{ id: string }> | null) ?? []).map((c) => c.id);

      let messageEvents: TimelineEvent[] = [];
      if (convIds.length > 0) {
        // Fetch the last message per conversation
        const msgPromises = convIds.map((cid) =>
          supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", cid)
            .order("sent_at", { ascending: false })
            .limit(1)
            .single()
            .then((res) => {
              const msgData = res.data as Message | null;
              return msgData
                ? ({
                    kind: "message" as const,
                    date: msgData.sent_at,
                    message: msgData,
                    conversationId: cid,
                  } as TimelineEvent)
                : null;
            })
        );
        const settled = await Promise.all(msgPromises);
        messageEvents = settled.filter((e): e is TimelineEvent => e !== null);
      }

      if (cancelled) return;

      const all = [...workItemEvents, ...messageEvents].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setEvents(all);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg bg-surface-2" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-ink-3">
        <Calendar className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-sm">Nenhum histórico ainda</p>
      </div>
    );
  }

  const grouped = groupByMonth(events);

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([month, monthEvents]) => (
        <div key={month}>
          <p className="text-xs font-semibold text-ink-3 uppercase tracking-widest mb-3 capitalize">
            {month}
          </p>
          <div className="space-y-2">
            {monthEvents.map((ev, idx) => {
              if (ev.kind === "work_item") {
                return (
                  <div
                    key={ev.item.id}
                    onClick={() =>
                      router.push(`/dashboard/work-items/${ev.item.id}`)
                    }
                    className="flex items-start gap-3 pb-5 cursor-pointer group"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      router.push(`/dashboard/work-items/${ev.item.id}`)
                    }
                  >
                    <div className="mt-0.5 w-7 h-7 rounded-full bg-brand ring-2 ring-surface ring-offset-2 ring-offset-border flex items-center justify-center shrink-0">
                      <Wrench className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0 bg-surface border border-border rounded-lg p-3 hover:bg-surface-2 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-ink truncate">
                          {ev.item.title}
                        </p>
                        <ChevronRight className="w-4 h-4 text-ink-3 group-hover:text-ink-2 transition-colors shrink-0 mt-0.5" />
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge
                          variant={WORK_STATUS_VARIANTS[ev.item.status] ?? "secondary"}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {WORK_STATUS_LABELS[ev.item.status] ?? ev.item.status}
                        </Badge>
                        {(ev.item.final_price ?? ev.item.price_estimate) && (
                          <span className="font-mono font-bold text-ink text-xs">
                            {formatCurrency(
                              (ev.item.final_price ?? ev.item.price_estimate ?? 0)
                            )}
                          </span>
                        )}
                        <span className="text-xs text-ink-3">
                          {formatRelative(ev.date)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }

              // Message event
              return (
                <div
                  key={`msg-${ev.conversationId}-${idx}`}
                  className="flex items-start gap-3 pb-5"
                >
                  <div className="mt-0.5 w-7 h-7 rounded-full bg-info ring-2 ring-surface ring-offset-2 ring-offset-border flex items-center justify-center shrink-0">
                    <MessageCircle className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0 bg-surface border border-border rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-ink-2">
                        {ev.message.direction === "inbound"
                          ? "Mensagem recebida"
                          : "Mensagem enviada"}
                      </p>
                      <span className="text-xs text-ink-3">
                        {formatRelative(ev.date)}
                      </span>
                    </div>
                    <p className="text-sm text-ink mt-0.5 truncate">
                      {ev.message.content}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
