"use client"

import { useState, useRef, useEffect, useTransition } from "react"
import { QrCode, CreditCard, ChevronDown, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { CardPaymentDialog } from "@/components/payments/CardPaymentDialog"
import { PixModal } from "@/components/payments/PixModal"
import type { Payment } from "@/types/database"

// ---------------------------------------------------------------------------
// NewChargeDropdown
// ---------------------------------------------------------------------------

export function NewChargeDropdown() {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [pixOpen, setPixOpen] = useState(false)
  const [cardOpen, setCardOpen] = useState(false)
  const [createdPixPayment, setCreatedPixPayment] = useState<Payment | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropdownOpen) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [dropdownOpen])

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <Button
          onClick={() => setDropdownOpen(v => !v)}
          className="font-semibold text-white rounded-md h-10 px-5 flex items-center gap-2"
          style={{ background: "var(--brand-grad)" }}
        >
          <Plus className="h-4 w-4" />
          Nova cobrança
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${dropdownOpen ? "rotate-180" : ""}`} />
        </Button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-56 bg-surface border border-border rounded-xl shadow-xl py-1.5 z-50">
            <button
              type="button"
              onClick={() => { setDropdownOpen(false); setPixOpen(true) }}
              className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface-2 transition-colors rounded-lg w-[calc(100%-8px)] mx-1"
            >
              <div className="w-7 h-7 rounded-md bg-tint flex items-center justify-center shrink-0">
                <QrCode className="h-3.5 w-3.5 text-brand" />
              </div>
              <div className="text-left">
                <p className="font-medium text-ink text-sm">Cobrar via Pix</p>
                <p className="text-[11px] text-ink-3">Gera QR code e link</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => { setDropdownOpen(false); setCardOpen(true) }}
              className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface-2 transition-colors rounded-lg w-[calc(100%-8px)] mx-1"
            >
              <div className="w-7 h-7 rounded-md bg-surface-2 border border-border flex items-center justify-center shrink-0">
                <CreditCard className="h-3.5 w-3.5 text-ink-3" />
              </div>
              <div className="text-left">
                <p className="font-medium text-ink text-sm">Cobrar via Cartão</p>
                <p className="text-[11px] text-ink-3">Crédito ou débito</p>
              </div>
            </button>
          </div>
        )}
      </div>

      <PixDialog
        open={pixOpen}
        onClose={() => setPixOpen(false)}
        onCreated={p => { setCreatedPixPayment(p); setPixOpen(false) }}
      />

      <CardPaymentDialog
        open={cardOpen}
        onClose={() => setCardOpen(false)}
      />

      {createdPixPayment && (
        <PixModal
          payment={createdPixPayment}
          open={true}
          onClose={() => setCreatedPixPayment(null)}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// PixDialog — controlled version of the Pix charge form
// ---------------------------------------------------------------------------

interface PixDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (payment: Payment) => void
}

function PixDialog({ open, onClose, onCreated }: PixDialogProps) {
  const [workItemId, setWorkItemId] = useState("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open) {
      setWorkItemId("")
      setAmount("")
      setDescription("")
      setError(null)
    }
  }, [open])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const amountNum = parseFloat(amount.replace(",", "."))
    if (!workItemId.trim()) { setError("Informe o ID da ordem de serviço"); return }
    if (isNaN(amountNum) || amountNum <= 0) { setError("Informe um valor válido"); return }

    startTransition(async () => {
      try {
        const res = await fetch("/api/payments/create-pix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workItemId: workItemId.trim(),
            amount: amountNum,
            description: description.trim() || undefined,
          }),
        })
        const data = await res.json() as { payment: Payment | null; error?: string }
        if (!res.ok || data.error) { setError(data.error ?? "Erro ao criar cobrança Pix"); return }
        if (data.payment) onCreated(data.payment)
      } catch {
        setError("Erro de conexão. Tente novamente.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="bg-surface border-border rounded-xl text-ink max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-ink flex items-center gap-2">
            <QrCode className="w-4 h-4 text-ink-3" />
            Cobrar via Pix
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
              ID da Ordem de Serviço
            </label>
            <input
              type="text"
              placeholder="UUID da ordem de serviço"
              value={workItemId}
              onChange={e => { setWorkItemId(e.target.value); setError(null) }}
              className="w-full rounded-md border border-border bg-surface text-ink font-mono px-3 h-10 text-sm placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
              Valor (R$)
            </label>
            <input
              type="text"
              placeholder="0,00"
              inputMode="decimal"
              value={amount}
              onChange={e => { setAmount(e.target.value); setError(null) }}
              className="w-full rounded-md border border-border bg-surface text-ink font-mono px-3 h-10 text-sm placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
              Descrição (opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Serviço de conserto"
              value={description}
              onChange={e => setDescription(e.target.value)}
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
              onClick={onClose}
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
              {isPending ? "Gerando…" : "Gerar Pix"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
