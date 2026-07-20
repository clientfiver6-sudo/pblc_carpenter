"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { requestPasswordReset } from "@/lib/auth/actions"
import { Logo } from "@/components/Logo"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await requestPasswordReset(email)

    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 py-8 sm:p-8">
      <div className="w-full max-w-sm bg-surface border border-border rounded-xl shadow-2 p-5 sm:p-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {/* Logo */}
        <div className="mb-6">
          <Logo size={30} />
        </div>

        <h1 className="text-xl font-bold text-ink mb-2">Recuperar senha</h1>
        <p className="text-sm text-ink-3 mb-6">
          Enviaremos um link para redefinir sua senha
        </p>

        {success ? (
          <div className="space-y-3 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="text-3xl text-moss">✓</div>
            <p className="text-ink-2 text-sm leading-relaxed">
              Verifique seu email para redefinir a senha. Pode demorar alguns minutos.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-ink-2">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-border rounded-md h-11 px-4 text-sm text-ink bg-surface placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/40"
              />
            </div>

            {error && (
              <div className="rounded-md bg-danger/5 border border-danger/20 px-3 py-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <p className="text-danger text-xs">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || email.trim() === ""}
              className="w-full h-11 rounded-md text-white font-semibold text-sm transition-opacity hover:opacity-90 active:scale-[0.98] transition-transform duration-150 disabled:opacity-60"
              style={{ background: "var(--brand-grad)" }}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Enviar link de recuperação"}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link href="/login" className="text-brand hover:text-brand-2 text-sm">
            ← Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  )
}
