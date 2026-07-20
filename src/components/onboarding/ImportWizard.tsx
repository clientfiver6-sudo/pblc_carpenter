"use client"
import { useState, useRef } from "react"
import { Upload, CheckCircle, Loader2, ChevronRight, ArrowRight } from "lucide-react"

interface ImportWizardProps {
  businessId: string
  onComplete: () => void
  onSkip: () => void
  embedded?: boolean
}

interface StepConfig {
  id: string
  title: string
  description: string
  accept: string
  apiEndpoint: string | null
  hint: string
}

const IMPORT_STEPS: StepConfig[] = [
  {
    id: "customers",
    title: "Lista de clientes",
    description: "CSV, Excel, ou uma foto de um caderno",
    accept: ".csv,.xlsx,.xls,.jpg,.jpeg,.png",
    apiEndpoint: "/api/import/customers",
    hint: "Precisa ter ao menos uma coluna com o nome do cliente",
  },
  {
    id: "whatsapp",
    title: "Histórico do WhatsApp",
    description: "Exporte uma conversa do WhatsApp (.txt) e deixe a IA aprender com ela",
    accept: ".txt",
    apiEndpoint: "/api/import/whatsapp",
    hint: "No WhatsApp: abra uma conversa → ⋮ → Mais → Exportar conversa → Sem mídia",
  },
  {
    id: "appointments",
    title: "Histórico de atendimentos",
    description: "Planilha com agendamentos passados (nome, serviço, data, valor)",
    accept: ".csv,.xlsx,.xls",
    apiEndpoint: "/api/import/appointments",
    hint: "Pode ter colunas em qualquer ordem — a IA detecta automaticamente",
  },
  {
    id: "services",
    title: "Tabela de serviços",
    description: "PDF, imagem ou planilha com seus serviços e preços",
    accept: ".pdf,.jpg,.jpeg,.png,.csv,.xlsx",
    apiEndpoint: null,
    hint: "Pode ser uma foto do seu cardápio ou tabela de preços",
  },
]

interface StepResult {
  status: "idle" | "loading" | "done" | "error"
  summary?: string
}

function buildSummary(stepId: string, data: Record<string, unknown>): string {
  switch (stepId) {
    case "customers":
      return `${data.imported ?? 0} clientes importados, ${data.updated ?? 0} atualizados`
    case "whatsapp":
      return `${data.customersImported ?? 0} clientes, ${data.faqsFound ?? 0} perguntas frequentes detectadas`
    case "appointments":
      return `${data.imported ?? 0} atendimentos importados`
    default:
      return "Importado com sucesso"
  }
}

async function uploadToEndpoint(
  step: StepConfig,
  file: File
): Promise<{ ok: boolean; summary: string }> {
  const form = new FormData()
  form.set("file", file)
  const res = await fetch(step.apiEndpoint!, { method: "POST", body: form })
  const data = (await res.json()) as Record<string, unknown>
  return { ok: res.ok, summary: buildSummary(step.id, data) }
}

