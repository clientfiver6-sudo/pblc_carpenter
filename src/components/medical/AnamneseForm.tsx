"use client"

import { useState, useEffect } from "react"
import { Loader2, Save, ClipboardList } from "lucide-react"
import { formatDate } from "@/lib/utils"

interface AnamneseData {
  id?: string
  queixas_principais?: string | null
  historico_medico?: string | null
  alergias?: string | null
  medicamentos_em_uso?: string | null
  antecedentes_familiares?: string | null
  habitos_vicios?: string | null
  created_at?: string
}

const FIELDS: { key: keyof Omit<AnamneseData, "id" | "created_at">; label: string; placeholder: string }[] = [
  { key: "queixas_principais",  label: "Queixas Principais",      placeholder: "Descreva os sintomas e motivo da consulta..." },
  { key: "historico_medico",    label: "Histórico Médico",         placeholder: "Doenças anteriores, cirurgias, hospitalizações..." },
  { key: "alergias",            label: "Alergias",                 placeholder: "Medicamentos, alimentos, substâncias..." },
  { key: "medicamentos_em_uso", label: "Medicamentos em Uso",      placeholder: "Nome, dose e frequência de cada medicamento..." },
  { key: "antecedentes_familiares", label: "Antecedentes Familiares", placeholder: "Doenças hereditárias, histórico familiar..." },
  { key: "habitos_vicios",      label: "Hábitos e Vícios",         placeholder: "Tabagismo, etilismo, atividade física, alimentação..." },
]

interface AnamneseFormProps {
  customerId: string
}

export function AnamneseForm({ customerId }: AnamneseFormProps) {
  const [saved, setSaved] = useState<AnamneseData | null>(null)
  const [form, setForm] = useState<AnamneseData>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetch(`/api/medical/anamnese?customer_id=${customerId}`)
      .then(r => r.json())
      .then((data: { anamnese: AnamneseData | null }) => {
        if (data.anamnese) {
          setSaved(data.anamnese)
          setForm({
            queixas_principais: data.anamnese.queixas_principais ?? "",
            historico_medico: data.anamnese.historico_medico ?? "",
            alergias: data.anamnese.alergias ?? "",
            medicamentos_em_uso: data.anamnese.medicamentos_em_uso ?? "",
            antecedentes_familiares: data.anamnese.antecedentes_familiares ?? "",
            habitos_vicios: data.anamnese.habitos_vicios ?? "",
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [customerId])

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch("/api/medical/anamnese", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId, ...form }),
      })
      if (!res.ok) throw new Error("Erro ao salvar")
      const data = await res.json() as { id: string }
      setSaved({ ...form, id: data.id, created_at: new Date().toISOString() })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError("Erro ao salvar anamnese.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-3 py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Carregando...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Last saved banner */}
      {saved?.created_at && (
        <div className="flex items-center gap-2 text-xs text-ink-3 bg-surface-2 rounded-lg px-3 py-2">
          <ClipboardList className="w-3.5 h-3.5" />
          Última anamnese salva em {formatDate(saved.created_at)}
        </div>
      )}

      {/* Fields */}
      <div className="space-y-3">
        {FIELDS.map(({ key, label, placeholder }) => (
          <div key={key} className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">{label}</label>
            <textarea
              rows={3}
              value={(form[key] as string) ?? ""}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/40 resize-y"
            />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-60 transition-opacity hover:opacity-90"
          style={{ background: "var(--brand-grad)" }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Anamnese
        </button>
        {success && <p className="text-xs text-moss font-medium">Salvo ✓</p>}
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </div>
  )
}
