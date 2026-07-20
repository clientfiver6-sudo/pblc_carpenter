"use client"

import { useState, useEffect, useTransition } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn, formatCurrency, formatPhone, formatRelative, getInitials } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { ConversationWithCustomer, WorkItemStatus } from "@/types/database"
import { ChevronRight, Phone, User, Calendar, CreditCard, CheckCircle2, AlertCircle, X } from "lucide-react"
import { AIConversationPanel } from "@/components/ai/AIConversationPanel"
import { sendPixInConversation } from "@/lib/conversations/actions"

interface ConversationSidebarProps {
  conversation: ConversationWithCustomer
  onDraftReady?: (text: string) => void
}

interface RecentWorkItem {
  id: string
  title: string
  status: WorkItemStatus
  scheduled_start: string | null
  service: { name: string } | null
}

const STATUS_COLOR: Record<WorkItemStatus, string> = {
  new: "#C77E0A",
  scheduled: "#2E6BAA",
  pending_confirmation: "#C77E0A",
  confirmed: "#2E6BAA",
  in_progress: "#2E6BAA",
  waiting_customer: "#C77E0A",
  waiting_parts: "#C77E0A",
  completed: "#E85D1F",
  cancelled: "#8C857A",
  no_show: "#8C857A",
}

const STATUS_LABEL: Record<WorkItemStatus, string> = {
  new: "Novo",
  scheduled: "Agendado",
  pending_confirmation: "Pendente",
  confirmed: "Confirmado",
  in_progress: "Em andamento",
  waiting_customer: "Aguardando cliente",
  waiting_parts: "Aguardando peças",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
}

