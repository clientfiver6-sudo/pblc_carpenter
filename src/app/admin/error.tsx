"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[admin error]", error)
  }, [error])

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full bg-surface border border-danger/30 rounded-xl p-8 space-y-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-danger shrink-0" />
          <h1 className="text-base font-bold text-ink">Erro no painel admin</h1>
        </div>
        <pre className="text-xs text-danger bg-danger/5 rounded-lg p-4 overflow-auto max-h-48 whitespace-pre-wrap break-all">
          {error.message || "Unknown error"}
          {error.stack ? "\n\n" + error.stack : ""}
        </pre>
        {error.digest && (
          <p className="text-ink-4 text-xs font-mono">digest: {error.digest}</p>
        )}
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="h-9 px-4 rounded-md bg-surface-2 border border-border text-sm font-medium text-ink hover:bg-surface-3 transition-colors"
          >
            Tentar novamente
          </button>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center h-9 px-4 rounded-md border border-border text-sm font-medium text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors"
          >
            Ir para o início
          </Link>
        </div>
      </div>
    </div>
  )
}