async function uploadServicesDocument(
  businessId: string,
  file: File
): Promise<{ ok: boolean; summary: string }> {
  const form = new FormData()
  form.set("file", file)
  form.set("businessId", businessId)
  const res = await fetch("/api/documents/upload", { method: "POST", body: form })
  return {
    ok: res.ok,
    summary: "Documento enviado! Vou analisar logo.",
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ImportWizard({ businessId, onComplete, onSkip, embedded = false }: ImportWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [stepResults, setStepResults] = useState<Record<number, StepResult>>({})
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isDone = currentStep >= IMPORT_STEPS.length
  const step = isDone ? null : IMPORT_STEPS[currentStep]
  const result = stepResults[currentStep]

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    if (picked) setFile(picked)
    // Reset input so same file can be re-selected
    e.target.value = ""
  }

  async function handleUpload() {
    if (!file || !step) return
    setStepResults(prev => ({ ...prev, [currentStep]: { status: "loading" } }))
    setFile(null)
    try {
      let result: { ok: boolean; summary: string }
      if (step.id === "services") {
        result = await uploadServicesDocument(businessId, file)
      } else {
        result = await uploadToEndpoint(step, file)
      }
      setStepResults(prev => ({
        ...prev,
        [currentStep]: {
          status: result.ok ? "done" : "error",
          summary: result.ok ? result.summary : "Erro ao importar. Tente novamente.",
        },
      }))
    } catch {
      setStepResults(prev => ({
        ...prev,
        [currentStep]: { status: "error", summary: "Erro ao importar. Tente novamente." },
      }))
    }
  }

  function goNext() {
    setFile(null)
    setCurrentStep(prev => prev + 1)
  }

  // ----- Embedded (WhatsApp-style card) layout -----
  if (embedded) {
    if (isDone) {
      return (
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-3 max-w-[85%]">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-semibold">Importação concluída!</p>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Seus dados foram importados. Agora vamos ao painel para ver tudo funcionando.
          </p>
          <button
            type="button"
            onClick={onComplete}
            className="w-full py-2 rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90 flex items-center justify-center gap-1.5"
            style={{ background: "#25D366" }}
          >
            Ir para o painel <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }

    return (
      <div className="bg-white rounded-xl p-4 shadow-sm space-y-3 max-w-[85%]">
        {/* Step indicator */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {IMPORT_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 w-5 rounded-full transition-colors ${
                  i < currentStep
                    ? "bg-green-400"
                    : i === currentStep
                    ? "bg-green-500"
                    : "bg-gray-200"
                }`}
              />
            ))}
          </div>
          <span className="text-[10px] text-gray-400">
            {currentStep + 1} de {IMPORT_STEPS.length}
          </span>
        </div>

        {/* Title & description */}
        <div>
          <p className="text-sm font-semibold text-gray-800">{step!.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{step!.description}</p>
        </div>

        {/* Result or dropzone */}
        {result?.status === "loading" ? (
          <div className="flex items-center gap-2 py-4 justify-center text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Processando...</span>
          </div>
        ) : result?.status === "done" ? (
          <div className="flex items-start gap-2 text-green-600 bg-green-50 rounded-lg p-2.5">
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">{result.summary}</p>
          </div>
        ) : result?.status === "error" ? (
          <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2.5">{result.summary}</p>
        ) : (
          <>
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                dragging ? "border-green-400 bg-green-50" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {file ? (
                <div className="flex items-center justify-center gap-2 text-gray-700">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-xs truncate max-w-[160px]">{file.name}</span>
                </div>
              ) : (
                <>
                  <Upload className="w-5 h-5 mx-auto mb-1 text-gray-300" />
                  <p className="text-xs text-gray-400">{step!.accept.replace(/\./g, "").toUpperCase().split(",").join(" · ")}</p>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept={step!.accept}
                className="hidden"
                onChange={handleInputChange}
              />
            </div>

            {/* Hint */}
            {step!.hint && (
              <p className="text-[10px] text-gray-400 leading-relaxed">{step!.hint}</p>
            )}
          </>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-0.5">
          <button
            type="button"
            onClick={goNext}
            className="flex-1 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Pular
          </button>
          {result?.status === "done" || result?.status === "error" ? (
            <button
              type="button"
              onClick={goNext}
              className="flex-1 py-2 rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: "#25D366" }}
            >
              Continuar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleUpload()}
              disabled={!file || result?.status === "loading"}
              className="flex-1 py-2 rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: "#25D366" }}
            >
              Enviar
            </button>
          )}
        </div>
      </div>
    )
  }

  // ----- Full-page (settings) layout -----
  return (
    <div className="space-y-6">
      {/* Step progress */}
      <div className="flex gap-2">
        {IMPORT_STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i < currentStep
                  ? "bg-brand text-white"
                  : i === currentStep
                  ? "bg-brand text-white ring-2 ring-brand/20"
                  : "bg-surface border border-border text-ink-3"
              }`}
            >
              {i < currentStep ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span
              className={`text-xs font-medium ${
                i === currentStep ? "text-ink" : "text-ink-3"
              }`}
            >
              {s.title}
            </span>
            {i < IMPORT_STEPS.length - 1 && (
              <ChevronRight className="w-3.5 h-3.5 text-border-2 shrink-0" />
            )}
          </div>
        ))}
      </div>

      {isDone ? (
        <div className="bg-surface border border-border rounded-lg p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-tint flex items-center justify-center mx-auto">
            <CheckCircle className="w-6 h-6 text-brand" />
          </div>
          <div>
            <p className="text-lg font-bold text-ink">Importação concluída!</p>
            <p className="text-sm text-ink-2 mt-1">
              Seus dados foram importados com sucesso. Acesse o painel para ver tudo.
            </p>
          </div>
          <button
            type="button"
            onClick={onComplete}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Ir para o painel <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg p-6 space-y-5">
          {/* Step header */}
          <div>
            <h2 className="text-base font-bold text-ink">{step!.title}</h2>
            <p className="text-sm text-ink-2 mt-0.5">{step!.description}</p>
          </div>

          {/* Result or dropzone */}
          {result?.status === "loading" ? (
            <div className="flex items-center gap-3 py-8 justify-center text-ink-3">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Processando arquivo...</span>
            </div>
          ) : result?.status === "done" ? (
            <div className="flex items-start gap-3 text-green-700 bg-green-50 border border-green-200 rounded-md p-4">
              <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm leading-relaxed">{result.summary}</p>
            </div>
          ) : result?.status === "error" ? (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-4">
              {result.summary}
            </p>
          ) : (
            <>
              <div
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  dragging
                    ? "border-brand/60 bg-tint/30"
                    : "border-border hover:border-brand/40"
                }`}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-2 text-ink">
                    <CheckCircle className="w-5 h-5 text-brand" />
                    <span className="text-sm font-medium truncate max-w-xs">{file.name}</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto mb-2 text-ink-3" />
                    <p className="text-sm text-ink-2 font-medium">Arraste ou clique para selecionar</p>
                    <p className="text-xs text-ink-3 mt-1">
                      {step!.accept.replace(/\./g, "").toUpperCase().split(",").join(", ")}
                    </p>
                  </>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept={step!.accept}
                  className="hidden"
                  onChange={handleInputChange}
                />
              </div>

              {step!.hint && (
                <p className="text-xs text-ink-3 leading-relaxed">{step!.hint}</p>
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <button
              type="button"
              onClick={goNext}
              className="text-sm text-ink-3 hover:text-ink transition-colors"
            >
              Pular esta etapa
            </button>
            <div className="flex gap-2">
              {(result?.status === "done" || result?.status === "error") ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Continuar <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleUpload()}
                  disabled={!file || result?.status === "loading"}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  Enviar arquivo <Upload className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
