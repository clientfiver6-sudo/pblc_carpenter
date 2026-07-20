"use client"

import { useState } from "react"
import { Plus, Trash2, Printer } from "lucide-react"

type ExamType = "laboratorial" | "imagem" | "outro"

interface Exam {
  name: string
  laterality: string
}

const emptyExam = (): Exam => ({ name: "", laterality: "" })

const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  laboratorial: "Laboratorial",
  imagem: "Imagem",
  outro: "Outro",
}

interface ExamRequestFormProps {
  customerName: string
  businessName: string
}

export function ExamRequestForm({ customerName, businessName }: ExamRequestFormProps) {
  const [examType, setExamType] = useState<ExamType>("laboratorial")
  const [exams, setExams] = useState<Exam[]>([emptyExam()])
  const [justification, setJustification] = useState("")

  function addExam() { setExams(e => [...e, emptyExam()]) }
  function removeExam(i: number) { setExams(e => e.filter((_, idx) => idx !== i)) }
  function updateExam(i: number, field: keyof Exam, val: string) {
    setExams(e => e.map((exam, idx) => idx === i ? { ...exam, [field]: val } : exam))
  }

  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
  const showLaterality = examType === "imagem"

  return (
    <>
      <style>{`
        @media print {
          body > * { display: none !important; }
          .exam-print { display: block !important; position: fixed; inset: 0; background: white; padding: 2cm; font-family: serif; font-size: 12pt; }
          .no-print { display: none !important; }
          @page { margin: 2cm; size: A5; }
        }
        @media screen { .exam-print { display: contents; } }
      `}</style>

      <div className="exam-print space-y-5">
        {/* Screen form */}
        <div className="no-print space-y-4">
          {/* Exam type */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Tipo de Exame</p>
            <div className="flex gap-3">
              {(["laboratorial", "imagem", "outro"] as ExamType[]).map(t => (
                <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="exam_type"
                    value={t}
                    checked={examType === t}
                    onChange={() => setExamType(t)}
                    className="accent-brand"
                  />
                  <span className="text-sm text-ink">{EXAM_TYPE_LABELS[t]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Exam list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Exames</p>
              <button onClick={addExam} className="flex items-center gap-1 text-xs text-brand hover:text-brand-2 transition-colors font-medium">
                <Plus className="w-3.5 h-3.5" />Adicionar
              </button>
            </div>

            {exams.map((exam, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={exam.name}
                  onChange={e => updateExam(i, "name", e.target.value)}
                  placeholder="Nome do exame"
                  className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand"
                />
                {showLaterality && (
                  <input
                    value={exam.laterality}
                    onChange={e => updateExam(i, "laterality", e.target.value)}
                    placeholder="Lateralidade"
                    className="w-28 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand"
                  />
                )}
                {exams.length > 1 && (
                  <button onClick={() => removeExam(i)} className="text-ink-4 hover:text-danger transition-colors shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Justification */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Justificativa Clínica</label>
            <textarea
              rows={3}
              value={justification}
              onChange={e => setJustification(e.target.value)}
              placeholder="Descreva a indicação clínica para os exames..."
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/40 resize-y"
            />
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ink text-white text-sm font-medium hover:bg-ink/80 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimir Pedido de Exames
          </button>
        </div>

        {/* Print layout */}
        <div className="hidden print:block space-y-6" style={{ fontFamily: "serif" }}>
          <div className="border-b border-gray-300 pb-4">
            <h1 className="text-xl font-bold">{businessName}</h1>
            <p className="text-sm text-gray-600">Paciente: {customerName}</p>
            <p className="text-sm text-gray-600">Data: {today}</p>
          </div>
          <div>
            <p className="text-center font-bold text-lg mb-1 border-b border-gray-300 pb-2">PEDIDO DE EXAMES</p>
            <p className="text-sm text-gray-600 mb-4 text-center">{EXAM_TYPE_LABELS[examType]}</p>
            <ol className="space-y-2 list-decimal list-inside">
              {exams.filter(e => e.name).map((e, i) => (
                <li key={i} className="text-sm">
                  {e.name}{e.laterality ? ` (${e.laterality})` : ""}
                </li>
              ))}
            </ol>
            {justification && (
              <div className="mt-4">
                <p className="text-sm font-semibold">Justificativa:</p>
                <p className="text-sm text-gray-700 mt-1">{justification}</p>
              </div>
            )}
          </div>
          <div className="mt-12 text-center">
            <div className="inline-block border-t border-gray-400 pt-2 px-8">
              <p className="text-sm">Assinatura do médico</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
