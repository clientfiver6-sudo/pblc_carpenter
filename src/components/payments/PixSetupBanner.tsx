"use client"

import { useState, useTransition } from "react"
import { QrCode, Sparkles, Phone, Mail, Hash, Shuffle, CheckCircle2 } from "lucide-react"
import { MercadoPagoConnect } from "@/components/settings/MercadoPagoConnect"
import { savePaymentSettings } from "@/lib/settings/actions"

const KEY_TYPES = [
  { value: "phone",    label: "Celular",          icon: Phone,   placeholder: "+55 11 99999-9999",         hint: "Ex: +5511999999999 ou 11999999999" },
  { value: "email",    label: "E-mail",            icon: Mail,    placeholder: "seu@email.com",             hint: "O mesmo e-mail cadastrado no banco" },
  { value: "cpf_cnpj",label: "CPF / CNPJ",        icon: Hash,    placeholder: "000.000.000-00",            hint: "Só números: CPF (11 dígitos) ou CNPJ (14)" },
  { value: "random",  label: "Chave aleatória",   icon: Shuffle, placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", hint: "Cole a chave aleatória gerada pelo seu banco" },
]

interface PixSetupBannerProps {
  hasPixKey: boolean
}

export function PixSetupBanner({ hasPixKey }: PixSetupBannerProps) {
  const [mode, setMode] = useState<"choice" | "mp" | "pix">(hasPixKey ? "pix" : "choice")
  const [keyType, setKeyType] = useState("phone")
  const [keyValue, setKeyValue] = useState("")
  const [saved, setSaved] = useState(hasPixKey)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const selectedType = KEY_TYPES.find(t => t.value === keyType)!

  function handleSavePix() {
    if (!keyValue.trim()) { setError("Informe a chave Pix"); return }
    setError(null)
    startTransition(async () => {
      try {
        await savePaymentSettings({ pix_key: keyValue.trim(), pix_key_type: keyType })
        setSaved(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao salvar")
      }
    })
  }

  if (saved) {
    return (
      <div className="rounded-xl border border-moss/30 bg-moss/5 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-moss shrink-0" />
          <div>
            <p className="text-sm font-semibold text-ink">Chave Pix configurada</p>
            <p className="text-xs text-ink-3">
              Pagamentos manuais via Pix. Para detecção automática,{" "}
              <a href="/dashboard/settings/payments" className="text-brand underline underline-offset-2">
                conecte o Mercado Pago
              </a>
              .
            </p>
          </div>
        </div>
        <a
          href="/dashboard/settings/payments"
          className="shrink-0 text-xs text-ink-3 hover:text-brand transition-colors"
        >
          Editar →
        </a>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-brand/20 bg-tint/30 p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-tint flex items-center justify-center">
          <QrCode className="w-4 h-4 text-brand" />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">Configure seu recebimento</p>
          <p className="text-xs text-ink-3">Adicione uma chave Pix ou conecte o Mercado Pago para cobrar clientes</p>
        </div>
      </div>

      {mode === "choice" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Pix key option */}
          <button
            type="button"
            onClick={() => setMode("pix")}
            className="flex items-start gap-3 p-4 rounded-lg border border-border bg-surface hover:border-brand/40 hover:bg-tint/20 transition-colors text-left"
          >
            <QrCode className="w-5 h-5 text-brand shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-ink">Só Pix</p>
              <p className="text-xs text-ink-3 mt-0.5">Adicione sua chave Pix. A IA envia ela por WhatsApp automaticamente. Você confirma o pagamento manualmente.</p>
            </div>
          </button>

          {/* MercadoPago option */}
          <button
            type="button"
            onClick={() => setMode("mp")}
            className="flex items-start gap-3 p-4 rounded-lg border border-border bg-surface hover:border-brand/40 hover:bg-tint/20 transition-colors text-left"
          >
            <Sparkles className="w-5 h-5 text-brand shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-ink">Mercado Pago</p>
              <p className="text-xs text-ink-3 mt-0.5">QR Code automático + detecção de pagamento em tempo real. Recomendado.</p>
            </div>
          </button>
        </div>
      )}

      {mode === "mp" && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setMode("choice")}
            className="text-xs text-ink-3 hover:text-ink transition-colors"
          >
            ← Voltar
          </button>
          <MercadoPagoConnect />
          <p className="text-xs text-ink-4">
            Ou prefere só Pix?{" "}
            <button type="button" onClick={() => setMode("pix")} className="text-brand underline underline-offset-2">
              Adicionar chave Pix
            </button>
          </p>
        </div>
      )}

      {mode === "pix" && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setMode("choice")}
            className="text-xs text-ink-3 hover:text-ink transition-colors"
          >
            ← Voltar
          </button>

          {/* Key type pills */}
          <div>
            <p className="text-xs font-medium text-ink-3 mb-2">Tipo da chave Pix</p>
            <div className="flex flex-wrap gap-2">
              {KEY_TYPES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => { setKeyType(value); setKeyValue("") }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    keyType === value
                      ? "border-brand bg-brand text-white"
                      : "border-border bg-surface text-ink-2 hover:border-brand/40 hover:text-ink"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Key value input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink-3">
              {selectedType.label}
            </label>
            <input
              type={keyType === "email" ? "email" : "text"}
              value={keyValue}
              onChange={e => { setKeyValue(e.target.value); setError(null) }}
              placeholder={selectedType.placeholder}
              className="w-full border border-border bg-surface text-ink rounded-lg h-10 px-3 font-mono text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 placeholder:text-ink-4"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-xs text-ink-4">{selectedType.hint}</p>
          </div>

          {error && (
            <p className="text-xs text-danger bg-danger/8 border border-danger/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSavePix}
              disabled={isPending || !keyValue.trim()}
              className="flex items-center gap-1.5 px-4 h-10 rounded-lg text-white text-sm font-semibold transition hover:opacity-90 disabled:opacity-40"
              style={{ background: "var(--brand-grad)" }}
            >
              {isPending ? "Salvando…" : "Salvar chave Pix"}
            </button>
            <p className="text-xs text-ink-4">
              Detecção automática não disponível.{" "}
              <button type="button" onClick={() => setMode("mp")} className="text-brand underline underline-offset-2">
                Use o Mercado Pago
              </button>{" "}
              para receber confirmação em tempo real.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
