"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { getStaffMessages, markMessagesRead } from "@/lib/team/actions"
import { TeamMessageComposer } from "@/components/team/TeamMessageComposer"
import { cn } from "@/lib/utils"
import type { TeamMessage } from "@/types/database"
import { MessageSquare } from "lucide-react"

interface TeamMessageThreadProps {
  staffId: string
  staffName: string
  userId: string
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Sao_Paulo",
  })
}

export function TeamMessageThread({ staffId, staffName, userId }: TeamMessageThreadProps) {
  const [messages, setMessages] = useState<TeamMessage[]>([])
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const loadMessages = useCallback(async () => {
    setLoading(true)
    const msgs = await getStaffMessages(staffId)
    setMessages(msgs)
    setLoading(false)
    await markMessagesRead(staffId)
    setTimeout(scrollToBottom, 50)
  }, [staffId])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`team-messages-${staffId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "team_messages",
          filter: `staff_id=eq.${staffId}`,
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as TeamMessage])
          setTimeout(scrollToBottom, 50)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [staffId])

  // Group messages by date
  const grouped: { date: string; msgs: TeamMessage[] }[] = []
  for (const msg of messages) {
    const d = formatDate(msg.created_at)
    const last = grouped[grouped.length - 1]
    if (last?.date === d) {
      last.msgs.push(msg)
    } else {
      grouped.push({ date: d, msgs: [msg] })
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-2 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 rounded-full border-2 border-brand border-t-transparent animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <MessageSquare className="w-8 h-8 text-ink-4" />
            <p className="text-ink-4 text-sm">Nenhuma mensagem ainda</p>
            <p className="text-ink-4 text-xs">Envie uma instrução para {staffName}.</p>
          </div>
        ) : (
          grouped.map(group => (
            <div key={group.date}>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-ink-4 text-xs font-medium">{group.date}</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="space-y-2">
                {group.msgs.map(msg => {
                  const isOwn = msg.sender_user_id === userId
                  return (
                    <div
                      key={msg.id}
                      className={cn("flex gap-2", isOwn ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-xl px-3 py-2 text-sm",
                          isOwn
                            ? "text-white rounded-br-sm"
                            : "bg-surface-2 text-ink border border-border rounded-bl-sm"
                        )}
                        style={isOwn ? { background: "var(--brand-grad)" } : undefined}
                      >
                        {!isOwn && (
                          <p className="text-[10px] font-semibold mb-0.5 opacity-70">{staffName}</p>
                        )}
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                        <p className={cn("text-[10px] mt-1 opacity-60", isOwn ? "text-right" : "text-left")}>
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <TeamMessageComposer staffId={staffId} onSent={loadMessages} />
    </div>
  )
}
