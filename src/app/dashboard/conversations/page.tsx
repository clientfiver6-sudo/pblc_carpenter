"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ConversationList } from "@/components/conversations/ConversationList"
import { ConversationThread } from "@/components/conversations/ConversationThread"
import { ConversationHeader } from "@/components/conversations/ConversationHeader"
import { ConversationSidebar } from "@/components/conversations/ConversationSidebar"
import { MessageComposer } from "@/components/conversations/MessageComposer"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient } from "@/lib/supabase/client"
import type { ConversationWithCustomer } from "@/types/database"
import { MessageCircle, ArrowLeft, Plus, Search, X, Bot } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { updateBusiness } from "@/lib/settings/actions"

export default function ConversationsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [businessId, setBusinessId] = useState<string | null>(null)
  const [loadingBusiness, setLoadingBusiness] = useState(true)
  const [whatsappConnected, setWhatsappConnected] = useState(false)
  const [globalAiEnabled, setGlobalAiEnabled] = useState(false)
  const [aiToggling, setAiToggling] = useState(false)
  const [selectedId, setSelectedId] = useState<string | undefined>(
    searchParams.get("id") ?? undefined
  )
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithCustomer | null>(null)
  const [loadingConversation, setLoadingConversation] = useState(false)
  const [aiActiveLocal, setAiActiveLocal] = useState(false)
  const [pendingDraft, setPendingDraft] = useState("")
  const [lastInboundAt, setLastInboundAt] = useState<string | null>(null)

  // New conversation dialog
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [customerSearch, setCustomerSearch] = useState("")
  const [customerResults, setCustomerResults] = useState<{ id: string; full_name: string; phone_number: string | null }[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [creatingConv, setCreatingConv] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // Fetch businessId from auth → business_users on mount
  useEffect(() => {
    const supabase = createClient()

    async function fetchBusiness() {
      setLoadingBusiness(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace("/auth/login")
        return
      }

      const { data: rawBu } = await supabase
        .from("business_users")
        .select("business_id")
        .eq("user_id", user.id)
        .single()
      const bu = rawBu as { business_id: string } | null

      if (bu?.business_id) {
        setBusinessId(bu.business_id)

        const { data: rawBiz } = await supabase
          .from("businesses")
          .select("whatsapp_token, whatsapp_phone_id, whatsapp_ai_enabled")
          .eq("id", bu.business_id)
          .single()
        const biz = rawBiz as { whatsapp_token: string | null; whatsapp_phone_id: string | null; whatsapp_ai_enabled: boolean } | null
        setWhatsappConnected(Boolean(biz?.whatsapp_token && biz?.whatsapp_phone_id))
        setGlobalAiEnabled(biz?.whatsapp_ai_enabled ?? false)
      }
      setLoadingBusiness(false)
    }

    fetchBusiness()
  }, [router])

  // Load selected conversation details whenever selectedId changes
  useEffect(() => {
    if (!selectedId) {
      setSelectedConversation(null)
      setLastInboundAt(null)
      return
    }

    const supabase = createClient()

    async function fetchConversation() {
      setLoadingConversation(true)
      const { data: rawData } = await supabase
        .from("conversations")
        .select("*, customer:customers(*)")
        .eq("id", selectedId!)
        .single()
      const data = rawData as ConversationWithCustomer | null

      if (data) {
        const conv = {
          ...data,
          last_message: null,
        } as ConversationWithCustomer
        setSelectedConversation(conv)
        setAiActiveLocal(conv.ai_active)

        // Fetch last inbound message time for 24h window check
        const { data: lastInbound } = await supabase
          .from("messages")
          .select("sent_at")
          .eq("conversation_id", selectedId!)
          .eq("direction", "inbound")
          .order("sent_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        setLastInboundAt((lastInbound as { sent_at?: string } | null)?.sent_at ?? null)
      }
      setLoadingConversation(false)
    }

    fetchConversation()

    // Update URL param
    const url = new URL(window.location.href)
    url.searchParams.set("id", selectedId)
    window.history.replaceState({}, "", url.toString())
  }, [selectedId])

  function handleSelect(id: string) {
    setSelectedId(id)
  }

  useEffect(() => {
    if (!showNewDialog) { setCustomerSearch(""); setCustomerResults([]); return }
    setTimeout(() => searchRef.current?.focus(), 50)
  }, [showNewDialog])

  useEffect(() => {
    if (!businessId || !showNewDialog) return
    const q = customerSearch.trim()
    setLoadingCustomers(true)
    const supabase = createClient()
    const query = supabase
      .from("customers")
      .select("id,full_name,phone_number")
      .eq("business_id", businessId)
      .eq("status", "active")
      .order("full_name")
      .limit(20)
    ;(q ? query.ilike("full_name", `%${q}%`) : query).then(({ data }) => {
      setCustomerResults((data ?? []) as { id: string; full_name: string; phone_number: string | null }[])
      setLoadingCustomers(false)
    })
  }, [customerSearch, businessId, showNewDialog])

  async function handleNewConversation(customerId: string) {
    setCreatingConv(true)
    try {
      const res = await fetch("/api/conversations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      })
      const data = await res.json() as { conversationId?: string }
      if (data.conversationId) {
        setShowNewDialog(false)
        setSelectedId(data.conversationId)
      }
    } finally {
      setCreatingConv(false)
    }
  }

  async function handleToggleGlobalAI() {
    setAiToggling(true)
    try {
      await updateBusiness({ whatsapp_ai_enabled: !globalAiEnabled } as never)
      setGlobalAiEnabled(v => !v)
    } finally {
      setAiToggling(false)
    }
  }

  function handleToggleAI() {
    setAiActiveLocal((v) => !v)
    // Reload conversation to sync with server state
    if (selectedId) {
      setSelectedId(undefined)
      setTimeout(() => setSelectedId(selectedId), 50)
    }
  }

  if (loadingBusiness) {
    return (
      <div className="flex h-[calc(100vh-56px)] bg-bg items-center justify-center">
        <div className="space-y-2 text-center">
          <Skeleton className="h-8 w-48 mx-auto bg-surface-2" />
          <Skeleton className="h-4 w-32 mx-auto bg-surface-2" />
        </div>
      </div>
    )
  }

  if (!businessId) {
    return (
      <div className="flex h-[calc(100vh-56px)] bg-bg items-center justify-center">
        <p className="text-ink-2 text-sm">Negócio não encontrado. Faça login novamente.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">
      {/* WhatsApp not connected — non-blocking banner */}
      {!whatsappConnected && (
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm">
          <span className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 shrink-0" />
            WhatsApp não conectado — mensagens de clientes não serão recebidas.
          </span>
          <Link
            href="/dashboard/settings/whatsapp"
            className="shrink-0 text-xs font-semibold underline underline-offset-2 hover:opacity-70 transition"
          >
            Conectar agora →
          </Link>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
      {/* Left panel — conversation list (hidden on mobile when conversation selected) */}
      <div
        className={`
          w-[340px] shrink-0 border-r border-border bg-surface flex flex-col
          ${selectedId ? "hidden md:flex" : "flex"}
        `}
      >
        <div className="px-4 pt-4 pb-3 border-b border-border space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-base font-semibold text-ink">Conversas</h1>
              <p className="text-xs text-ink-3 mt-0.5">WhatsApp · Tempo real</p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewDialog(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white shrink-0 transition hover:opacity-90"
              style={{ background: "var(--brand-grad)" }}
            >
              <Plus className="w-3.5 h-3.5" />
              Nova
            </button>
          </div>
          {/* Global AI toggle */}
          <div className="flex items-center justify-between gap-2 px-0.5">
            <div className="flex items-center gap-1.5">
              <Bot className={`w-3.5 h-3.5 ${globalAiEnabled ? "text-moss" : "text-ink-4"}`} />
              <span className="text-xs text-ink-3">
                {globalAiEnabled ? "IA respondendo" : "IA desligada"}
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleGlobalAI}
              disabled={aiToggling}
              aria-label={globalAiEnabled ? "Desligar IA" : "Ligar IA"}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${globalAiEnabled ? "bg-moss" : "bg-ink-4/30"}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${globalAiEnabled ? "translate-x-[18px]" : "translate-x-0.5"}`} />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <ConversationList
            businessId={businessId}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        </div>
      </div>

      {/* Center panel — thread */}
      <div
        className={`
          flex-1 flex flex-col min-w-0
          ${!selectedId ? "hidden md:flex" : "flex"}
        `}
        style={{ background: '#FCFAF6' }}
      >
        {selectedId ? (
          loadingConversation || !selectedConversation ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="space-y-3 w-full max-w-sm px-4">
                <Skeleton className="h-12 w-full bg-surface-2 rounded-lg" />
                <Skeleton className="h-64 w-full bg-surface-2 rounded-lg" />
                <Skeleton className="h-16 w-full bg-surface-2 rounded-lg" />
              </div>
            </div>
          ) : (
            <>
              {/* Mobile back button */}
              <div className="md:hidden flex items-center gap-2 px-4 py-3 bg-surface border-b border-border">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-ink-2 hover:text-ink"
                  onClick={() => setSelectedId(undefined)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-ink-2">Voltar</span>
              </div>

              {/* Header */}
              <ConversationHeader
                conversation={selectedConversation}
                onToggleAI={handleToggleAI}
              />

              {/* Thread */}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <ConversationThread conversationId={selectedId} />
              </div>

              {/* Composer */}
              <MessageComposer
                conversationId={selectedId}
                businessId={businessId}
                aiActive={aiActiveLocal}
                externalDraft={pendingDraft}
                onDraftConsumed={() => setPendingDraft("")}
                lastInboundAt={lastInboundAt}
              />
            </>
          )
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-ink-3">
            <div className="rounded-full bg-surface-2 p-6">
              <MessageCircle className="h-12 w-12 opacity-30" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-ink">Selecione uma conversa</p>
              <p className="text-xs text-ink-3 mt-1">
                Escolha uma conversa na lista para começar
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right panel — sidebar (only shown when conversation selected) */}
      {selectedId && selectedConversation && !loadingConversation && (
        <div className="hidden lg:flex w-[360px] border-l border-border bg-surface flex-col shrink-0">
          <ConversationSidebar
            conversation={selectedConversation}
            onDraftReady={(text) => setPendingDraft(text)}
          />
        </div>
      )}
      </div>

      {/* New conversation dialog */}
      {showNewDialog && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4" onClick={() => setShowNewDialog(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-sm bg-surface rounded-2xl border border-border shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Search className="w-4 h-4 text-ink-3 shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Buscar cliente…"
                className="flex-1 text-sm text-ink bg-transparent outline-none placeholder:text-ink-4"
              />
              <button type="button" onClick={() => setShowNewDialog(false)} className="text-ink-3 hover:text-ink transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto">
              {loadingCustomers ? (
                <div className="py-8 flex items-center justify-center">
                  <span className="w-5 h-5 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
                </div>
              ) : customerResults.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-4">Nenhum cliente encontrado</p>
              ) : (
                customerResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={creatingConv}
                    onClick={() => handleNewConversation(c.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition text-left border-b border-border last:border-0 disabled:opacity-50"
                  >
                    <div className="w-8 h-8 rounded-full bg-tint border border-brand/20 flex items-center justify-center shrink-0 text-xs font-bold text-brand">
                      {c.full_name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{c.full_name}</p>
                      {c.phone_number && <p className="text-xs text-ink-3">{c.phone_number}</p>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
