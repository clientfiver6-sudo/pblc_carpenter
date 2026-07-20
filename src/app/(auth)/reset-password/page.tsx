"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { updatePassword } from "@/lib/auth/actions"
import { Logo } from "@/components/Logo"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function checkSession() {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        router.replace("/login")
      } else {
        setValidating(false)
      }
    }
    void checkSession()
  }, [router])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.")
      return
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.")
      return
    }

    setLoading(true)
    const result = await updatePassword(password)
    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      router.push("/dashboard")
    }
  }

  const pageWrapper = (content: React.ReactNode) => (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 py-8 sm:p-8">
      <div className="w-full max-w-sm bg-surface border border-border rounded-xl shadow-2 p-5 sm:p-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {/* Logo */}
        <div className="mb-6">
          <Logo size={30} />
        </div>
        {content}
      </div>
    </div>
  )

  if (validating) {
    return pageWrapper(
      <p className="text-ink-3 text-sm text-center py-6">Verificando sessão...</p>
    )
  }

  return pageWrapper(
    <>
      <h1 className="text-xl font-bold text-ink mb-2">Redefinir senha</h1>
      <p className="text-sm text-ink-3 mb-6">
        Escolha uma nova senha para sua conta
      </p>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium text-ink-2">
            Nova senha
          </label>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-border rounded-md h-11 px-4 text-sm text-ink bg-surface placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/40"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-ink-2">
            Confirmar nova senha
          </label>
          <input
            id="confirmPassword"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
          disabled={loading || password === "" || confirmPassword === ""}
          className="w-full h-11 rounded-md text-white font-semibold text-sm transition-opacity hover:opacity-90 active:scale-[0.98] transition-transform duration-150 disabled:opacity-60"
          style={{ background: "var(--brand-grad)" }}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Redefinir senha"}
        </button>
      </form>
    </>
  )
}
