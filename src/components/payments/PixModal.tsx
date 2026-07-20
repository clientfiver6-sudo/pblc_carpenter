"use client"

import { useState } from "react"
import Image from "next/image"
import type { Payment } from "@/types/database"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn, formatCurrency, formatRelative } from "@/lib/utils"
import { QrCode, Copy, Check, Send } from "lucide-react"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PixModalProps {
  payment: Payment
  open: boolean
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: Payment["status"] }) {
  const map: Record<
    Payment["status"],
    { label: string; variant: "amber" | "moss" | "destructive" | "secondary" }
  > = {
    pending: { label: "Pendente", variant: "amber" },
    paid: { label: "Pago", variant: "moss" },
    failed: { label: "Falhou", variant: "destructive" },
    refunded: { label: "Estornado", variant: "secondary" },
    expired: { label: "Expirado", variant: "secondary" },
  }

  const { label, variant } = map[status] ?? map.pending
  return (
    <Badge variant={variant} className="text-xs font-medium">
      {label}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// PixModal
// ---------------------------------------------------------------------------

export function PixModal({ payment, open, onClose }: PixModalProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!payment.pix_copy_paste) return
    try {
      await navigator.clipboard.writeText(payment.pix_copy_paste)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for environments where clipboard API is unavailable
    }
  }

  function handleWhatsApp() {
    if (!payment.pix_link) return
    const text = encodeURIComponent(
      `Olá! Segue o link para pagamento via Pix: ${payment.pix_link}`
    )
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer")
  }

  function handleOpenLink() {
    if (!payment.pix_link) return
    window.open(payment.pix_link, "_blank", "noopener,noreferrer")
  }

  const amountFormatted = formatCurrency(payment.amount)
  const expiryText =
    payment.expires_at ? formatRelative(payment.expires_at) : null

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="bg-surface border-border rounded-xl text-ink max-w-md w-full">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-ink text-base font-semibold">
              Link de Pagamento Pix
            </DialogTitle>
            <StatusBadge status={payment.status} />
          </div>
        </DialogHeader>

        {/* Amount */}
        <div className="text-center py-2">
          <span
            className={cn(
              "font-mono text-3xl font-bold",
              payment.status === "paid" ? "text-brand" : "text-ink"
            )}
          >
            {amountFormatted}
          </span>
          {payment.description && (
            <p className="text-ink-3 text-sm mt-1">{payment.description}</p>
          )}
        </div>

        <Separator className="bg-border" />

        {/* QR Code */}
        <div className="flex justify-center py-2">
          {payment.pix_qr_code ? (
            <Image
              src={`data:image/png;base64,${payment.pix_qr_code}`}
              alt="QR Code Pix"
              width={176}
              height={176}
              className="rounded-lg border border-border bg-white p-1"
              unoptimized
            />
          ) : (
            <div className="w-44 h-44 rounded-lg bg-surface-2 border border-border flex flex-col items-center justify-center gap-2 p-6">
              <QrCode className="w-12 h-12 text-ink-3" />
              <span className="text-xs text-ink-3">QR Code não disponível</span>
            </div>
          )}
        </div>

        {/* Copy-paste code */}
        {payment.pix_copy_paste && (
          <div className="space-y-1.5">
            <p className="text-xs text-ink-3 font-medium uppercase tracking-wide">
              Código Pix copia e cola
            </p>
            <div className="flex items-center gap-2">
              <textarea
                readOnly
                value={payment.pix_copy_paste}
                rows={3}
                className={cn(
                  "flex-1 resize-none rounded-md border border-border bg-surface-2",
                  "px-3 py-2 text-xs font-mono text-ink-3 leading-relaxed break-all",
                  "focus:outline-none focus:ring-2 focus:ring-brand/20"
                )}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className={cn(
                  "shrink-0 h-10 w-10 border-border bg-surface",
                  "hover:bg-surface-2",
                  copied && "border-brand/60 text-brand"
                )}
                title="Copiar código Pix"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Expiry */}
        {expiryText && payment.status === "pending" && (
          <p className="text-xs text-ink-3 text-center font-mono">
            Expira {expiryText}
          </p>
        )}

        <Separator className="bg-border" />

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-0">
          {payment.pix_link && (
            <Button
              variant="outline"
              className="flex-1 border-border bg-surface hover:bg-surface-2 text-ink"
              onClick={handleWhatsApp}
            >
              <Send className="mr-2 h-4 w-4 text-brand" />
              Enviar via WhatsApp
            </Button>
          )}
          {payment.pix_link && (
            <Button
              className="flex-1 text-white font-semibold rounded-md h-9 px-4 text-sm"
              style={{ background: "var(--brand-grad)" }}
              onClick={handleOpenLink}
            >
              Abrir link de pagamento
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
