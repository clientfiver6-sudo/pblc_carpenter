"use client"

import { useState, useTransition } from "react"
import { Copy, Check, Loader2, Sparkles, Save } from "lucide-react"
import { createMercadoPagoPlans, saveMercadoPagoToken } from "./actions"

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="flex items-center gap-1 text-xs font-medium text-ink-3 hover:text-ink transition-colors shrink-0"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-moss" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  )
}

export function TokenInputForm() {
  const [token, setToken] = useState("")
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ error?: string; ok?: boolean } | null>(null)

  function handleSave() {
    startTransition(async () => {
      const res = await saveMercadoPagoToken(token)
      setResult(res.error ? { error: res.error } : { ok: true })
      if (!res.error) setToken("")
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="password"
          placeholder="APP_USR-…"
          value={token}
          onChange={e => setToken(e.target.value)}
          className="flex-1 font-mono text-sm bg-surface-2 border border-border rounded-lg px-3 py-2 text-ink placeholder:text-ink-4 focus:outline-none focus:ring-1 focus:ring-brand/40"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !token.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ background: "var(--brand-grad)" }}
        >
          {isPending
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</>
            : <><Save className="w-4 h-4" /> Salvar</>}
        </button>
      </div>
      {result?.error && <p className="text-xs text-danger">{result.error}</p>}
      {result?.ok && <p className="text-xs text-moss">Token salvo com sucesso.</p>}
    </div>
  )
}

export function CreatePlansButton() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [result, setResult] = useState<{ starterId?: string; proId?: string; medicalId?: string; error?: string } | null>(null)

  async function handleCreate() {
    setState("loading")
    const res = await createMercadoPagoPlans()
    setResult(res)
    setState(res.error ? "error" : "done")
  }

  if (state === "done" && result?.starterId && result?.proId) {
    return (
      <div className="space-y-3">
        <p className="text-xs font-semibold text-moss">Planos criados e salvos no banco de dados!</p>
        {[
          { label: "Starter Plan ID", value: result.starterId },
          { label: "Pro Plan ID",     value: result.proId },
          { label: "Medical Plan ID", value: result.medicalId },
        ].filter(({ value }) => !!value).map(({ label, value }) => (
          <div key={label} className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] text-ink-3">{label}</p>
              <p className="font-mono text-xs text-ink truncate">{value}</p>
            </div>
            <CopyButton text={value ?? ""} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {state === "error" && <p className="text-xs text-danger">{result?.error}</p>}
      <button
        type="button"
        onClick={handleCreate}
        disabled={state === "loading"}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 transition-opacity hover:opacity-90"
        style={{ background: "var(--brand-grad)" }}
      >
        {state === "loading"
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando planos…</>
          : <><Sparkles className="w-4 h-4" /> Criar planos no Mercado Pago</>}
      </button>
      <p className="text-[11px] text-ink-4">
        Cria os planos Starter (R$149,90/mês), Pro (R$199,90/mês) e Medical (R$249,90/mês) e salva os IDs automaticamente.
      </p>
    </div>
  )
}
