"use client"

import { useState } from "react"
import { Plus, Trash2, Printer } from "lucide-react"

interface Medication {
  name: string
  dosage: string
  frequency: string
  duration: string
  instructions: string
}

const emptyMed = (): Medication => ({ name: "", dosage: "", frequency: "", duration: "", instructions: "" })

interface PrescriptionFormProps {
  customerName: string
  businessName: string
}

export function PrescriptionForm({ customerName, businessName }: PrescriptionFormProps) {
  const [crm, setCrm] = useState("")
  const [medications, setMedications] = useState<Medication[]>([emptyMed()])

  function addMed() { setMedications(m => [...m, emptyMed()]) }
  function removeMed(i: number) { setMedications(m => m.filter((_, idx) => idx !== i)) }
  function updateMed(i: number, field: keyof Medication, val: string) {
    setMedications(m => m.map((med, idx) => idx === i ? { ...med, [field]: val } : med))
  }

  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          .prescription-print { display: block !important; position: fixed; inset: 0; background: white; padding: 2cm; font-family: serif; font-size: 12pt; }
          .no-print { display: none !important; }
          @page { margin: 2cm; size: A5; }
        }
        @media screen { .prescription-print { display: contents; } }
      `}</style>

      <div className="prescription-print space-y-5">
        {/* Screen form */}
        <div className="no-print space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">CRM do Médico</label>
            <input
              value={crm}
              onChange={e => setCrm(e.target.value)}
              placeholder="CRM/UF 000000"
              className="w-full max-w-xs rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/40"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Medicamentos</p>
              <button onClick={addMed} className="flex items-center gap-1 text-xs text-brand hover:text-brand-2 transition-colors font-medium">
                <Plus className="w-3.5 h-3.5" />Adicionar
              </button>
            </div>

            {medications.map((med, i) => (
              <div key={i} className="rounded-xl border border-border bg-surface-2 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-ink-3">Medicamento {i + 1}</p>
                  {medications.length > 1 && (
                    <button onClick={() => removeMed(i)} className="text-ink-4 hover:text-danger transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { f: "name" as const,         label: "Nome",       placeholder: "Amoxicilina 500mg" },
                    { f: "dosage" as const,        label: "Dose",       placeholder: "1 comprimido" },
                    { f: "frequency" as const,     label: "Frequência", placeholder: "3x ao dia" },
                    { f: "duration" as const,      label: "Duração",    placeholder: "7 dias" },
                  ]).map(({ f, label, placeholder }) => (
                    <div key={f} className="space-y-1">
                      <label className="text-[11px] font-medium text-ink-3">{label}</label>
                      <input
                        value={med[f]}
                        onChange={e => updateMed(i, f, e.target.value)}
                        placeholder={placeholder}
                        className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink focus:outline-none focus:border-brand"
                      />
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-ink-3">Instruções</label>
                  <input
                    value={med.instructions}
                    onChange={e => updateMed(i, "instructions", e.target.value)}
                    placeholder="Tomar após as refeições"
                    className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink focus:outline-none focus:border-brand"
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink text-white text-sm font-medium hover:bg-ink/80 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimir Receituário
          </button>
        </div>

        {/* Print layout (visible only when printing) */}
        <div className="hidden print:block space-y-6" style={{ fontFamily: "serif" }}>
          <div className="border-b border-gray-300 pb-4">
            <h1 className="text-xl font-bold">{businessName}</h1>
            {crm && <p className="text-sm text-gray-600">CRM: {crm}</p>}
            <p className="text-sm text-gray-600">Paciente: {customerName}</p>
            <p className="text-sm text-gray-600">Data: {today}</p>
          </div>
          <div>
            <p className="text-center font-bold text-lg mb-4 border-b border-gray-300 pb-2">RECEITUÁRIO</p>
            <ol className="space-y-4 list-decimal list-inside">
              {medications.filter(m => m.name).map((m, i) => (
                <li key={i} className="space-y-0.5">
                  <span className="font-bold">{m.name}</span>
                  {m.dosage && <span className="text-gray-700"> — {m.dosage}</span>}
                  {m.frequency && <p className="ml-4 text-sm">{m.frequency}{m.duration ? `, por ${m.duration}` : ""}</p>}
                  {m.instructions && <p className="ml-4 text-sm text-gray-600">{m.instructions}</p>}
                </li>
              ))}
            </ol>
          </div>
          <div className="mt-12 text-center">
            <div className="inline-block border-t border-gray-400 pt-2 px-8">
              <p className="text-sm">{crm ? `CRM ${crm}` : "Assinatura do médico"}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
