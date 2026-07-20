"use client"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle, Loader2 } from "lucide-react"
import { markPaymentPaid } from "@/lib/payments/actions"

export function MarkPaidButton({ paymentId }: { paymentId: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleClick() {
    startTransition(async () => {
      await markPaymentPaid(paymentId)
      router.refresh()
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center gap-1.5 px-3 h-8 rounded-md text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
      style={{ background: "var(--brand-grad)" }}
    >
      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
      Marcar como pago
    </button>
  )
}
