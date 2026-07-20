"use client"

import { useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Mic, FileText, Pill, FlaskConical } from "lucide-react"
import { SOAPNoteDialog } from "@/components/medical/SOAPNoteDialog"
import { AnamneseDialog } from "@/components/medical/AnamneseDialog"
import { PrescriptionDialog } from "@/components/medical/PrescriptionDialog"
import { ExamRequestDialog } from "@/components/medical/ExamRequestDialog"
import { formatDate } from "@/lib/utils"
import type { MedicalNote, Anamnese, Prescription, ExamRequest } from "@/types/database"

interface MedicalRecordProps {
  customerId: string
  customerName: string
  initialNotes: MedicalNote[]
  initialAnamnese: Anamnese[]
  initialPrescriptions: Prescription[]
  initialExams: ExamRequest[]
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-ink-4 gap-2">
      <p className="text-sm">{label}</p>
    </div>
  )
}

function SOAPCard({ note }: { note: MedicalNote }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-3 font-mono">{formatDate(note.created_at)}</span>
        {note.audio_url && <Badge variant="secondary" className="text-xs gap-1"><Mic className="w-3 h-3" />Gravado</Badge>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        {[
          { label: "S — Subjetivo", value: note.subjective },
          { label: "O — Objetivo", value: note.objective },
          { label: "A — Avaliação", value: note.assessment },
          { label: "P — Plano", value: note.plan_text },
        ].map(({ label, value }) => value ? (
          <div key={label} className="space-y-0.5">
            <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide">{label}</p>
            <p className="text-ink leading-relaxed">{value}</p>
          </div>
        ) : null)}
      </div>
      {note.raw_note && (
        <div>
          <button onClick={() => setExpanded(e => !e)} className="text-xs text-brand hover:underline">
            {expanded ? "Ocultar transcrição" : "Ver transcrição completa"}
          </button>
          {expanded && <p className="mt-2 text-xs text-ink-3 leading-relaxed whitespace-pre-wrap">{note.raw_note}</p>}
        </div>
      )}
    </div>
  )
}

