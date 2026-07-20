"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeft } from "lucide-react"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-surface border border-border rounded-xl p-8 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-danger mx-auto" />
        <h1 className="text-lg font-bold text-ink mb-2">Algo deu errado</h1>
        <p className="text-sm text-ink-3">
          Ocorreu um erro inesperado. Nossa equipe foi notificada.
        </p>
        {process.env.NODE_ENV === "development" && (
          <pre className="text-left text-xs text-danger bg-danger/5 rounded p-3 overflow-auto max-h-32">
            {error.message}
          </pre>
        )}
        {error.digest && (
          <p className="text-ink-4 text-xs font-mono">ID: {error.digest}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            onClick={reset}
            className="h-10 px-5 rounded-md text-white font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ background: "var(--brand-grad)" }}
          >
            Tentar novamente
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  )
}
