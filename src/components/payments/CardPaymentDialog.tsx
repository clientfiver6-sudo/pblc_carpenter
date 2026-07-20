"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CreditCard, CheckCircle2, ExternalLink } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import Link from "next/link"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CardPaymentDialogProps {
  open: boolean
  onClose: () => void
}

type CardType = "credit" | "debit"

interface FormState {
  customerName: string
  workItemId: string
  amount: string
  cardType: CardType
  installments: number
  description: string
}

interface CreatedResult {
  id: string
  amount: number
  cardType: CardType
  installments: number
  customerName: string
  checkoutUrl?: string
}

const DEFAULT_FORM: FormState = {
  customerName: "",
  workItemId: "",
  amount: "",
  cardType: "credit",
  installments: 1,
  description: "",
}

const INSTALLMENT_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1)

// ---------------------------------------------------------------------------
// CardPaymentDialog
// ---------------------------------------------------------------------------

export function CardPaymentDialog({ open, onClose }: CardPaymentDialogProps) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CreatedResult | null>(null)
  const [isPending, startTransition] = useTransition()
  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setForm(DEFAULT_FORM)
      setError(null)
      setResult(null)
      setTimeout(() => firstFieldRef.current?.focus(), 80)
    }
  }, [open])

  function set(field: keyof FormState, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  function handleClose() {
    onClose()
    setResult(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const amount = parseFloat(form.amount.replace(",", "."))

    if (!form.customerName.trim()) {
      setError("Informe o nome do cliente")
      return
    }
    if (isNaN(amount) || amount <= 0) {
      setError("Informe um valor válido")
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/payments/create-card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName: form.customerName.trim(),
            workItemId: form.workItemId.trim() || undefined,
            amount,
            cardType: form.cardType,
            installments: form.cardType === "credit" ? form.installments : 1,
            description: form.description.trim() || undefined,
          }),
        })

        const data = await res.json() as { payment?: { id: string; amount: number }; checkoutUrl?: string; error?: string }

        if (!res.ok || data.error) {
          setError(data.error ?? "Erro ao registrar cobrança")
          return
        }

        if (data.checkoutUrl) {
          window.open(data.checkoutUrl, "_blank")
        }

        setResult({
          id: data.payment?.id ?? "",
          amount: data.payment?.amount ?? Math.round(amount * 100),
          cardType: form.cardType,
          installments: form.cardType === "credit" ? form.installments : 1,
          customerName: form.customerName.trim(),
          checkoutUrl: data.checkoutUrl,
        })
      } catch {
        setError("Erro de conexão. Tente novamente.")
      }
    })
  }

  const amountNum = parseFloat(form.amount.replace(",", "."))
  const installmentValue = !isNaN(amountNum) && amountNum > 0
    ? amountNum / form.installments
    : null

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="bg-surface border-border rounded-xl text-ink max-w-sm">

        {result ? (
          /* ── Success screen ─────────────────────────────────── */
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="w-12 h-12 rounded-full bg-tint flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-brand" />
            </div>
            <div>
              <p className="font-semibold text-ink text-base">Redirecionando para pagamento…</p>
              <p className="text-ink-3 text-sm mt-1">
                {formatCurrency(result.amount)} para {result.customerName}
              </p>
              {result.cardType === "credit" && result.installments > 1 && (
                <p className="text-ink-3 text-xs mt-0.5 font-mono">
                  {result.installments}x de {formatCurrency(Math.round(result.amount / result.installments))}
                </p>
              )}
            </div>

            {result.checkoutUrl && (
              <div
                className="w-full rounded-lg border p-4 text-left space-y-1.5"
                style={{ background: "rgba(255,247,239,.6)", borderColor: "#F2D9C2" }}
              >
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-3.5 h-3.5 text-brand shrink-0" />
                  <p className="text-xs text-ink-2 font-medium">Link de pagamento aberto em nova aba</p>
                </div>
                <button
                  type="button"
                  className="text-xs text-brand underline underline-offset-2 hover:opacity-80 transition-opacity break-all text-left"
                  onClick={() => window.open(result.checkoutUrl, "_blank")}
                >
                  Abrir novamente
                </button>
              </div>
            )}

            <Button
              className="w-full text-white font-semibold"
              style={{ background: "var(--brand-grad)" }}
              onClick={handleClose}
            >
              Fechar
            </Button>

            <Link href="/dashboard/payments" className="text-sm text-brand hover:underline">
              Ver pagamentos →
            </Link>
          </div>
        ) : (
          /* ── Form ───────────────────────────────────────────── */
          <>
            <DialogHeader>
              <DialogTitle className="text-ink flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-ink-3" />
                Cobrar via Cartão
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 py-2">

              {/* Customer name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
                  Nome do cliente
                </label>
                <input
                  ref={firstFieldRef}
                  type="text"
                  placeholder="Ex: Maria Silva"
                  value={form.customerName}
                  onChange={e => set("customerName", e.target.value)}
                  className="w-full rounded-md border border-border bg-surface text-ink px-3 h-10 text-sm placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  required
                />
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
                  Valor (R$)
                </label>
                <input
                  type="text"
                  placeholder="0,00"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={e => set("amount", e.target.value)}
                  className="w-full rounded-md border border-border bg-surface text-ink font-mono px-3 h-10 text-sm placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  required
                />
              </div>

              {/* Credit / Debit toggle */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
                  Tipo de cartão
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["credit", "debit"] as CardType[]).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        set("cardType", type)
                        if (type === "debit") set("installments", 1)
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 rounded-lg border py-3 text-sm font-medium transition-[border-color,background-color,color] duration-150 ease-brand-out",
                        form.cardType === type
                          ? "border-brand bg-tint text-brand"
                          : "border-border bg-surface text-ink-2 hover:bg-surface-2"
                      )}
                    >
                      <CreditCard className="w-4 h-4" />
                      {type === "credit" ? "Crédito" : "Débito"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Installments — credit only */}
              {form.cardType === "credit" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
                    Parcelas
                  </label>
                  <select
                    value={form.installments}
                    onChange={e => set("installments", parseInt(e.target.value))}
                    className="w-full rounded-md border border-border bg-surface text-ink px-3 h-10 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  >
                    {INSTALLMENT_OPTIONS.map(n => (
                      <option key={n} value={n}>
                        {n === 1
                          ? "À vista (1x)"
                          : installmentValue
                            ? `${n}x de ${formatCurrency(Math.round((parseFloat(form.amount.replace(",", ".")) / n) * 100))}`
                            : `${n}x`}
                      </option>
                    ))}
                  </select>
                  {installmentValue && form.installments > 1 && (
                    <p className="text-xs text-ink-3 font-mono">
                      {form.installments}x de {formatCurrency(Math.round(installmentValue * 100))} = {formatCurrency(Math.round(amountNum * 100))}
                    </p>
                  )}
                </div>
              )}

              {/* Work item ID (optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
                  Ordem de serviço (opcional)
                </label>
                <input
                  type="text"
                  placeholder="ID da ordem de serviço"
                  value={form.workItemId}
                  onChange={e => set("workItemId", e.target.value)}
                  className="w-full rounded-md border border-border bg-surface text-ink font-mono px-3 h-10 text-sm placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
                  Descrição (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Corte + escova"
                  value={form.description}
                  onChange={e => set("description", e.target.value)}
                  className="w-full rounded-md border border-border bg-surface text-ink px-3 h-10 text-sm placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>

              {error && (
                <p className="text-danger text-xs bg-danger/10 border border-danger/20 rounded px-3 py-2">
                  {error}
                </p>
              )}

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-border bg-surface text-ink-2 hover:bg-surface-2"
                  onClick={handleClose}
                  disabled={isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="text-white font-semibold rounded-md h-10 px-5"
                  style={{ background: "var(--brand-grad)" }}
                >
                  {isPending ? "Registrando…" : "Registrar cobrança"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
