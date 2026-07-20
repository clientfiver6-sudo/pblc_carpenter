"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { sendMessage } from "@/lib/conversations/actions"
import { Send, Sparkles, Loader2, MessageCircle, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

const HARDCODED_TEMPLATES = [
  {
    id: "1",
    label: "Confirmação de agendamento",
    content: "Olá! Confirmando seu agendamento para {data} às {hora}. Qualquer dúvida, estamos à disposição.",
  },
  {
    id: "2",
    label: "Lembrete de visita",
    content: "Oi! Só lembrando que você tem um agendamento conosco amanhã. Aguardamos sua visita!",
  },
  {
    id: "3",
    label: "Orçamento aprovado",
    content: "Ótima notícia! Seu orçamento foi aprovado. Podemos confirmar a data de início do serviço?",
  },
  {
    id: "4",
    label: "Pagamento pendente",
    content: "Olá! Identificamos um pagamento pendente em sua conta. Poderia verificar? Estamos à disposição para ajudar.",
  },
  {
    id: "5",
    label: "Serviço concluído",
    content: "Serviço concluído com sucesso! Foi um prazer atendê-lo. Em caso de dúvidas, estamos aqui. 🙌",
  },
]

interface MessageComposerProps {
  conversationId: string
  businessId: string
  aiActive: boolean
  externalDraft?: string
  onDraftConsumed?: () => void
  lastInboundAt?: string | null
}

export function MessageComposer({ conversationId, businessId, aiActive, externalDraft, onDraftConsumed, lastInboundAt }: MessageComposerProps) {
  const [text, setText] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Apply external draft (e.g. from AI sidebar suggestion)
  useEffect(() => {
    if (externalDraft) {
      setText(externalDraft)
      onDraftConsumed?.()
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [externalDraft, onDraftConsumed])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 120) + "px"
  }, [text])

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || isSending) return

    setIsSending(true)
    setText("")
    try {
      await sendMessage(conversationId, trimmed)
    } catch {
      // Restore text on error
      setText(trimmed)
    } finally {
      setIsSending(false)
    }
  }

  async function handleGenerateAI() {
    if (isGenerating) return
    setIsGenerating(true)
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, businessId }),
      })
      if (!res.ok) throw new Error("Erro ao gerar resposta")
      const data = await res.json() as { draft: string }
      if (data.draft) {
        setText(data.draft)
        textareaRef.current?.focus()
      }
    } catch {
      // Silently fail — user can try again
    } finally {
      setIsGenerating(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault()
      handleSend()
    }
  }

  function applyTemplate(content: string) {
    setText(content)
    setTemplatesOpen(false)
    textareaRef.current?.focus()
  }

  // 24h window: WhatsApp only allows free-form messages within 24h of last customer message
  const windowExpired = lastInboundAt
    ? Date.now() - new Date(lastInboundAt).getTime() > 23 * 60 * 60 * 1000
    : false

  return (
    <div className="bg-surface border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
      {/* 24h window warning */}
      {windowExpired && (
        <div className="flex items-start gap-2 mb-2 rounded-lg px-4 py-3 bg-warning/10 border border-warning/20 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>Janela de 24h expirada — o cliente ainda não respondeu. Mensagens fora da janela precisam usar templates aprovados pelo Meta e podem não ser entregues.</span>
        </div>
      )}

      {/* AI active hint */}
      {aiActive && (
        <div className="flex items-center gap-1.5 mb-2 text-xs text-brand/70">
          <Sparkles className="h-3 w-3" />
          <span>IA ativa — respondendo automaticamente</span>
        </div>
      )}

      {/* Composer row */}
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escreva uma mensagem..."
          rows={1}
          className={cn(
            "flex-1 resize-none min-h-[44px] max-h-[120px] bg-surface-2 border border-border rounded-lg",
            "text-ink placeholder:text-ink-4 focus:border-brand focus:ring-2 focus:ring-brand/40",
            "py-2.5 text-sm leading-relaxed transition-[height] duration-200 ease-out"
          )}
        />

        {/* Templates button */}
        <Sheet open={templatesOpen} onOpenChange={setTemplatesOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-11 w-11 shrink-0 text-ink-3 hover:text-ink transition-[color,background-color,transform] duration-150 ease-brand-out active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-brand/50"
              title="Modelos de mensagem"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="bg-surface border-border text-ink max-h-[60vh]">
            <SheetHeader>
              <SheetTitle className="text-ink">Modelos de mensagem</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-2 overflow-y-auto">
              {HARDCODED_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => applyTemplate(tpl.content)}
                  className="w-full text-left p-4 rounded-lg bg-surface-2 border border-border hover:bg-tint hover:border-brand/30 transition-[color,background-color,border-color] duration-150 ease-brand-out active:scale-[0.98]"
                >
                  <div className="text-sm font-medium text-ink mb-1">{tpl.label}</div>
                  <div className="text-xs text-ink-3 line-clamp-2">{tpl.content}</div>
                </button>
              ))}
            </div>
          </SheetContent>
        </Sheet>

        {/* AI generate button */}
        <Button
          type="button"
          onClick={handleGenerateAI}
          disabled={isGenerating || isSending}
          size="icon"
          variant="ghost"
          className={cn(
            "h-11 w-11 shrink-0 transition-[color,background-color,border-color,transform] duration-150 ease-brand-out active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-brand/50",
            isGenerating
              ? "text-brand animate-pulse shadow-[0_0_12px_rgba(232,93,31,0.3)]"
              : "bg-tint text-brand border border-brand/20 hover:bg-tint-2"
          )}
          title="Gerar resposta com IA"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
        </Button>

        {/* Send button */}
        <Button
          type="button"
          onClick={handleSend}
          disabled={!text.trim() || isSending}
          size="icon"
          className="h-11 w-11 shrink-0 transition-[opacity,transform] duration-150 ease-brand-out text-white rounded-lg disabled:opacity-40 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-brand/50"
          style={{ background: "var(--brand-grad)" }}
          title="Enviar (Ctrl+Enter)"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      <p className="mt-1.5 text-xs text-ink-4/60 text-right">
        <span className="bg-surface-2 text-ink-4 text-xs font-mono rounded px-1.5">Ctrl+Enter</span>
        {" "}para enviar
      </p>
    </div>
  )
}
