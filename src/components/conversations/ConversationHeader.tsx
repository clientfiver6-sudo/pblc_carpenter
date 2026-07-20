"use client"

import { useState, useEffect, useTransition } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { cn, formatPhone, getInitials } from "@/lib/utils"
import { toggleAI, assignConversation } from "@/lib/conversations/actions"
import type { ConversationWithCustomer, Staff } from "@/types/database"
import { Bot, Phone } from "lucide-react"

interface ConversationHeaderProps {
  conversation: ConversationWithCustomer
  onToggleAI: () => void
}

const STATUS_LABELS: Record<string, string> = {
  open: "Aberta",
  waiting: "Aguardando",
  bot: "Bot",
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-info/15 text-info",
  waiting: "bg-warning/15 text-warning",
  bot: "bg-tint text-brand",
}

export function ConversationHeader({ conversation, onToggleAI }: ConversationHeaderProps) {
  const [aiActive, setAiActive] = useState(conversation.ai_active)
  const [isPending, startTransition] = useTransition()
  const [staffList, setStaffList] = useState<Staff[]>([])

  useEffect(() => {
    fetch("/api/staff")
      .then((res) => res.ok ? res.json() : { staff: [] })
      .then((json: { staff: Staff[] }) => {
        setStaffList(json.staff ?? [])
      })
      .catch((err) => {
        console.error("ConversationHeader: failed to fetch staff", err)
      })
  }, [])

  const customerName = conversation.customer?.full_name ?? "Desconhecido"
  const customerPhone = conversation.customer?.phone_number

  function handleToggleAI() {
    startTransition(async () => {
      const newValue = await toggleAI(conversation.id)
      setAiActive(newValue)
      onToggleAI()
    })
  }

  function handleAssign(value: string) {
    startTransition(async () => {
      // NOTE: The `conversations` table does not have a dedicated `assigned_to` or
      // `staff_id` column — assignment is stored in `metadata.assigned_staff_id`.
      // The `assignConversation` action handles this correctly.
      await assignConversation(conversation.id, value === "unassigned" ? null : value)
    })
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-surface border-b border-border">
      {/* Avatar + customer info */}
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarFallback className="bg-tint text-brand-2 text-sm font-medium">
          {getInitials(customerName)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink truncate">{customerName}</span>
          <Badge
            className={cn(
              "text-[10px] font-medium px-1.5 py-0 h-4 rounded-sm",
              STATUS_COLORS[conversation.status] ?? "bg-surface-2 text-ink-3"
            )}
          >
            {STATUS_LABELS[conversation.status] ?? conversation.status}
          </Badge>
        </div>
        {customerPhone && (
          <div className="flex items-center gap-1 mt-0.5">
            <Phone className="h-3 w-3 text-ink-3" />
            <span className="font-mono text-[11px] text-ink-3">
              {formatPhone(customerPhone)}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* AI Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleAI}
          disabled={isPending}
          className={cn(
            "h-8 gap-1.5 text-xs transition-colors",
            aiActive
              ? "bg-tint border border-brand text-brand hover:bg-tint-2"
              : "bg-surface-2 border border-border text-ink-3 hover:bg-surface-2"
          )}
        >
          <Bot className={cn("h-3.5 w-3.5", aiActive && "animate-pulse")} />
          {aiActive ? "IA Ativa" : "IA Pausada"}
        </Button>

        <Separator orientation="vertical" className="h-5 bg-border" />

        {/* Assign staff — populated from /api/staff */}
        <Select onValueChange={handleAssign}>
          <SelectTrigger className="h-8 w-32 text-xs border-border bg-surface text-ink hover:bg-surface-2 focus:ring-brand/20">
            <SelectValue placeholder="Atribuir" />
          </SelectTrigger>
          <SelectContent className="bg-surface border-border text-ink">
            <SelectItem value="unassigned" className="text-xs hover:bg-surface-2 focus:bg-surface-2">
              Não atribuído
            </SelectItem>
            {staffList.map((member) => (
              <SelectItem
                key={member.id}
                value={member.id}
                className="text-xs hover:bg-surface-2 focus:bg-surface-2"
              >
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

      </div>
    </div>
  )
}
