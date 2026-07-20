"use client"

import { useEffect, useRef, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { markAsRead } from "@/lib/conversations/actions"
import type { Message } from "@/types/database"
import { Check, CheckCheck, Loader2 } from "lucide-react"
import { format, isToday, isYesterday } from "date-fns"
import { ptBR } from "date-fns/locale"

interface ConversationThreadProps {
  conversationId: string
}

function formatMessageTime(dateStr: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr))
}

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  if (isToday(date)) return "Hoje"
  if (isYesterday(date)) return "Ontem"
  return format(date, "d 'de' MMMM", { locale: ptBR })
}

function groupByDate(messages: Message[]): { label: string; messages: Message[] }[] {
  const groups: Map<string, Message[]> = new Map()

  for (const msg of messages) {
    const dateKey = new Date(msg.sent_at).toDateString()
    if (!groups.has(dateKey)) {
      groups.set(dateKey, [])
    }
    groups.get(dateKey)!.push(msg)
  }

  return Array.from(groups.entries()).map(([, msgs]) => ({
    label: getDateLabel(msgs[0].sent_at),
    messages: msgs,
  }))
}

function MessageStatusIcon({ status }: { status: Message["status"] }) {
  if (status === "sending") {
    return <Loader2 className="h-3 w-3 animate-spin text-ink-4" />
  }
  if (status === "read") {
    return <CheckCheck className="h-3 w-3 text-brand" />
  }
  if (status === "delivered") {
    return <CheckCheck className="h-3 w-3 text-ink-4" />
  }
  return <Check className="h-3 w-3 text-ink-4" />
}

function MediaBubble({ msg }: { msg: Message }) {
  const meta = msg.metadata as Record<string, unknown> | null
  const mediaUrl = meta?.media_url as string | undefined
  const type = msg.message_type as string

  if (type === "image") {
    return mediaUrl
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={mediaUrl} alt="Imagem" className="max-w-full rounded-lg max-h-64 object-cover" />
      : <span className="text-sm text-ink-3 italic">🖼️ Imagem recebida</span>
  }
  if (type === "audio") {
    return mediaUrl
      ? <audio controls src={mediaUrl} className="max-w-[240px]" />
      : <span className="text-sm text-ink-3 italic">🎵 Áudio recebido</span>
  }
  if (type === "video") {
    return mediaUrl
      ? <video controls src={mediaUrl} className="max-w-full rounded-lg max-h-64" />
      : <span className="text-sm text-ink-3 italic">🎬 Vídeo recebido</span>
  }
  if (type === "document") {
    const filename = (meta?.filename as string | undefined) ?? "Documento"
    return mediaUrl
      ? <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-brand underline">📎 {filename}</a>
      : <span className="text-sm text-ink-3 italic">📎 Documento recebido</span>
  }
  return <span className="text-sm text-ink-3 italic">📎 Arquivo recebido</span>
}

export function ConversationThread({ conversationId }: ConversationThreadProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom
  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    bottomRef.current?.scrollIntoView({ behavior })
  }

  // Fetch messages on mount
  useEffect(() => {
    const supabase = createClient()

    async function fetchMessages() {
      setLoading(true)
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("sent_at", { ascending: true })
        .limit(200)

      if (!error && data) {
        setMessages(data as Message[])
      }
      setLoading(false)
    }

    fetchMessages()

    // Mark as read
    markAsRead(conversationId).catch(() => {})

    // Realtime subscription — new messages + status updates
    const channel = supabase
      .channel("messages:" + conversationId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === (payload.new as Message).id ? { ...m, ...(payload.new as Message) } : m
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  // Auto-scroll on new messages
  useEffect(() => {
    if (!loading) {
      scrollToBottom(loading ? "instant" : "smooth")
    }
  }, [messages, loading])

  // Initial scroll (instant)
  useEffect(() => {
    if (!loading) {
      scrollToBottom("instant")
    }
  }, [loading])

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Inbound skeleton */}
        <div className="flex items-end gap-2">
          <Skeleton className="h-8 w-8 rounded-full bg-surface-2 shrink-0" />
          <Skeleton className="h-16 w-64 rounded-2xl rounded-tl-none bg-surface-2" />
        </div>
        {/* Outbound skeleton */}
        <div className="flex items-end gap-2 justify-end">
          <Skeleton className="h-12 w-48 rounded-2xl rounded-tr-none bg-tint" />
        </div>
        <div className="flex items-end gap-2">
          <Skeleton className="h-8 w-8 rounded-full bg-surface-2 shrink-0" />
          <Skeleton className="h-20 w-72 rounded-2xl rounded-tl-none bg-surface-2" />
        </div>
        <div className="flex items-end gap-2 justify-end">
          <Skeleton className="h-14 w-56 rounded-2xl rounded-tr-none bg-tint" />
        </div>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-3 text-sm">
        Nenhuma mensagem ainda
      </div>
    )
  }

  const groups = groupByDate(messages)

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6" style={{ background: "#FCFAF6" }}>
      {groups.map((group) => (
        <div key={group.label} className="space-y-3">
          {/* Date separator */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-ink-4 text-xs uppercase tracking-wide px-2">
              {group.label}
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Messages */}
          {group.messages.map((msg) => {
            const isOutbound = msg.direction === "outbound"
            const meta = msg.metadata as Record<string, unknown> | null
            const isBot = isOutbound && (msg.sent_by === "ai" || meta?.source === "bot" || meta?.source === "ai")

            return (
              <div
                key={msg.id}
                className={cn(
                  "flex items-end gap-2",
                  isOutbound ? "justify-end" : "justify-start"
                )}
              >
                {/* Inbound avatar placeholder */}
                {!isOutbound && (
                  <div className="h-6 w-6 rounded-full bg-surface-2 shrink-0 flex items-center justify-center">
                    <span className="text-[9px] text-ink-3 font-medium">C</span>
                  </div>
                )}

                {/* Bubble */}
                {isBot ? (
                  <div
                    className="max-w-[75%] px-4 py-2.5 rounded-[18px] rounded-tr-[6px] border"
                    style={{
                      background: "linear-gradient(135deg,#FFF7EF 0%,#FFF1E5 100%)",
                      borderColor: "#F2D9C2",
                    }}
                  >
                    <p className="text-sm text-ink whitespace-pre-wrap break-words leading-relaxed">
                      {msg.content}
                    </p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="font-mono text-[10px] text-ink-4">
                        {formatMessageTime(msg.sent_at)}
                      </span>
                      <MessageStatusIcon status={msg.status} />
                    </div>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "max-w-[75%] px-4 py-2.5 rounded-[18px]",
                      isOutbound
                        ? "bg-ink text-white rounded-tr-[6px]"
                        : "bg-surface text-ink rounded-tl-[6px] shadow-sm"
                    )}
                  >
                    {(msg.message_type as string) !== "text" ? (
                      <MediaBubble msg={msg} />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                        {msg.content}
                      </p>
                    )}
                    <div
                      className={cn(
                        "flex items-center gap-1 mt-1",
                        isOutbound ? "justify-end" : "justify-start"
                      )}
                    >
                      <span className="font-mono text-[10px] text-ink-4">
                        {formatMessageTime(msg.sent_at)}
                      </span>
                      {isOutbound && <MessageStatusIcon status={msg.status} />}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}

      <div ref={bottomRef} />
    </div>
  )
}