export function ConversationSidebar({ conversation, onDraftReady }: ConversationSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [workItems, setWorkItems] = useState<RecentWorkItem[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [showPixForm, setShowPixForm] = useState(false)
  const [pixAmount, setPixAmount] = useState("")
  const [pixDesc, setPixDesc] = useState("")
  const [pixResult, setPixResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const customer = conversation.customer

  useEffect(() => {
    if (!customer?.id) {
      setLoadingItems(false)
      return
    }

    const supabase = createClient()

    supabase
      .from("work_items")
      .select("id, title, status, scheduled_start, service:services(name)")
      .eq("customer_id", customer.id)
      .order("scheduled_start", { ascending: false })
      .limit(3)
      .then(({ data, error }) => {
        if (error) {
          console.error("ConversationSidebar: failed to fetch work items", error)
        } else {
          setWorkItems((data ?? []) as unknown as RecentWorkItem[])
        }
        setLoadingItems(false)
      })
  }, [customer?.id])

  if (!customer) {
    return (
      <div className="w-72 border-l border-border bg-surface p-4 flex items-center justify-center">
        <span className="text-sm text-ink-3">Cliente não encontrado</span>
      </div>
    )
  }

  const tags = customer.tags ?? []

  return (
    <div
      className={cn(
        "border-l border-border bg-surface transition-[width] duration-200 ease-drawer flex flex-col overflow-hidden",
        collapsed ? "w-10" : "w-72"
      )}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex items-center justify-end p-2 hover:bg-surface-2 transition-colors duration-200 ease-out shrink-0 focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:outline-none"
        title={collapsed ? "Expandir painel" : "Recolher painel"}
      >
        <ChevronRight
          className={cn(
            "h-4 w-4 text-ink-3 transition-transform",
            !collapsed && "rotate-180"
          )}
        />
      </button>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto">
          {/* Customer card */}
          <div className="px-4 pb-4">
            <div className="flex flex-col items-center gap-2 py-4">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-tint text-brand-2 text-lg font-semibold">
                  {getInitials(customer.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <p className="text-sm font-semibold text-ink">{customer.full_name}</p>
                {customer.phone_number && (
                  <div className="flex items-center justify-center gap-1 mt-0.5">
                    <Phone className="h-3 w-3 text-ink-3" />
                    <span className="font-mono text-[11px] text-ink-3">
                      {formatPhone(customer.phone_number)}
                    </span>
                  </div>
                )}
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1 mt-1">
                  {tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="text-[10px] bg-surface-2 text-ink-3 border-0 px-1.5 py-0"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="rounded-lg bg-surface-2 p-2.5 text-center">
                <p className="font-mono text-sm font-bold text-ink">
                  {formatCurrency(customer.total_spent)}
                </p>
                <p className="text-[10px] text-ink-3 mt-0.5">Total gasto</p>
              </div>
              <div className="rounded-lg bg-surface-2 p-2.5 text-center">
                <p className="font-mono text-sm font-bold text-ink">
                  {customer.visit_count}
                </p>
                <p className="text-[10px] text-ink-3 mt-0.5">Visitas</p>
              </div>
            </div>

            {customer.last_visit_at && (
              <p className="mt-2 text-[10px] text-ink-3 text-center">
                Última visita: {formatRelative(customer.last_visit_at)}
              </p>
            )}

            {/* Profile link — corrected to dashboard route */}
            <a
              href={`/dashboard/customers/${customer.id}`}
              className="mt-3 flex items-center justify-center gap-1.5 text-xs text-brand hover:text-brand-2 transition-colors duration-200"
            >
              <User className="h-3.5 w-3.5" />
              Ver perfil completo
            </a>
          </div>

          {/* AI Conversation Analysis */}
          <div className="px-4 pb-2">
            <AIConversationPanel conversationId={conversation.id} onDraftReady={onDraftReady} />
          </div>

          <Separator className="bg-border" />

          {/* Quick actions */}
          <div className="px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
              Ações rápidas
            </p>
            <div className="flex flex-col gap-2">
              <a
                href={`/dashboard/work-items/new?customer_id=${customer.id}`}
                className="flex items-center gap-2 text-xs text-ink-2 bg-surface-2 border border-border hover:bg-tint hover:border-brand hover:text-brand rounded-md px-3 py-2 transition-colors duration-200 ease-out"
              >
                <Calendar className="h-3.5 w-3.5 text-brand" />
                Novo Agendamento
              </a>

              {/* Inline Pix send */}
              <button
                type="button"
                onClick={() => { setShowPixForm(true); setPixResult(null) }}
                className={cn(
                  "flex items-center gap-2 text-xs text-ink-2 bg-surface-2 border border-border hover:bg-tint hover:border-brand hover:text-brand rounded-md px-3 py-2 transition-colors duration-200 ease-out text-left focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:outline-none",
                  showPixForm && "hidden"
                )}
              >
                <CreditCard className="h-3.5 w-3.5 text-brand" />
                Enviar cobrança Pix
              </button>

              {/* Accordion PIX form */}
              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-300 ease-out",
                  showPixForm ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}
              >
                <div className="overflow-hidden">
                  <div className="rounded-lg border border-border bg-surface-2 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-ink-2">Cobrança Pix</span>
                      <button
                        type="button"
                        onClick={() => { setShowPixForm(false); setPixResult(null) }}
                        className="focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:outline-none rounded"
                      >
                        <X className="h-3.5 w-3.5 text-ink-3 hover:text-ink transition-colors duration-200" />
                      </button>
                    </div>
                    <input
                      type="number"
                      placeholder="Valor (R$)"
                      value={pixAmount}
                      onChange={e => setPixAmount(e.target.value)}
                      className="w-full rounded border border-border bg-surface text-sm text-ink px-3 py-2 focus:outline-none focus:border-brand"
                      min="0"
                      step="0.01"
                    />
                    <input
                      type="text"
                      placeholder="Descrição (ex: Consulta)"
                      value={pixDesc}
                      onChange={e => setPixDesc(e.target.value)}
                      className="w-full rounded border border-border bg-surface text-sm text-ink px-3 py-2 focus:outline-none focus:border-brand"
                    />
                    {pixResult && (
                      <div className={cn("flex items-center gap-1.5 text-xs rounded px-2 py-1.5 border", pixResult.ok ? "text-moss bg-moss/10 border-moss/20" : "text-danger bg-danger/10 border-danger/20")}>
                        {pixResult.ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
                        {pixResult.ok ? "Cobrança enviada pelo WhatsApp!" : pixResult.error}
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={isPending || !pixAmount || !pixDesc}
                      onClick={() => {
                        startTransition(async () => {
                          const result = await sendPixInConversation(conversation.id, parseFloat(pixAmount), pixDesc)
                          setPixResult(result)
                          if (result.ok) { setPixAmount(""); setPixDesc(""); setTimeout(() => setShowPixForm(false), 2000) }
                        })
                      }}
                      className="w-full rounded-md py-1.5 text-xs font-semibold text-white disabled:opacity-40 transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:outline-none"
                      style={{ background: "var(--brand-grad)" }}
                    >
                      {isPending ? "Enviando…" : "Enviar pelo WhatsApp"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator className="bg-border" />

          {/* Recent work items */}
          <div className="px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
              Atendimentos recentes
            </p>

            {loadingItems ? (
              /* Loading skeleton */
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-surface-2 p-2.5 animate-pulse"
                    style={{ animationDelay: i === 0 ? undefined : `${i * 100}ms` }}
                  >
                    <div className="h-3 bg-border rounded w-3/4 mb-1.5" />
                    <div className="h-2.5 bg-border rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : workItems.length === 0 ? (
              <p className="text-xs text-ink-3/60 italic">
                Nenhum atendimento encontrado
              </p>
            ) : (
              <div className="space-y-2">
                {workItems.map((item) => (
                  <a
                    key={item.id}
                    href={`/dashboard/work-items?id=${item.id}`}
                    className="block border-b border-border hover:bg-surface-2 px-4 py-3 transition-colors duration-200 ease-out"
                  >
                    <p className="text-xs font-medium text-ink truncate">
                      {item.title || item.service?.name || "—"}
                    </p>
                    <div className="flex items-center justify-between mt-1 gap-1">
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-sm"
                        style={{
                          color: STATUS_COLOR[item.status],
                          backgroundColor: `${STATUS_COLOR[item.status]}22`,
                        }}
                      >
                        {STATUS_LABEL[item.status]}
                      </span>
                      {item.scheduled_start && (
                        <span className="text-[10px] text-ink-3 shrink-0">
                          {formatRelative(item.scheduled_start)}
                        </span>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
