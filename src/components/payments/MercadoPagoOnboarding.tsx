"use client"

import { QrCode, Smartphone, ShieldCheck, CreditCard } from "lucide-react"
import { MercadoPagoConnect } from "@/components/settings/MercadoPagoConnect"

const steps = [
  "Clique em \"Entrar com Mercado Pago\"",
  "Faça login na sua conta Mercado Pago",
  "Autorize o RetornAI — pronto!",
]

const benefits = [
  { icon: QrCode, text: "Cobranças via Pix com QR Code automático" },
  { icon: Smartphone, text: "Links de pagamento por cartão de crédito" },
  { icon: ShieldCheck, text: "Status de pagamento em tempo real" },
]

export function MercadoPagoOnboarding() {
  return (
    <div className="flex h-[calc(100vh-56px)] items-center justify-center bg-bg p-6">
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-surface overflow-hidden shadow-sm flex flex-col md:flex-row">
        {/* Left — hero */}
        <div className="md:w-[45%] bg-tint/30 p-8 flex flex-col justify-center gap-6 border-b md:border-b-0 md:border-r border-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-brand" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider">Mercado Pago</p>
              <p className="text-base font-bold text-ink">Pagamentos</p>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-ink leading-snug">
              Receba pagamentos via Pix e cartão automaticamente
            </h2>
            <p className="text-sm text-ink-3 mt-2 leading-relaxed">
              Conecte sua conta Mercado Pago para gerar cobranças e acompanhar recebimentos em tempo real.
            </p>
          </div>

          <ul className="space-y-3">
            {benefits.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-brand" />
                </div>
                <span className="text-sm text-ink-2">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right — action */}
        <div className="md:w-[55%] p-8 flex flex-col justify-center gap-8">
          <div>
            <p className="text-sm font-semibold text-ink mb-4">Como conectar</p>
            <ol className="space-y-3">
              {steps.map((label, i) => (
                <li key={label} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full border-2 border-brand/40 bg-brand/5 text-brand text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm text-ink-2">{label}</span>
                </li>
              ))}
            </ol>
          </div>

          <MercadoPagoConnect />
        </div>
      </div>
    </div>
  )
}
