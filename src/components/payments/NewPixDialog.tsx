"use client"

import { useState, useTransition } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { QrCode } from "lucide-react"
import { PixModal } from "@/components/payments/PixModal"
import type { Payment } from "@/types/database"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NewPixDialogProps {
  businessId: string
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface FormState {
  workItemId: string
  amount: string
  description: string
}

const DEFAULT_FORM: FormState = { workItemId: "", amount: "", description: "" }

// ---------------------------------------------------------------------------
// NewPixDialog
// ---------------------------------------------------------------------------

export function NewPixDialog({ }: NewPixDialogProps) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [error, setError] = useState<string | null>(null)
  const [createdPayment, setCreatedPayment] = useState<Payment | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const amount = parseFloat(form.amount.replace(",", "."))
    if (!form.workItemId.trim()) {
      setError("Informe o ID da ordem de serviço")
      return
    }
    if (isNaN(amount) || amount <= 0) {
      setError("Informe um valor válido")
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/payments/create-pix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workItemId: form.workItemId.trim(),
            amount,
            description: form.description.trim() || undefined,
          }),
        })

        const data = (await res.json()) as {
          payment: Payment | null
          pixLink?: string
          pixCopyPaste?: string
          pixQrCode?: string
          error?: string
        }

        if (!res.ok || data.error) {
          setError(data.error ?? "Erro ao criar cobrança Pix")
          return
        }

        if (data.payment) {
          setCreatedPayment(data.payment)
          setOpen(false)
          setForm(DEFAULT_FORM)
        }
      } catch {
        setError("Erro de conexão. Tente novamente.")
      }
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            className="font-semibold text-white rounded-md h-10 px-5"
            style={{ background: "var(--brand-grad)" }}
          >
            <QrCode className="mr-2 h-4 w-4" />
            Novo Pix
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-surface border-border rounded-xl text-ink max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-ink">Criar cobrança Pix</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5">
                ID da Ordem de Serviço
              </label>
              <input
                type="text"
                placeholder="UUID da ordem de serviço"
                value={form.workItemId}
                onChange={(e) => handleChange("workItemId", e.target.value)}
                className="w-full rounded-md border border-border bg-surface text-ink font-mono px-3 h-10 text-sm placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5">
                Valor (R$)
              </label>
              <input
                type="text"
                placeholder="0,00"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => handleChange("amount", e.target.value)}
                className="w-full rounded-md border border-border bg-surface text-ink font-mono px-3 h-10 text-sm placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5">
                Descrição (opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Serviço de conserto"
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
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
                onClick={() => setOpen(false)}
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

      {/* Show PixModal after successful creation */}
      {createdPayment && (
        <PixModal
          payment={createdPayment}
          open={true}
          onClose={() => setCreatedPayment(null)}
        />
      )}
    </>
  )
}
