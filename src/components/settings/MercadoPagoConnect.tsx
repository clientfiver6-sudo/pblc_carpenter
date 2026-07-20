"use client"

import { CreditCard } from "lucide-react"

export function MercadoPagoConnect() {
  return (
    <a
      href="/api/integrations/mercadopago/connect"
      className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl text-white font-semibold text-sm transition hover:opacity-90 active:scale-[0.98]"
      style={{ background: "var(--brand-grad)" }}
    >
      <CreditCard className="w-4 h-4" />
      Entrar com Mercado Pago
    </a>
  )
}
