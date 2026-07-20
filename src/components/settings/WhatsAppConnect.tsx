"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Loader2, MessageCircle } from "lucide-react"

declare global {
  interface Window {
    FB: {
      init: (params: object) => void
      login: (callback: (response: FBLoginResponse) => void, options: object) => void
    }
    fbAsyncInit: () => void
  }
}

interface FBLoginResponse {
  authResponse?: { accessToken: string; userID: string }
  status: string
}

interface Props {
  onConnected: (phone: string) => void
  initialConnected?: boolean
  initialPhone?: string
}

export function WhatsAppConnect({ onConnected, initialConnected, initialPhone }: Props) {
  const [sdkReady, setSdkReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(initialConnected ?? false)
  const [phone, setPhone] = useState(initialPhone ?? "")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID
    if (!appId) return

    window.fbAsyncInit = function () {
      window.FB.init({ appId, version: "v19.0", xfbml: true, cookie: true })
      setSdkReady(true)
    }

    if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script")
      script.id = "facebook-jssdk"
      script.src = "https://connect.facebook.net/en_US/sdk.js"
      document.body.appendChild(script)
    } else if (window.FB) {
      setSdkReady(true)
    }
  }, [])

  async function handleConnect() {
    if (!sdkReady) return
    setLoading(true)
    setError(null)

    window.FB.login(
      async (response) => {
        if (!response.authResponse) {
          setLoading(false)
          setError("Autorização cancelada.")
          return
        }

        try {
          const res = await fetch("/api/whatsapp/connect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessToken: response.authResponse.accessToken }),
          })
          const data = await res.json() as { error?: string; phone?: string }
          if (!res.ok) throw new Error(data.error ?? "Erro ao conectar")
          const displayPhone = data.phone ?? ""
          setConnected(true)
          setPhone(displayPhone)
          onConnected(displayPhone)
        } catch (err) {
          setError(err instanceof Error ? err.message : "Erro desconhecido")
        } finally {
          setLoading(false)
        }
      },
      {
        scope: "whatsapp_business_management,whatsapp_business_messaging,business_management",
        return_scopes: true,
      }
    )
  }

  if (connected) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-moss/30 bg-moss/5 px-4 py-3">
        <CheckCircle2 className="w-5 h-5 text-moss shrink-0" />
        <div>
          <p className="text-sm font-semibold text-ink">WhatsApp conectado</p>
          {phone && <p className="text-xs text-ink-3">{phone}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleConnect}
        disabled={loading || !sdkReady}
        className="flex items-center gap-2.5 px-5 py-3 rounded-xl text-white font-semibold text-sm transition hover:opacity-90 disabled:opacity-40"
        style={{ background: "var(--brand-grad)" }}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <MessageCircle className="w-4 h-4" />
        )}
        {loading ? "Conectando…" : "Conectar com Meta"}
      </button>

      {!process.env.NEXT_PUBLIC_FACEBOOK_APP_ID && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Configure NEXT_PUBLIC_FACEBOOK_APP_ID nas variáveis de ambiente para ativar a conexão automática.
        </p>
      )}

      {error && (
        <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  )
}
