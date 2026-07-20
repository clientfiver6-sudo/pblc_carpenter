"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Mic } from "lucide-react"
import { formatDate } from "@/lib/utils"

interface MedicalNote {
  id: string
  customer_id: string
  subjective?: string | null
  objective?: string | null
  assessment?: string | null
  plan_text?: string | null
  transcript?: string | null
  audio_url?: string | null
  created_at: string
  customers?: { full_name: string } | null
}

interface SOAPNoteProps {
  note: MedicalNote
  showCustomer?: boolean
}

const SOAP_SECTIONS = [
  { key: "subjective" as const, label: "S — Subjetivo" },
  { key: "objective"  as const, label: "O — Objetivo" },
  { key: "assessment" as const, label: "A — Avaliação" },
  { key: "plan_text"  as const, label: "P — Plano" },
]

export function SOAPNote({ note, showCustomer = false }: SOAPNoteProps) {
  const [open, setOpen] = useState(false)

  const hasContent = SOAP_SECTIONS.some(s => note[s.key]?.trim())
  const preview = note.assessment?.trim() || note.subjective?.trim() || ""

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-ink-3 font-mono">{formatDate(note.created_at)}</span>
            {note.audio_url && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-brand bg-tint px-1.5 py-0.5 rounded-full">
                <Mic className="w-2.5 h-2.5" />
                Gravada
              </span>
            )}
          </div>
          {showCustomer && note.customers?.full_name && (
            <p className="text-sm font-semibold text-ink mt-1">{note.customers.full_name}</p>
          )}
          {!open && preview && (
            <p className="text-xs text-ink-3 mt-1 line-clamp-1">{preview}</p>
          )}
        </div>
        {hasContent && (
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className="shrink-0 p-1 rounded-md hover:bg-surface-2 text-ink-3 hover:text-ink transition-colors"
          >
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Expanded SOAP */}
      {open && (
        <div className="pt-2 border-t border-border space-y-3">
          {SOAP_SECTIONS.filter(s => note[s.key]?.trim()).map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide">{label}</p>
              <p className="text-sm text-ink whitespace-pre-wrap bg-surface-2 rounded-lg p-3">{note[key]}</p>
            </div>
          ))}
          {note.transcript?.trim() && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-ink-4 uppercase tracking-wide">Transcrição original</p>
              <p className="text-xs text-ink-3 whitespace-pre-wrap bg-surface-2 rounded-lg p-3 leading-relaxed">{note.transcript}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export type { MedicalNote }
