"use client"

import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { saveCallReturnSettings } from "@/lib/settings/actions"

const DEFAULT_TEMPLATE =
  "Olá! Vimos que você ligou para {{negocio}} e não conseguimos atender. " +
  "Como podemos ajudar? Responda por aqui e retornaremos o mais rápido possível."

export function CallReturnSettingsClient({
  voiceNumber,
  enabled,
  template,
}: {
  voiceNumber: string
  enabled: boolean
  template: string
}) {
  const [loading, setLoading] = useState(false)
  const [voice, setVoice] = useState(voiceNumber)
  const [isEnabled, setIsEnabled] = useState(enabled)
  const [msg, setMsg] = useState(template)
  const { toast } = useToast()

  async function handleSave() {
    setLoading(true)
    try {
      const fd = new FormData()
      fd.set("voice_number", voice)
      fd.set("call_return_enabled", isEnabled ? "true" : "false")
      fd.set("call_return_template", msg)
      const res = await saveCallReturnSettings(fd)
      if (res?.error) {
        toast({ title: "Erro ao salvar", description: res.error, variant: "destructive" })
      } else {
        toast({ title: "Configurações salvas", description: "Retorno de Ligações atualizado." })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <p className="text-sm font-semibold text-ink">Ativar retorno automático</p>
            <p className="text-xs text-ink-3 mt-0.5">
              Envia o WhatsApp automaticamente após uma chamada perdida.
            </p>
          </div>
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
            className="h-5 w-5 accent-brand shrink-0"
          />
        </label>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-ink">Número de voz</label>
        <Input
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
          placeholder="+5511999990000"
        />
        <p className="text-xs text-ink-3">
          Número configurado no provedor de voz (Twilio). Pode ser o mesmo do WhatsApp.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-ink">Mensagem automática</label>
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          rows={4}
          placeholder={DEFAULT_TEMPLATE}
          className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <p className="text-xs text-ink-3">
          Use <code className="text-brand">{"{{negocio}}"}</code> para inserir o nome do seu negócio.
          Se vazio, usamos uma mensagem padrão.
        </p>
      </div>

      <Button onClick={handleSave} disabled={loading}>
        {loading ? "Salvando..." : "Salvar"}
      </Button>
    </div>
  )
}
