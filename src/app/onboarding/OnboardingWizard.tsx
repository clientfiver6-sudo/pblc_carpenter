"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { BUSINESS_TYPE_OPTIONS } from "@/lib/config/business-types"
import { setupBusiness } from "./actions"
import { ChevronRight, Loader2, CheckCircle2, ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/Logo"
import { signOut } from "@/lib/auth/actions"

type Step = 1 | 2

export function OnboardingWizard() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [businessType, setBusinessType] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const step1Valid = businessType !== "" && businessName.trim().length >= 2

  function handleComplete() {
    setError(null)
    startTransition(async () => {
      const result = await setupBusiness({
        name: businessName.trim(),
        type: businessType,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      setStep(2)
      setTimeout(() => router.push("/dashboard"), 1800)
    })
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center px-4 py-12">
      {/* Back button */}
      <div className="absolute top-5 left-5">
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
      </div>

      {/* Logo */}
      <div className="mb-10">
        <Logo size={36} />
      </div>

      {/* ── Step 1: Business type + name ── */}
      {step === 1 && (
        <div className="w-full max-w-lg space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-ink">Qual é o seu negócio?</h1>
            <p className="text-sm text-ink-3">Vamos personalizar o RetornAI para você</p>
          </div>

          {/* Type grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {BUSINESS_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setBusinessType(opt.value)}
                className={cn(
                  "flex flex-col items-center gap-1.5 px-3 py-3.5 rounded-xl border text-center transition-[border-color,background-color] duration-150 ease-brand-out",
                  businessType === opt.value
                    ? "border-brand bg-tint"
                    : "border-border bg-surface hover:border-border-2 hover:bg-surface-2"
                )}
              >
                <span className="text-2xl leading-none">{opt.icon || "🏢"}</span>
                <span className={cn(
                  "text-xs font-medium leading-tight",
                  businessType === opt.value ? "text-brand" : "text-ink-2"
                )}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>

          {/* Business name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
              Nome do negócio
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Ex: TechFrio Climatização, Elétrica do João, Limpeza Express..."
              className="w-full h-11 rounded-lg border border-border bg-surface px-4 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-brand transition-colors"
            />
          </div>

          {error && (
            <p className="text-xs text-danger text-center">{error}</p>
          )}

          <button
            type="button"
            disabled={!step1Valid || isPending}
            onClick={handleComplete}
            className={cn(
              "w-full h-11 rounded-lg text-white font-semibold flex items-center justify-center gap-2 transition-opacity",
              step1Valid && !isPending ? "opacity-100" : "opacity-40 cursor-not-allowed"
            )}
            style={{ background: "var(--brand-grad)" }}
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Começar
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}

      {/* Sign-out escape */}
      {step === 1 && (
        <form action={signOut} className="mt-6">
          <button type="submit" className="text-xs text-ink-4 hover:text-ink-3 transition-colors">
            Entrar com outra conta
          </button>
        </form>
      )}

      {/* ── Step 2: Done ── */}
      {step === 2 && (
        <div className="w-full max-w-sm text-center space-y-5">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: "var(--brand-grad)" }}
          >
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-ink">Tudo pronto!</h1>
            <p className="text-sm text-ink-3">Levando você ao dashboard...</p>
          </div>
          <Loader2 className="w-5 h-5 animate-spin text-brand mx-auto" />
        </div>
      )}
    </div>
  )
}
