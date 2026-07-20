"use client"

import { useState, useTransition } from "react"
import { Zap, CreditCard, CheckCircle2, AlertCircle, ArrowRight, X, RefreshCw, Loader2 } from "lucide-react"
import { savePaymentSettings } from "@/lib/settings/actions"

const KEY_TYPES = [
  { value: "phone",     label: "Celular",         placeholder: "+55 11 99999-9999" },
  { value: "email",     label: "E-mail",           placeholder: "seu@email.com" },
  { value: "cpf_cnpj", label: "CPF / CNPJ",       placeholder: "000.000.000-00" },
  { value: "random",   label: "Chave aleatória",  placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
]

type Tab = "pix" | "mercadopago"

interface Props {
  hasPixKey: boolean
  mpConnected: boolean
}

function validatePixKey(type: string, value: string): string | null {
  const v = value.trim()
  if (!v) return "Informe a chave Pix"
  switch (type) {
    case "phone": {
      const digits = v.replace(/\D/g, "")
      // Accept 10–11 digits (without country code) or 12–13 (with 55 prefix)
      if (![10, 11, 12, 13].includes(digits.length)) return "Número de telefone inválido"
      if (digits.length >= 12 && !digits.startsWith("55")) return "Número de telefone inválido"
      return null
    }
    case "email": {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return emailRe.test(v) ? null : "E-mail inválido"
    }
    case "cpf_cnpj": {
      const digits = v.replace(/\D/g, "")
      if (digits.length === 11 || digits.length === 14) return null
      return "CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos"
    }
    case "random": {
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      return uuidRe.test(v) ? null : "Formato inválido — deve ser um UUID (ex: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)"
    }
    default:
      return null
  }
}

export function PaymentMethodsPanel({ hasPixKey, mpConnected }: Props) {
  const [tab, setTab] = useState<Tab>(hasPixKey || !mpConnected ? "pix" : "mercadopago")

  // ── Pix state ──────────────────────────────────────────────────────────────
  const [pixKeyType, setPixKeyType] = useState("phone")
  const [pixValue, setPixValue] = useState("")
  const [pixConfirm, setPixConfirm] = useState("")
  const [pixSaved, setPixSaved] = useState(hasPixKey)
  const [pixPending, startPix] = useTransition()
  const [pixError, setPixError] = useState<string | null>(null)
  const [pixConfirmError, setPixConfirmError] = useState<string | null>(null)
  const [pixSuccess, setPixSuccess] = useState(false)
  const [removingPix, setRemovingPix] = useState(false)
  const [editingPix, setEditingPix] = useState(false)

  // ── MP state ───────────────────────────────────────────────────────────────
  const [mpActive, setMpActive] = useState(mpConnected)
  const [disconnectConfirm, setDisconnectConfirm] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const ktEntry = KEY_TYPES.find(k => k.value === pixKeyType)
  const placeholder = ktEntry?.placeholder ?? ""

  function handleKeyTypeChange(v: string) {
    setPixKeyType(v)
    setPixValue("")
    setPixConfirm("")
    setPixError(null)
    setPixConfirmError(null)
  }

  function savePix() {
    // Validate format
    const formatErr = validatePixKey(pixKeyType, pixValue)
    if (formatErr) { setPixError(formatErr); return }

    // Validate confirmation match
    if (pixValue.trim() !== pixConfirm.trim()) {
      setPixConfirmError("As chaves não coincidem")
      return
    }

    setPixError(null)
    setPixConfirmError(null)

    startPix(async () => {
      try {
        await savePaymentSettings({ pix_key: pixValue.trim(), pix_key_type: pixKeyType })
        setPixSaved(true)
        setEditingPix(false)
        setPixValue("")
        setPixConfirm("")
        setPixSuccess(true)
        setTimeout(() => setPixSuccess(false), 3000)
      } catch (e) {
        setPixError(e instanceof Error ? e.message : "Erro ao salvar")
      }
    })
  }

  async function removePix() {
    setRemovingPix(true)
    try {
      await savePaymentSettings({ pix_key: "", pix_key_type: "" })
      setPixSaved(false)
      setPixValue("")
      setPixConfirm("")
      setEditingPix(false)
    } finally {
      setRemovingPix(false)
    }
  }

  async function disconnectMp() {
    setDisconnecting(true)
    try {
      const res = await fetch("/api/mercadopago/disconnect", { method: "POST" })
      if (res.ok) { setMpActive(false); setDisconnectConfirm(false) }
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="w-full space-y-4">
      {/* ── Pill toggle ── */}
      <div className="flex gap-1 p-1 bg-surface-2 rounded-xl w-fit border border-border mx-auto">
        {(["pix", "mercadopago"] as Tab[]).map((t) => {
          const configured = t === "pix" ? pixSaved : mpActive
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-semibold transition-all duration-150 ${
                tab === t ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink-2"
              }`}
            >
              {t === "pix" ? "Pix" : "Mercado Pago"}
              {configured && (
                <span className={`w-1.5 h-1.5 rounded-full bg-moss shrink-0 ${tab === t ? "" : "opacity-60"}`} />
              )}
            </button>
          )
        })}
      </div>

      {/* ── PIX panel ── */}
      {tab === "pix" && (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
            <div className="w-9 h-9 rounded-lg bg-tint flex items-center justify-center shrink-0">
              <Zap className="w-4.5 h-4.5 text-brand" />
            </div>
            <div>
              <p className="text-sm font-bold text-ink">Pix</p>
              <p className="text-xs text-ink-3">Sem taxas · Qualquer banco · Confirmação imediata</p>
            </div>
            {pixSaved && !editingPix && <CheckCircle2 className="w-5 h-5 text-moss ml-auto shrink-0" />}
          </div>

          <div className="px-6 py-5 space-y-4">
            {pixSaved && !editingPix ? (
              /* Configured state */
              <div className="space-y-3">
                {pixSuccess && (
                  <div className="flex items-center gap-2 text-sm text-moss bg-moss/10 border border-moss/20 rounded-lg px-3 py-2.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Chave Pix salva com sucesso!
                  </div>
                )}
                <div className="flex items-center gap-3 rounded-xl border border-moss/30 bg-moss/5 px-4 py-3">
                  <CheckCircle2 className="w-5 h-5 text-moss shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">Chave Pix configurada</p>
                    <p className="text-xs text-ink-3">Clientes podem transferir direto para sua conta</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingPix(true)}
                    className="flex items-center gap-1.5 px-3 h-9 rounded-xl border border-border text-ink-2 text-sm font-semibold hover:bg-surface-2 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Alterar chave
                  </button>
                  <button
                    type="button"
                    onClick={removePix}
                    disabled={removingPix}
                    className="flex items-center gap-1.5 px-3 h-9 rounded-xl border border-danger/30 text-danger text-sm font-semibold hover:bg-danger/5 transition disabled:opacity-40"
                  >
                    {removingPix ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                    Remover
                  </button>
                </div>
              </div>
            ) : (
              /* Setup / edit state */
              <div className="space-y-4">
                <p className="text-xs text-ink-3 leading-relaxed">
                  Informe a chave que seus clientes vão usar para transferir o pagamento direto para a sua conta.
                </p>

                {/* Key type pills */}
                <div className="flex flex-wrap gap-1.5">
                  {KEY_TYPES.map(k => (
                    <button
                      key={k.value}
                      type="button"
                      onClick={() => handleKeyTypeChange(k.value)}
                      className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                        pixKeyType === k.value
                          ? "border-brand bg-brand text-white"
                          : "border-border text-ink-3 hover:border-brand/40 hover:text-ink-2"
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>

                {/* Primary key input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Chave</label>
                  <input
                    type={pixKeyType === "email" ? "email" : "text"}
                    value={pixValue}
                    onChange={e => { setPixValue(e.target.value); setPixError(null) }}
                    placeholder={placeholder}
                    className={`w-full border bg-surface text-ink rounded-lg h-10 px-3 font-mono text-sm focus:outline-none focus:ring-2 placeholder:text-ink-4 transition-colors ${
                      pixError
                        ? "border-danger focus:border-danger focus:ring-danger/20"
                        : "border-border focus:border-brand focus:ring-brand/20"
                    }`}
                  />
                  {pixError && (
                    <div className="flex items-center gap-1.5 text-xs text-danger">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {pixError}
                    </div>
                  )}
                </div>

                {/* Confirm key input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Confirme a chave</label>
                  <input
                    type={pixKeyType === "email" ? "email" : "text"}
                    value={pixConfirm}
                    onChange={e => { setPixConfirm(e.target.value); setPixConfirmError(null) }}
                    placeholder={placeholder}
                    className={`w-full border bg-surface text-ink rounded-lg h-10 px-3 font-mono text-sm focus:outline-none focus:ring-2 placeholder:text-ink-4 transition-colors ${
                      pixConfirmError
                        ? "border-danger focus:border-danger focus:ring-danger/20"
                        : pixConfirm && pixConfirm === pixValue
                        ? "border-moss focus:border-moss focus:ring-moss/20"
                        : "border-border focus:border-brand focus:ring-brand/20"
                    }`}
                  />
                  {pixConfirmError ? (
                    <div className="flex items-center gap-1.5 text-xs text-danger">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {pixConfirmError}
                    </div>
                  ) : pixConfirm && pixConfirm === pixValue ? (
                    <div className="flex items-center gap-1.5 text-xs text-moss">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      Chaves coincidem
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={savePix}
                    disabled={pixPending}
                    className="flex items-center gap-2 px-5 h-10 rounded-lg text-white text-sm font-semibold transition hover:opacity-90 disabled:opacity-40"
                    style={{ background: "var(--brand-grad)" }}
                  >
                    {pixPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {pixPending ? "Salvando…" : "Salvar chave Pix"}
                  </button>
                  {editingPix && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPix(false)
                        setPixValue("")
                        setPixConfirm("")
                        setPixError(null)
                        setPixConfirmError(null)
                      }}
                      className="text-sm text-ink-3 hover:text-ink transition"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Mercado Pago panel ── */}
      {tab === "mercadopago" && (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
            <div className="w-9 h-9 rounded-lg bg-tint flex items-center justify-center shrink-0">
              <CreditCard className="w-4.5 h-4.5 text-brand" />
            </div>
            <div>
              <p className="text-sm font-bold text-ink">Mercado Pago</p>
              <p className="text-xs text-ink-3">Cobranças automáticas pelo chat</p>
            </div>
            {mpActive && <CheckCircle2 className="w-5 h-5 text-moss ml-auto shrink-0" />}
          </div>

          {!mpActive ? (
            /* ── Not connected: inviting empty state ── */
            <div className="px-6 py-8 flex flex-col items-center text-center gap-5">
              <div className="space-y-1.5 max-w-xs">
                <p className="text-base font-bold text-ink">Conecte sua conta</p>
                <p className="text-sm text-ink-3 leading-relaxed">
                  Gere cobranças pelo WhatsApp e receba confirmação automática quando o cliente pagar.
                </p>
              </div>

              <ul className="space-y-2 text-left w-full max-w-xs">
                {[
                  "Envie cobranças pelo chat com um clique",
                  "Cliente paga por QR Code ou link",
                  "Confirmação automática no RetornAI",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-ink-2">
                    <CheckCircle2 className="w-4 h-4 text-moss shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>

              <a
                href="/api/integrations/mercadopago/connect"
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm transition hover:opacity-90 active:scale-[0.98]"
                style={{ background: "var(--brand-grad)" }}
              >
                Entrar com Mercado Pago
                <ArrowRight className="w-4 h-4" />
              </a>

              <p className="text-xs text-ink-4">
                Você será redirecionado para autorizar o RetornAI no Mercado Pago.
              </p>
            </div>
          ) : (
            /* ── Connected state ── */
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-moss/30 bg-moss/5 px-4 py-3">
                <CheckCircle2 className="w-5 h-5 text-moss shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">Conta conectada</p>
                  <p className="text-xs text-ink-3">Autorizado via OAuth</p>
                </div>
              </div>

              {disconnectConfirm ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-3">Tem certeza?</span>
                  <button
                    type="button"
                    onClick={disconnectMp}
                    disabled={disconnecting}
                    className="text-xs font-semibold text-danger hover:opacity-80 disabled:opacity-40 transition"
                  >
                    {disconnecting ? "Desconectando…" : "Sim, desconectar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisconnectConfirm(false)}
                    className="text-xs text-ink-3 hover:text-ink transition"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setDisconnectConfirm(true)}
                  className="flex items-center gap-1.5 px-3 h-9 rounded-xl border border-danger/30 text-danger text-sm font-semibold hover:bg-danger/5 transition"
                >
                  <X className="w-3.5 h-3.5" />
                  Desconectar
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
