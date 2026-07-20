"use client"

import { useState } from "react"
import type { PaymentWithRelations, PaymentTransactionStatus, PaymentMethod } from "@/types/database"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PixModal } from "@/components/payments/PixModal"
import { markPaymentPaid, cancelPayment } from "@/lib/payments/actions"
import { formatCurrency, formatDate } from "@/lib/utils"
import { CreditCard, QrCode, DollarSign, AlertCircle, Receipt } from "lucide-react"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PaymentListProps {
  payments: PaymentWithRelations[]
  loading?: boolean
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: PaymentTransactionStatus }) {
  const map: Record<PaymentTransactionStatus, { label: string; variant: "moss" | "amber" | "destructive" | "secondary" }> = {
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
// Method badge
// ---------------------------------------------------------------------------

function MethodBadge({ method }: { method: PaymentMethod }) {
  const map: Record<PaymentMethod, { label: string; icon: React.ReactNode }> = {
    pix: {
      label: "Pix",
      icon: <QrCode className="h-3 w-3" />,
    },
    cash: {
      label: "Dinheiro",
      icon: <DollarSign className="h-3 w-3" />,
    },
    card: {
      label: "Cartão",
      icon: <CreditCard className="h-3 w-3" />,
    },
    transfer: {
      label: "Transferência",
      icon: <DollarSign className="h-3 w-3" />,
    },
  }

  const { label, icon } = map[method] ?? { label: method, icon: null }
  return (
    <Badge
      variant="outline"
      className="inline-flex items-center gap-1 text-xs border-border text-ink-3"
    >
      {icon}
      {label}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Loading skeleton rows
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-b-0">
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-24 bg-surface-2" />
        <Skeleton className="h-3 w-36 bg-surface-2" />
      </div>
      <Skeleton className="h-5 w-14 bg-surface-2" />
      <Skeleton className="h-5 w-16 bg-surface-2" />
      <Skeleton className="h-3 w-20 bg-surface-2" />
      <Skeleton className="h-7 w-20 bg-surface-2" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Payment row
// ---------------------------------------------------------------------------

interface PaymentRowProps {
  payment: PaymentWithRelations
  onViewPix: (payment: PaymentWithRelations) => void
}

function PaymentRow({ payment, onViewPix }: PaymentRowProps) {
  const [loading, setLoading] = useState(false)

  async function handleMarkPaid() {
    setLoading(true)
    try {
      await markPaymentPaid(payment.id)
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    setLoading(true)
    try {
      await cancelPayment(payment.id)
    } finally {
      setLoading(false)
    }
  }

  const customerName = payment.customer?.full_name ?? "—"
  const workItemTitle = payment.work_item?.title ?? null

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-b border-border last:border-0 hover:bg-surface-2 px-5 py-3.5 text-sm text-ink transition-colors">
      {/* Amount + info */}
      <div className="flex-1 min-w-0">
        <span className="font-mono font-bold text-ink text-sm">
          {formatCurrency(payment.amount)}
        </span>
        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
          <span className="text-xs text-ink-3 truncate">{customerName}</span>
          {workItemTitle && (
            <>
              <span className="text-border-2 text-xs">·</span>
              <span className="text-xs text-ink-3 truncate">{workItemTitle}</span>
            </>
          )}
        </div>
      </div>

      {/* Method */}
      <MethodBadge method={payment.method} />

      {/* Status */}
      <StatusBadge status={payment.status} />

      {/* Date */}
      <span className="font-mono text-xs text-ink-3 whitespace-nowrap">
        {formatDate(payment.created_at)}
      </span>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-1.5">
        <a
          href={`/dashboard/payments/${payment.id}`}
          className="inline-flex items-center gap-1 h-7 px-2.5 text-xs text-ink-3 hover:text-ink hover:bg-surface-2 rounded-md transition-colors"
        >
          <Receipt className="h-3.5 w-3.5" />
          Ver recibo
        </a>
        {payment.method === "pix" && payment.pix_link && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-xs text-ink-3 hover:text-ink hover:bg-surface-2"
            onClick={() => onViewPix(payment)}
          >
            <QrCode className="h-3.5 w-3.5 mr-1" />
            Ver Pix
          </Button>
        )}
        {payment.status === "pending" && (
          <Button
            variant="ghost"
            size="sm"
            disabled={loading}
            className="h-7 px-2.5 text-xs text-brand hover:text-brand-2 hover:bg-tint"
            onClick={handleMarkPaid}
          >
            Marcar como Pago
          </Button>
        )}
        {(payment.status === "pending") && (
          <Button
            variant="ghost"
            size="sm"
            disabled={loading}
            className="h-7 px-2.5 text-xs text-danger hover:text-danger hover:bg-danger/10"
            onClick={handleCancel}
          >
            Cancelar
          </Button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PaymentList
// ---------------------------------------------------------------------------

export function PaymentList({ payments, loading = false }: PaymentListProps) {
  const [pixModalPayment, setPixModalPayment] = useState<PaymentWithRelations | null>(null)

  if (loading) {
    return (
      <Card className="bg-surface border border-border shadow-1">
        <CardContent className="p-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (payments.length === 0) {
    return (
      <Card className="bg-surface border border-border shadow-1">
        <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertCircle className="h-10 w-10 text-ink-4" />
          <p className="text-ink-3 text-sm">Nenhum pagamento encontrado</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="bg-surface border border-border shadow-1">
        <CardContent className="p-0">
          <div className="bg-surface-2 border-b border-border text-xs font-semibold text-ink-3 uppercase tracking-wide px-5 py-3 hidden sm:flex items-center gap-3">
            <span className="flex-1">Valor / Cliente</span>
            <span className="w-20">Método</span>
            <span className="w-20">Status</span>
            <span className="w-24">Data</span>
            <span className="w-40">Ações</span>
          </div>
          {payments.map((payment) => (
            <PaymentRow
              key={payment.id}
              payment={payment}
              onViewPix={setPixModalPayment}
            />
          ))}
        </CardContent>
      </Card>

      {pixModalPayment && (
        <PixModal
          payment={pixModalPayment}
          open={true}
          onClose={() => setPixModalPayment(null)}
        />
      )}
    </>
  )
}
