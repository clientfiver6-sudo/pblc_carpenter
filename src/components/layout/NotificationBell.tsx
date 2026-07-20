"use client";

import { useRouter } from "next/navigation";
import {
  Bell,
  MessageSquare,
  CalendarCheck,
  CreditCard,
  Clock,
  Zap,
  CheckCheck,
  BellOff,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import type { Notification, NotificationType } from "@/types/database";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNotificationIcon(type: string) {
  switch (type as NotificationType) {
    case "new_message":
      return <MessageSquare className="w-4 h-4 text-moss" />;
    case "new_work_item":
      return <CalendarCheck className="w-4 h-4 text-brand" />;
    case "payment_received":
      return <CreditCard className="w-4 h-4 text-moss" />;
    case "payment_due":
      return <CreditCard className="w-4 h-4 text-warning" />;
    case "work_item_overdue":
      return <Clock className="w-4 h-4 text-warning" />;
    case "automation_sent":
      return <Zap className="w-4 h-4 text-warning" />;
    default:
      return <Bell className="w-4 h-4 text-brand" />;
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "agora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

// ---------------------------------------------------------------------------
// NotificationItem
// ---------------------------------------------------------------------------

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
  onNavigate: (link: string | null, id: string) => void;
}

function NotificationItem({ notification, onNavigate }: NotificationItemProps) {
  const isUnread = !notification.read;

  return (
    <button
      type="button"
      onClick={() => onNavigate(notification.link, notification.id)}
      className={[
        "w-full text-left px-4 py-3 flex gap-3 hover:bg-surface-2 transition-colors",
        isUnread ? "bg-surface" : "bg-transparent",
      ].join(" ")}
    >
      {/* Icon */}
      <div className="mt-0.5 shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-tint">
        {getNotificationIcon(notification.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={[
              "text-sm leading-tight truncate min-w-0",
              isUnread ? "text-ink font-medium" : "text-ink-3",
            ].join(" ")}
          >
            {notification.title}
          </p>
          <span className="text-xs font-mono text-ink-3 shrink-0 mt-0.5">
            {relativeTime(notification.created_at)}
          </span>
        </div>
        {notification.body && (
          <p className="text-xs text-ink-3 mt-0.5 line-clamp-2 leading-relaxed">
            {notification.body}
          </p>
        )}
      </div>

      {/* Unread dot */}
      {isUnread && (
        <div className="mt-2 shrink-0 w-1.5 h-1.5 rounded-full bg-brand" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// NotificationBell
// ---------------------------------------------------------------------------

interface NotificationBellProps {
  businessId: string;
  unreadConversations?: number;
}

export function NotificationBell({ businessId, unreadConversations = 0 }: NotificationBellProps) {
  const router = useRouter();
  const { notifications, unreadCount, markRead, markAllRead, loading } =
    useNotifications(businessId);

  // The bell badge reflects both unread notifications and unread conversations.
  // Unread conversations are shown as a single live count, not individual rows.
  const badgeCount = unreadCount + unreadConversations;

  function handleNavigate(link: string | null, id: string) {
    markRead(id);
    if (link) {
      router.push(link);
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center rounded-lg text-ink-3 hover:text-ink hover:bg-surface-2 transition-[color,background-color,transform] duration-150 ease-brand-out active:scale-[0.97] relative"
          title="Notificações"
          aria-label={`Notificações${badgeCount > 0 ? ` (${badgeCount} não lidas)` : ""}`}
        >
          <Bell className="w-4 h-4" />

          {/* Unread badge — notifications + unread conversations */}
          {badgeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-brand text-ink text-[9px] font-mono font-bold px-0.5 leading-none">
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          )}

          {/* Animated new-notification dot (shows when unread > 0, no number overlap) */}
          {badgeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand animate-ping opacity-75 pointer-events-none" />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(calc(100vw-24px),380px)] p-0 bg-surface border border-border shadow-3 rounded-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-ink">Notificações</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllRead}
              className="h-7 px-2 text-xs text-brand hover:text-brand-2 hover:bg-surface-2 gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Marcar todas lidas
            </Button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
          {/* Unread conversations — single live count, not individual rows */}
          {unreadConversations > 0 && (
            <button
              type="button"
              onClick={() => router.push("/dashboard/conversations")}
              className="w-full text-left px-4 py-3 flex gap-3 hover:bg-surface-2 transition-colors"
            >
              <div className="mt-0.5 shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-tint">
                <MessageSquare className="w-4 h-4 text-moss" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-tight text-ink font-medium">
                  {unreadConversations}{" "}
                  {unreadConversations === 1 ? "conversa não lida" : "conversas não lidas"}
                </p>
                <p className="text-xs text-ink-3 mt-0.5">Toque para ver a caixa de entrada</p>
              </div>
              <div className="mt-2 shrink-0 w-1.5 h-1.5 rounded-full bg-brand" />
            </button>
          )}

          {loading ? (
            <div className="px-4 py-8 text-center">
              <div className="w-5 h-5 border-2 border-border border-t-brand rounded-full animate-spin mx-auto" />
            </div>
          ) : notifications.length === 0 ? (
            unreadConversations > 0 ? null : (
              <div className="px-4 py-10 text-center flex flex-col items-center gap-2">
                <BellOff className="w-8 h-8 text-border" />
                <p className="text-sm text-ink-3">Nenhuma notificação</p>
              </div>
            )
          ) : (
            notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRead={markRead}
                onNavigate={handleNavigate}
              />
            ))
          )}
        </div>

        {/* Footer — only show when there are notifications */}
        {notifications.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border text-center">
            <span className="text-xs font-mono text-ink-3">
              Últimas {notifications.length} notificações
            </span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
