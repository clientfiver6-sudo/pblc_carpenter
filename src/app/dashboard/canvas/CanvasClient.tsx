"use client"
import { useState, useRef, useEffect } from "react"
import { FileText, Download, Printer } from "lucide-react"
import { AiReport } from "@/types/database"
import { saoPauloDayStartISO } from "@/lib/utils"

const TEMPLATES = [
  { label: "Relatório Semanal", prompt: "Gere um relatório semanal completo com receita, agendamentos, e clientes em destaque" },
  { label: "Análise de Clientes", prompt: "Analise o perfil dos clientes: segmentação, valor vitalício, risco de churn e oportunidades de upsell" },
  { label: "Previsão de Receita", prompt: "Crie uma análise de previsão de receita para os próximos 30 dias com base nos dados atuais" },
]

const DAILY_LIMIT = 5

export function CanvasClient() {
  const [prompt, setPrompt] = useState("")
  const [html, setHtml] = useState("")
  const [loading, setLoading] = useState(false)
  const [reports, setReports] = useState<AiReport[]>([])
  const [usedToday, setUsedToday] = useState(0)
  const [error, setError] = useState("")
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    fetch("/api/ai/reports")
      .then(res => res.json())
      .then(data => {
        if (data.reports) {
          const all = data.reports as AiReport[]
          setReports(all)
          const todayStart = new Date(saoPauloDayStartISO())
          setUsedToday(all.filter(r => new Date(r.created_at) >= todayStart).length)
        }
      })
      .catch(() => {})
  }, [])

  async function generate() {
    if (!prompt.trim() || loading) return
    setLoading(true)
    setHtml("")
    setError("")

    const res = await fetch("/api/ai/canvas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    })

    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => ({})) as { error?: string }
      setError(body.error ?? "Erro ao gerar relatório.")
      setLoading(false)
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let accumulated = ""

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      accumulated += decoder.decode(value, { stream: true })
      // Don't update the iframe mid-stream — only show the final result
    }
    setHtml(accumulated)
    setUsedToday(n => n + 1)

    // Save it to the list below so the user can reopen or download it later.
    // Optimistic entry (the server persists it in the background); a reload will
    // reconcile it with the canonical row from /api/ai/reports.
    if (accumulated.trim()) {
      const newReport: AiReport = {
        id: `local-${Date.now()}`,
        business_id: "",
        title: prompt.slice(0, 100),
        prompt,
        html_content: accumulated,
        created_by: null,
        created_at: new Date().toISOString(),
      }
      setReports(prev => [newReport, ...prev])
    }
    setLoading(false)
  }

  function slugify(text: string): string {
    return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "relatorio"
  }

  function downloadReport(content: string, title?: string, createdAt?: string) {
    if (!content) return
    const date = (createdAt ?? new Date().toISOString()).slice(0, 10)
    const name = title ? slugify(title) : "relatorio"
    const blob = new Blob([content], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `retornai-${name}-${date}.html`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function printReport() {
    const win = iframeRef.current?.contentWindow
    if (!win) return
    win.focus()
    win.print()
  }

  return (
    <div className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-4 sm:px-6 md:px-8 py-7 pb-28 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink tracking-tight">Canvas IA</h2>
          <p className="text-sm text-ink-3 mt-1">Gere relatórios visuais com inteligência artificial</p>
        </div>
        <span className={`text-xs font-mono px-2.5 py-1 rounded-full border ${usedToday >= DAILY_LIMIT ? "bg-danger/10 text-danger border-danger/20" : "bg-tint text-brand-2 border-brand/20"}`}>
          {DAILY_LIMIT - usedToday} de {DAILY_LIMIT} restantes hoje
        </span>
      </div>

      {/* Prompt area */}
      <div className="border border-border rounded-lg p-4 space-y-3 bg-surface">
        <div className="flex gap-2 flex-wrap">
          {TEMPLATES.map(t => (
            <button
              key={t.label}
              onClick={() => setPrompt(t.prompt)}
              className={`border rounded-lg px-4 py-2 text-sm font-medium transition-[border-color,background-color,color] duration-150 ease-brand-out ${
                prompt === t.prompt
                  ? "border-brand bg-tint text-brand"
                  : "border-border bg-surface text-ink-2 hover:bg-tint hover:border-brand hover:text-brand"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Descreva o relatório que deseja gerar..."
          className="border rounded-lg p-4 w-full text-sm text-ink resize-none h-20 focus:outline-none focus:border-brand"
          style={{ background: "linear-gradient(135deg,#FFF7EF,#FFF1E5)", borderColor: "#F2D9C2" }}
        />
        {error && (
          <p className="text-sm text-danger">{error}</p>
        )}
        <button
          onClick={generate}
          disabled={loading || !prompt.trim() || usedToday >= DAILY_LIMIT}
          className="flex items-center gap-2 h-10 px-5 rounded-md text-white font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "var(--brand-grad)" }}
        >
          {loading ? (
            <><span className="animate-spin">⟳</span> Gerando...</>
          ) : (
            <><span className="text-white">✦</span> Gerar Relatório</>
          )}
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="border border-border rounded-xl overflow-hidden bg-surface space-y-0">
          {/* Top bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-2">
            <div className="h-4 w-40 rounded-full bg-surface animate-pulse" />
            <div className="h-4 w-24 rounded-full bg-surface animate-pulse" />
          </div>
          {/* Metric cards row */}
          <div className="grid grid-cols-3 gap-4 p-6">
            {[1,2,3].map(i => (
              <div key={i} className="rounded-lg border border-border bg-surface-2 p-4 space-y-3 animate-pulse">
                <div className="h-3 w-20 rounded-full bg-surface" />
                <div className="h-7 w-16 rounded-md bg-surface" />
                <div className="h-3 w-14 rounded-full bg-surface" />
              </div>
            ))}
          </div>
          {/* Chart skeleton */}
          <div className="grid grid-cols-2 gap-4 px-6 pb-6">
            <div className="rounded-lg border border-border bg-surface-2 p-4 animate-pulse">
              <div className="h-3 w-28 rounded-full bg-surface mb-4" />
              <div className="h-40 rounded-lg bg-surface" />
            </div>
            <div className="rounded-lg border border-border bg-surface-2 p-4 animate-pulse">
              <div className="h-3 w-28 rounded-full bg-surface mb-4" />
              <div className="h-40 rounded-full bg-surface" />
            </div>
          </div>
          {/* Message */}
          <div className="flex items-center justify-center gap-2 py-4 border-t border-border text-ink-3 text-sm">
            <span className="animate-spin text-brand">⟳</span>
            A IA está gerando seu relatório — não saia desta página
          </div>
        </div>
      )}

      {/* iframe result */}
      {html && !loading && (
        <div className="border border-border rounded-xl overflow-hidden bg-surface">
          {/* Toolbar */}
          <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-b border-border bg-surface-2">
            <button
              onClick={printReport}
              className="flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium text-ink-2 border border-border bg-surface hover:bg-tint hover:border-brand hover:text-brand transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimir / PDF
            </button>
            <button
              onClick={() => downloadReport(html)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ background: "var(--brand-grad)" }}
            >
              <Download className="w-3.5 h-3.5" /> Baixar
            </button>
          </div>
          <div style={{ background: "#FBF8F3" }}>
            <iframe
              ref={iframeRef}
              sandbox="allow-scripts allow-same-origin allow-modals"
              srcDoc={html}
              className="w-full"
              style={{ minHeight: 700, height: "auto", border: "none", display: "block" }}
              title="Relatório IA"
              onLoad={(e) => {
                const iframe = e.currentTarget
                try {
                  const h = iframe.contentDocument?.documentElement?.scrollHeight
                  if (h && h > 600) iframe.style.height = h + "px"
                } catch { /* cross-origin guard */ }
              }}
            />
          </div>
        </div>
      )}

      {/* Saved reports */}
      {reports.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-ink-3">Relatórios salvos</h2>
          {reports.map(r => (
            <div
              key={r.id}
              className="group flex items-center justify-between gap-3 bg-surface border border-border rounded-lg p-3 cursor-pointer hover:shadow-1 hover:border-border-2 transition-[box-shadow,border-color] duration-150 ease-brand-out"
              onClick={() => setHtml(r.html_content)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-brand shrink-0" />
                <span className="text-sm font-semibold text-ink truncate">{r.title}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-ink-4 font-mono">{new Date(r.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); downloadReport(r.html_content, r.title, r.created_at) }}
                  title="Baixar relatório"
                  className="flex items-center justify-center h-8 w-8 rounded-md text-ink-3 hover:text-brand hover:bg-tint transition-colors"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
