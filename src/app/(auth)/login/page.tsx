"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2 } from "lucide-react"
import { signIn } from "@/lib/auth/actions"
import { Logo } from "@/components/Logo"

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [showRecoveryHint, setShowRecoveryHint] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(fd: FormData) {
    startTransition(async () => {
      setError(null)
      const result = await signIn(fd)
      if (result?.error) {
        setError(result.error)
        return
      }
      if (result?.redirect) {
        router.push(result.redirect)
      }
    })
  }

  return (
    <div className="min-h-screen flex">
      {/* LEFT — brand */}
      <div
        className="hidden lg:flex lg:w-[42%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "var(--brand-grad)" }}
      >
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at top left, rgba(255,255,255,0.12) 0%, transparent 55%)" }}
        />
        <div className="absolute bottom-0 right-0 pointer-events-none w-[400px] h-[400px]"
          style={{ background: "radial-gradient(ellipse at bottom right, rgba(0,0,0,0.10) 0%, transparent 65%)" }}
        />
        <Logo size={32} onDark />
        <div className="space-y-5 relative z-10">
          <p className="font-display text-[44px] leading-tight text-white">
            Seu negócio,<br />mais inteligente.
          </p>
          <p className="text-base leading-relaxed text-white/70">
            IA para o empresário brasileiro — agendamentos, WhatsApp, cobranças e equipe em um só lugar.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap relative z-10">
          {["WhatsApp IA", "Agendamentos", "PIX", "Equipe", "Relatórios"].map((f) => (
            <span key={f} className="px-3 py-1 rounded-full text-xs font-medium border border-white/25 bg-white/15 text-white">
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* RIGHT — login */}
      <div className="flex-1 flex items-center justify-center bg-bg px-4 py-10 sm:px-8">
        <div className="w-full max-w-md space-y-7 animate-in fade-in slide-in-from-bottom-2 duration-300">

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </Link>

          <div>
            <h2 className="text-2xl font-bold text-ink tracking-tight">Entrar</h2>
            <p className="text-ink-3 text-sm mt-1">Acesse sua conta RetornAI</p>
          </div>

          <form action={handleSubmit} className="space-y-3">
            {error && (
              <div className="border border-danger/30 bg-danger/5 text-danger rounded-md px-4 py-3 text-sm">
                {error}
              </div>
            )}
            <input
              name="email"
              type="email"
              placeholder="E-mail"
              autoComplete="email"
              required
              className="w-full border border-border rounded-md h-11 px-4 text-sm text-ink bg-surface placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/40"
            />
            <input
              name="password"
              type="password"
              placeholder="Senha"
              autoComplete="current-password"
              required
              className="w-full border border-border rounded-md h-11 px-4 text-sm text-ink bg-surface placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/40"
            />
            <button
              type="submit"
              disabled={isPending}
              className="w-full h-11 rounded-md text-white font-semibold text-sm hover:opacity-90 active:scale-[0.97] transition-[opacity,transform] duration-150 ease-brand-out disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: "var(--brand-grad)" }}
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isPending ? "Entrando..." : "Entrar"}
            </button>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowRecoveryHint(v => !v)}
                  className="text-ink-3 hover:text-brand transition-colors text-left"
                >
                  Esqueceu a senha?
                </button>
                {showRecoveryHint && (
                  <span className="text-xs text-ink-3">Fale conosco para recuperar sua conta.</span>
                )}
              </div>
              <Link href="/register" className="text-brand hover:text-brand-2 font-medium transition-colors">
                Criar conta
              </Link>
            </div>
          </form>

        </div>
      </div>
    </div>
  )
}
