"use client"

import { useState, useTransition, useEffect } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Phone, Eye, EyeOff, CheckCircle2, AlertCircle, Copy, Check } from "lucide-react"
import { saveVoiceSettings } from "@/lib/settings/actions"
import { createClient } from "@/lib/supabase/client"

interface VoiceFormData {
  twilio_account_sid: string
  twilio_auth_token: string
  twilio_phone_number: string
  voice_enabled: boolean
}

export default function VoiceSettingsPage() {
  const [form, setForm] = useState<VoiceFormData>({
    twilio_account_sid: "",
    twilio_auth_token: "",
    twilio_phone_number: "",
    voice_enabled: false,
  })
  const [isConfigured, setIsConfigured] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [copied, setCopied] = useState(false)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "")
  const webhookUrl = `${appUrl}/api/webhooks/twilio/voice`

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: rawBu } = await supabase
        .from("business_users")
        .select("business_id")
        .eq("user_id", user.id)
        .single()
      const bu = rawBu as { business_id: string } | null
      if (!bu?.business_id) return

      const { data: rawBiz } = await supabase
        .from("businesses")
        .select("settings")
        .eq("id", bu.business_id)
        .single()
      const biz = rawBiz as { settings: Record<string, unknown> | null } | null
      if (!biz?.settings) return

      const s = biz.settings
      const sid = String(s.twilio_account_sid ?? "")
      const token = String(s.twilio_auth_token ?? "")
      const phone = String(s.twilio_phone_number ?? "")
      const enabled = Boolean(s.voice_enabled ?? false)

      setForm({
        twilio_account_sid: sid,
        twilio_auth_token: token,
        twilio_phone_number: phone,
        voice_enabled: enabled,
      })
      setIsConfigured(Boolean(sid && token && phone))
    }
    load()
  }, [])

  function handleChange(field: keyof VoiceFormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaveError(null)
    setSaveSuccess(false)

    if (!form.twilio_account_sid.trim() || !form.twilio_auth_token.trim() || !form.twilio_phone_number.trim()) {
      setSaveError("Preencha todos os campos obrigatórios")
      return
    }

    startTransition(async () => {
      const result = await saveVoiceSettings({
        twilio_account_sid: form.twilio_account_sid.trim(),
        twilio_auth_token: form.twilio_auth_token.trim(),
        twilio_phone_number: form.twilio_phone_number.trim(),
        voice_enabled: form.voice_enabled,
      })
      if (result.error) {
        setSaveError(result.error)
      } else {
        setIsConfigured(true)
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    })
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: ignore
    }
  }

  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-6 md:px-4 sm:px-6 md:px-8 py-7 pb-28 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-tint">
          <Phone className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-ink">Canal de Voz</h2>
          <p className="text-sm text-ink-3">Receba ligações com a recepcionista IA via Twilio</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Status */}
        <Card className="bg-surface border-border shadow-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-ink">Estado da Conexão</CardTitle>
              {isConfigured ? (
                <Badge variant="moss" className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Configurado
                </Badge>
              ) : (
                <Badge variant="secondary" className="flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Não configurado
                </Badge>
              )}
            </div>
            <CardDescription className="text-ink-3">
              {isConfigured
                ? "Seu canal de voz está configurado. Configure o webhook no Twilio para ativar."
                : "Configure suas credenciais do Twilio para receber ligações com a IA."}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Credentials form */}
        <Card className="bg-surface border-border shadow-1">
          <CardHeader>
            <CardTitle className="text-base text-ink">Credenciais do Twilio</CardTitle>
            <CardDescription className="text-ink-3">
              Encontre estas informações no Twilio Console
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="twilio_account_sid" className="text-ink-2">
                  Account SID
                </Label>
                <Input
                  id="twilio_account_sid"
                  value={form.twilio_account_sid}
                  onChange={(e) => handleChange("twilio_account_sid", e.target.value)}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="border-border bg-surface text-ink placeholder:text-ink-4 focus:border-brand focus:ring-2 focus:ring-brand/20 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="twilio_auth_token" className="text-ink-2">
                  Auth Token
                </Label>
                <div className="relative">
                  <Input
                    id="twilio_auth_token"
                    value={form.twilio_auth_token}
                    onChange={(e) => handleChange("twilio_auth_token", e.target.value)}
                    type={showToken ? "text" : "password"}
                    placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="border-border bg-surface text-ink placeholder:text-ink-4 focus:border-brand focus:ring-2 focus:ring-brand/20 font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink transition-colors"
                    aria-label={showToken ? "Ocultar token" : "Mostrar token"}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="twilio_phone_number" className="text-ink-2">
                  Número de Telefone Twilio
                </Label>
                <Input
                  id="twilio_phone_number"
                  value={form.twilio_phone_number}
                  onChange={(e) => handleChange("twilio_phone_number", e.target.value)}
                  placeholder="+5511999999999"
                  className="border-border bg-surface text-ink placeholder:text-ink-4 focus:border-brand focus:ring-2 focus:ring-brand/20 font-mono"
                />
                <p className="text-xs text-ink-3">
                  Formato E.164 com código do país (ex: +5511999999999)
                </p>
              </div>

              <div className="flex items-center gap-3 py-1">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.voice_enabled}
                  onClick={() => handleChange("voice_enabled", !form.voice_enabled)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none ${
                    form.voice_enabled ? "bg-brand" : "bg-border"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
                      form.voice_enabled ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
                <Label
                  className="text-ink-2 cursor-pointer"
                  onClick={() => handleChange("voice_enabled", !form.voice_enabled)}
                >
                  Canal de voz ativo
                </Label>
              </div>

              {saveError && (
                <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">
                  {saveError}
                </p>
              )}
              {saveSuccess && (
                <p className="text-sm text-moss bg-moss/5 border border-moss/20 rounded-lg px-3 py-2">
                  Configurações salvas com sucesso!
                </p>
              )}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isPending}
                  className="text-white font-semibold disabled:opacity-50"
                  style={{ background: "var(--brand-grad)" }}
                >
                  {isPending ? "Salvando..." : "Salvar credenciais"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Webhook URL */}
        <Card className="bg-surface border-border shadow-1">
          <CardHeader>
            <CardTitle className="text-base text-ink">Configuração do Webhook</CardTitle>
            <CardDescription className="text-ink-3">
              Configure este URL no Twilio Console em{" "}
              <span className="text-ink">Phone Numbers → Manage → Active Numbers → Voice Configuration</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label className="text-ink-2 text-sm">URL do Webhook (POST)</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-surface-2 border border-border px-3 py-2 text-sm text-brand font-mono break-all">
                {webhookUrl}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 h-9 w-9 flex items-center justify-center rounded-md border border-border text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
                aria-label="Copiar URL"
              >
                {copied ? <Check className="h-4 w-4 text-moss" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-ink-3">
              Defina o método como <span className="text-ink">HTTP POST</span> no campo &quot;A Call Comes In&quot;
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
