"use client"

import { useEffect, useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, formatRelative, getInitials } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { ConversationWithCustomer } from "@/types/database"
import { Bot, Search, MessageCircle } from "lucide-react"
import { getStateLabel, getStateColor } from "@/lib/ai/trajectory"

type FilterTab = "all" | "unread" | "payment_pending"

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "unread", label: "Não lidas" },
  { value: "payment_pending", label: "Aguardando pagamento" },
]

interface ConversationListProps {
  businessId: string
  selectedId?: string
  onSelect: (id: string) => void
}

export function ConversationList({ businessId, selectedId, onSelect }: ConversationListProps) {
  const [conversations, setConversations] = useState<ConversationWithCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<FilterTab>("all")

  useEffect(() => {
    const supabase = createClient()

    async function fetchConversations() {
      setLoading(true)
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          *,
          customer:customers(*),
          last_message:messages(id, content, direction, sent_at)
        `)
        .eq("business_id", businessId)
        .eq("channel", "whatsapp")
        .order("last_message_at", { ascending: false })
        .limit(100)

      if (!error && data) {
        // last_message is returned as array, pick first
        const mapped = (data as unknown as Array<Record<string, unknown>>).map((conv) => ({
          ...conv,
          last_message: Array.isArray(conv.last_message) ? conv.last_message[0] ?? null : conv.last_message,
        })) as ConversationWithCustomer[]
        setConversations(mapped)
      }
      setLoading(false)
    }

    fetchConversations()

    const channel = supabase
      .channel("conversations-list:" + businessId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          fetchConversations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [businessId])

  const filtered = conversations.filter((conv) => {
    const matchesSearch =
      !search ||
      conv.customer?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      conv.customer?.phone_number?.includes(search)

    const matchesTab =
      activeTab === "all" ||
      (activeTab === "unread" && conv.unread_count > 0) ||
      (activeTab === "payment_pending" && conv.trajectory_state === "payment_pending")

    return matchesSearch && matchesTab
  })

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-surface">
        <div className="p-4 border-b border-border">
          <Skeleton className="h-9 w-full rounded-lg bg-surface-2" />
        </div>
        <div className="flex gap-1 px-4 py-2 border-b border-border">
          {FILTER_TABS.map((tab) => (
            <Skeleton key={tab.value} className="h-7 w-16 rounded-full bg-surface-2" />
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Skeleton className="h-10 w-10 rounded-full bg-surface-2 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-32 bg-surface-2" />
                <Skeleton className="h-3 w-48 bg-surface-2" />
              </div>
              <Skeleton className="h-3 w-10 bg-surface-2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Search */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-4" />
          <Input
            placeholder="Buscar conversa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-surface border-border text-ink placeholder:text-ink-4 focus-visible:ring-brand/30"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-border overflow-x-auto scrollbar-none">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors",
              activeTab === tab.value
                ? "bg-ink text-white font-semibold"
                : "bg-surface-2 text-ink-3 hover:text-ink-2"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-ink-3">
            <MessageCircle className="h-10 w-10 opacity-30" />
            <span className="text-sm">Nenhuma conversa</span>
          </div>
        ) : (
          filtered.map((conv) => {
            const isSelected = conv.id === selectedId
            const hasUnread = conv.unread_count > 0
            const customerName = conv.customer?.full_name ?? "Desconhecido"
            const preview = conv.last_message?.content
              ? conv.last_message.content.slice(0, 35) + (conv.last_message.content.length > 35 ? "…" : "")
              : "Sem mensagens"

            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3.5 border-b border-border transition-colors text-left",
                  isSelected
                    ? "border-l-2 border-l-brand bg-tint/40"
                    : hasUnread
                    ? "border-l-2 border-l-brand bg-tint/20 hover:bg-surface-2"
                    : "hover:bg-surface-2"
                )}
              >
                {/* Avatar */}
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-tint text-brand-2 font-semibold text-sm">
                    {getInitials(customerName)}
                  </AvatarFallback>
                </Avatar>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-ink truncate">
                      {customerName}
                    </span>
                    <span className="font-mono text-xs text-ink-3 shrink-0">
                      {formatRelative(conv.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-ink-3 truncate">{preview}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* AI indicator */}
                      <Bot
                        className={cn(
                          "h-3 w-3",
                          conv.ai_active ? "text-brand" : "text-ink-4"
                        )}
                      />
                      {/* Unread pill */}
                      {conv.unread_count > 0 && (
                        <span className="bg-brand text-white text-[10px] font-mono rounded-full min-w-[18px] px-1.5 text-center">
                          {conv.unread_count > 99 ? "99+" : conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Trajectory state badge */}
                  <span className={`text-xs font-mono ${getStateColor(conv.trajectory_state ?? "idle")}`}>
                    {getStateLabel(conv.trajectory_state ?? "idle")}
                  </span>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
