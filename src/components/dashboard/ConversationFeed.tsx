"use client";

import { useRouter } from "next/navigation";
import { MessageCircle, Bot } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, getInitials, formatRelative } from "@/lib/utils";
import type { ConversationWithCustomer } from "@/types/database";

interface ConversationFeedProps {
  conversations: ConversationWithCustomer[] | null;
}

function FeedSkeleton() {
  return (
    <Card className="bg-surface border border-border rounded-lg shadow-1">
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="h-4 w-28 bg-surface-2 rounded animate-pulse" />
      </CardHeader>
      <CardContent className="px-0 pb-0 space-y-0">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 py-3 px-4 border-b border-border last:border-0">
            <div className="w-10 h-10 bg-surface-2 rounded-full animate-pulse shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-surface-2 rounded animate-pulse w-2/3" />
              <div className="h-2.5 bg-surface-2 rounded animate-pulse w-full" />
            </div>
            <div className="h-3 w-10 bg-surface-2 rounded animate-pulse" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ConversationFeed({ conversations }: ConversationFeedProps) {
  const router = useRouter();

  if (conversations === null) {
    return <FeedSkeleton />;
  }

  function handleClick(id: string) {
    router.push(`/dashboard/conversations?id=${id}`);
  }

  return (
    <Card className="bg-surface border border-border rounded-lg shadow-1">
      <CardHeader className="flex items-center justify-between px-5 py-4 border-b border-border pb-4 pt-4">
        <CardTitle className="text-base font-bold text-ink flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-info" />
          Conversas Recentes
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center mb-2">
              <MessageCircle className="w-5 h-5 text-ink-3" />
            </div>
            <p className="text-ink-3 text-sm">Nenhuma conversa ainda</p>
          </div>
        ) : (
          <div>
            {conversations.map((conv) => {
              const hasUnread = conv.unread_count > 0;
              const customerName = conv.customer?.full_name ?? "Desconhecido";
              const lastMsg = conv.last_message?.content ?? "";
              const truncated =
                lastMsg.length > 40 ? lastMsg.slice(0, 40) + "…" : lastMsg;

              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => handleClick(conv.id)}
                  className={cn(
                    "w-full flex items-center gap-3 py-3 px-4 border-b border-border last:border-0 hover:bg-surface-2 transition-colors text-left",
                    hasUnread && "border-l-2 border-brand bg-tint/40"
                  )}
                >
                  {/* Avatar with unread indicator */}
                  <div className="relative shrink-0">
                    <Avatar className="w-10 h-10 bg-tint border border-border">
                      <AvatarFallback className="text-sm font-semibold text-brand-2 bg-tint">
                        {getInitials(customerName)}
                      </AvatarFallback>
                    </Avatar>
                    {hasUnread && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-brand border-2 border-surface" />
                    )}
                  </div>

                  {/* Text content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-sm font-semibold text-ink truncate">
                        {customerName}
                      </span>
                      {conv.ai_active && (
                        <Bot className="w-3 h-3 text-brand shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-ink-3 truncate leading-tight">
                      {truncated || "Sem mensagens"}
                    </p>
                  </div>

                  {/* Right side: time + unread count */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="font-mono text-xs text-ink-3 leading-none">
                      {formatRelative(conv.last_message_at)}
                    </span>
                    {hasUnread && (
                      <Badge className="bg-brand text-white text-[10px] font-mono rounded-full min-w-[18px] px-1.5 text-center leading-none h-auto">
                        {conv.unread_count > 99 ? "99+" : conv.unread_count}
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