function AnamneseCard({ record }: { record: Anamnese }) {
  const fields = [
    { label: "Queixas principais", value: record.queixas_principais },
    { label: "Histórico médico", value: record.historico_medico },
    { label: "Alergias", value: record.alergias },
    { label: "Medicamentos em uso", value: record.medicamentos_em_uso },
    { label: "Antecedentes familiares", value: record.antecedentes_familiares },
    { label: "Hábitos e vícios", value: record.habitos_vicios },
  ].filter(f => f.value)

  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <span className="text-xs text-ink-3 font-mono">{formatDate(record.created_at)}</span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        {fields.map(({ label, value }) => (
          <div key={label} className="space-y-0.5">
            <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide">{label}</p>
            <p className="text-ink leading-relaxed">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function PrescriptionCard({ record }: { record: Prescription }) {
  const meds = record.medications as { name: string; dose: string; frequency: string; duration: string }[]
  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-3 font-mono">{formatDate(record.created_at)}</span>
        {record.crm_number && <span className="text-xs text-ink-3">CRM: {record.crm_number}</span>}
      </div>
      <div className="space-y-2">
        {meds.map((m, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <Pill className="w-3.5 h-3.5 text-brand mt-0.5 shrink-0" />
            <div>
              <span className="font-medium text-ink">{m.name}</span>
              {m.dose && <span className="text-ink-3"> — {m.dose}</span>}
              {m.frequency && <span className="text-ink-3">, {m.frequency}</span>}
              {m.duration && <span className="text-ink-3">, por {m.duration}</span>}
            </div>
          </div>
        ))}
      </div>
      {record.notes && <p className="text-xs text-ink-3 border-t border-border pt-2">{record.notes}</p>}
    </div>
  )
}

function ExamCard({ record }: { record: ExamRequest }) {
  const exams = record.exams_requested as { name: string; instructions: string }[]
  const typeLabel: Record<string, string> = { laboratorial: "Laboratorial", imagem: "Imagem", outro: "Outro" }
  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-3 font-mono">{formatDate(record.created_at)}</span>
        <Badge variant="secondary" className="text-xs">{typeLabel[record.exam_type] ?? record.exam_type}</Badge>
      </div>
      <div className="space-y-2">
        {exams.map((e, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <FlaskConical className="w-3.5 h-3.5 text-brand mt-0.5 shrink-0" />
            <div>
              <span className="font-medium text-ink">{e.name}</span>
              {e.instructions && <p className="text-xs text-ink-3">{e.instructions}</p>}
            </div>
          </div>
        ))}
      </div>
      {record.clinical_justification && (
        <p className="text-xs text-ink-3 border-t border-border pt-2">Justificativa: {record.clinical_justification}</p>
      )}
    </div>
  )
}

export function MedicalRecord({ customerId, customerName, initialNotes, initialAnamnese, initialPrescriptions, initialExams }: MedicalRecordProps) {
  const [notes, setNotes] = useState(initialNotes)
  const [anamnese, setAnamnese] = useState(initialAnamnese)
  const [prescriptions, setPrescriptions] = useState(initialPrescriptions)
  const [exams, setExams] = useState(initialExams)

  const [dialog, setDialog] = useState<"soap" | "anamnese" | "prescription" | "exam" | null>(null)

  return (
    <div className="space-y-4">
      <Tabs defaultValue="soap">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <TabsList className="bg-surface border border-border overflow-x-auto scrollbar-none">
            <TabsTrigger value="soap" className="shrink-0 gap-1.5 text-xs sm:text-sm">
              <Mic className="w-3.5 h-3.5" />Consultas SOAP
            </TabsTrigger>
            <TabsTrigger value="anamnese" className="shrink-0 gap-1.5 text-xs sm:text-sm">
              <FileText className="w-3.5 h-3.5" />Anamnese
            </TabsTrigger>
            <TabsTrigger value="prescriptions" className="shrink-0 gap-1.5 text-xs sm:text-sm">
              <Pill className="w-3.5 h-3.5" />Prescrições
            </TabsTrigger>
            <TabsTrigger value="exams" className="shrink-0 gap-1.5 text-xs sm:text-sm">
              <FlaskConical className="w-3.5 h-3.5" />Exames
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="soap" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setDialog("soap")} style={{ background: "var(--brand-grad)", color: "#fff" }}>
              <Plus className="w-3.5 h-3.5" />Nova consulta
            </Button>
          </div>
          {notes.length === 0 ? <EmptyState label="Nenhuma nota SOAP registrada" /> : notes.map(n => <SOAPCard key={n.id} note={n} />)}
        </TabsContent>

        <TabsContent value="anamnese" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setDialog("anamnese")} style={{ background: "var(--brand-grad)", color: "#fff" }}>
              <Plus className="w-3.5 h-3.5" />Nova anamnese
            </Button>
          </div>
          {anamnese.length === 0 ? <EmptyState label="Nenhuma anamnese registrada" /> : anamnese.map(a => <AnamneseCard key={a.id} record={a} />)}
        </TabsContent>

        <TabsContent value="prescriptions" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setDialog("prescription")} style={{ background: "var(--brand-grad)", color: "#fff" }}>
              <Plus className="w-3.5 h-3.5" />Nova prescrição
            </Button>
          </div>
          {prescriptions.length === 0 ? <EmptyState label="Nenhuma prescrição registrada" /> : prescriptions.map(p => <PrescriptionCard key={p.id} record={p} />)}
        </TabsContent>

        <TabsContent value="exams" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setDialog("exam")} style={{ background: "var(--brand-grad)", color: "#fff" }}>
              <Plus className="w-3.5 h-3.5" />Solicitar exames
            </Button>
          </div>
          {exams.length === 0 ? <EmptyState label="Nenhum exame solicitado" /> : exams.map(e => <ExamCard key={e.id} record={e} />)}
        </TabsContent>
      </Tabs>

      <SOAPNoteDialog open={dialog === "soap"} onClose={() => setDialog(null)} customerId={customerId}
        onCreated={note => setNotes(prev => [note, ...prev])} />
      <AnamneseDialog open={dialog === "anamnese"} onClose={() => setDialog(null)} customerId={customerId}
        onCreated={record => setAnamnese(prev => [record, ...prev])} />
      <PrescriptionDialog open={dialog === "prescription"} onClose={() => setDialog(null)} customerId={customerId}
        onCreated={record => setPrescriptions(prev => [record, ...prev])} />
      <ExamRequestDialog open={dialog === "exam"} onClose={() => setDialog(null)} customerId={customerId}
        onCreated={record => setExams(prev => [record, ...prev])} />
    </div>
  )
}
