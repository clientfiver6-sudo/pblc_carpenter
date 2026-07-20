"use client"
import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ShieldCheck, Clock, CheckCircle2, XCircle } from "lucide-react"

interface Approval {
  id: string
  tool_name: string
  tool_input: Record<string, unknown>
  status: "pending" | "approved" | "rejected"
  resolution_note: string | null
  created_at: string
  resolved_at: string | null
  conversation_id: string | null
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "agora"
  if (mins < 60) return `${mins}m atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  return `${Math.floor(hours / 24)}d atrás`
}

function toolLabel(name: string): string {
  if (name === "cancel_work_item") return "Cancelar agendamento"
  if (name === "handoff_to_human") return "Transferir para humano"
  return name
}

function toolBadgeVariant(name: string): string {
  if (name === "cancel_work_item") return "bg-danger/10 text-danger border border-danger/20"
  if (name === "handoff_to_human") return "bg-warning/10 text-warning border border-warning/20"
  return "bg-surface-2 text-ink-2 border border-border"
}

export function ApprovalsClient() {
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/ai/approvals")
      if (res.ok) {
        const json = await res.json() as { approvals: Approval[] }
        setApprovals(json.approvals)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function decide(id: string, decision: "approved" | "rejected") {
    setActing(id)
    try {
      await fetch(`/api/ai/approvals/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      })
      await load()
    } finally {
      setActing(null)
    }
  }

  const pending = approvals.filter((a) => a.status === "pending")
  const resolved = approvals.filter((a) => a.status !== "pending").slice(0, 20)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-4 sm:px-6 md:px-8 py-7 pb-28 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-tint flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-brand" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Aprovações</h1>
          <p className="text-sm text-ink-3 mt-0.5">Ações da IA que aguardam confirmação</p>
        </div>
      </div>

      {/* Pending */}
      <section>
        <h2 className="text-xs font-semibold text-ink-3 uppercase tracking-widest mb-4">
          Pendentes {pending.length > 0 && `(${pending.length})`}
        </h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="bg-surface-2 border border-border rounded-xl animate-pulse h-28" />
            ))}
          </div>
        ) : pending.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl py-14 flex flex-col items-center gap-2">
            <span className="text-brand font-bold text-2xl">✦</span>
            <p className="text-sm text-ink-3">Nenhuma aprovação pendente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((a) => (
              <div
                key={a.id}
                className="bg-surface border border-border rounded-xl p-5"
                style={{ boxShadow: "var(--shadow-1)" }}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${toolBadgeVariant(a.tool_name)}`}>
                      {toolLabel(a.tool_name)}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-ink-4">
                      <Clock className="w-3 h-3" />
                      {timeAgo(a.created_at)}
                    </span>
                  </div>
                </div>

                {Object.keys(a.tool_input).length > 0 && (
                  <div className="bg-surface-2 border border-border rounded-md px-3 py-2 mb-4 text-xs font-mono text-ink-3">
                    {Object.entries(a.tool_input).map(([k, v]) => (
                      <div key={k}>
                        <span className="text-brand-2 font-semibold">{k}</span>
                        {": "}
                        <span className="text-ink-2">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {a.conversation_id && (
                  <p className="text-xs text-ink-3 mb-4">
                    Conversa:{" "}
                    <a
                      href={`/dashboard/conversations?id=${a.conversation_id}`}
                      className="text-brand hover:text-brand-2 underline"
                    >
                      ver conversa
                    </a>
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={acting === a.id}
                    onClick={() => void decide(a.id, "approved")}
                    className="flex items-center gap-1.5 text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: "var(--brand-grad)" }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acting === a.id}
                    onClick={() => void decide(a.id, "rejected")}
                    className="flex items-center gap-1.5 text-sm font-semibold bg-danger/10 text-danger border-danger/20 hover:bg-danger/20 disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Rejeitar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Resolved */}
      {resolved.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-ink-3 uppercase tracking-widest mb-4">
            Resolvidas recentemente
          </h2>
          <div className="space-y-2">
            {resolved.map((a) => (
              <div
                key={a.id}
                className="bg-surface border border-border rounded-xl px-4 py-3 flex items-center gap-3 opacity-80"
              >
                {a.status === "approved" ? (
                  <CheckCircle2 className="w-4 h-4 text-moss shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-danger shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-ink">{toolLabel(a.tool_name)}</span>
                  {a.resolution_note && (
                    <span className="ml-2 text-xs text-ink-3">— {a.resolution_note}</span>
                  )}
                </div>
                <Badge
                  variant={a.status === "approved" ? "moss" : "destructive"}
                  className="shrink-0 text-[10px]"
                >
                  {a.status === "approved" ? "Aprovado" : "Rejeitado"}
                </Badge>
                <span className="text-xs text-ink-4 font-mono shrink-0">
                  {a.resolved_at ? timeAgo(a.resolved_at) : ""}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
