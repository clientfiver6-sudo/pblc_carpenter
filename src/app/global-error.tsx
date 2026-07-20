"use client"

import { useEffect } from "react"

export default function GlobalError({
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
    <html lang="pt-BR">
      <body style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", margin: 0, fontFamily: "system-ui, sans-serif", background: "#fafafa" }}>
        <div style={{ textAlign: "center", maxWidth: 400, padding: "2rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem", color: "#111" }}>
            Algo deu errado
          </h1>
          <p style={{ color: "#666", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
            Ocorreu um erro inesperado. Tente recarregar a página.
          </p>
          {process.env.NODE_ENV === "development" && (
            <pre style={{ textAlign: "left", fontSize: "0.75rem", color: "#c00", background: "#fff0f0", borderRadius: 8, padding: "0.75rem", overflow: "auto", maxHeight: 128, marginBottom: "1rem" }}>
              {error.message}
            </pre>
          )}
          {error.digest && (
            <p style={{ fontSize: "0.7rem", color: "#999", fontFamily: "monospace", marginBottom: "1rem" }}>
              ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{ padding: "0.5rem 1.5rem", background: "#7c3aed", color: "white", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  )
}
