"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { Service } from "@/types/database"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Sparkles, Check, AlertCircle, Loader2, PenLine } from "lucide-react"

const DURATION_OPTIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180, 240]

const serviceFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  duration_minutes: z.number({ invalid_type_error: "Selecione uma duração" }).min(15).max(480),
  price: z.number({ invalid_type_error: "Informe um preço válido" }).min(0).optional(),
  price_max: z.number({ invalid_type_error: "Informe um preço máximo válido" }).min(0).optional(),
  category: z.string().optional(),
  active: z.boolean().default(true),
})

export type ServiceFormData = z.infer<typeof serviceFormSchema>

interface ServiceFormProps {
  service?: Service
  onSubmit: (data: ServiceFormData) => void
  onCancel: () => void
}

interface ServiceAIFields {
  name?: string
  description?: string
  duration_minutes?: number
  price?: number
  category?: string
}

const inputCls =
  "w-full px-4 py-3 rounded-xl border border-border bg-surface text-ink text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-colors resize-none"

export function ServiceForm({ service, onSubmit, onCancel }: ServiceFormProps) {
  const [activeTab, setActiveTab] = useState<"manual" | "ai">("manual")

  // AI state — pre-fill from existing service when editing
  const [aiPrompt, setAiPrompt] = useState(() => {
    if (!service) return ""
    const parts = [service.name]
    if (service.description) parts.push(service.description)
    if (service.duration_minutes) parts.push(`${service.duration_minutes} minutos`)
    if (service.price != null) parts.push(`R$ ${(service.price / 100).toFixed(2).replace(".", ",")}`)
    if (service.category) parts.push(`categoria ${service.category}`)
    return parts.join(", ")
  })
  const [aiFollowUp, setAiFollowUp] = useState("")
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiQuestion, setAiQuestion] = useState("")
  const [aiOutOfScope, setAiOutOfScope] = useState(false)
  const [aiResultReady, setAiResultReady] = useState(false)
  const [aiVerified, setAiVerified] = useState(false)
  const [aiExtracted, setAiExtracted] = useState<Partial<ServiceAIFields> | null>(null)
  const [aiPreview, setAiPreview] = useState<Record<string, string>>({})
  const [aiError, setAiError] = useState("")

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      name: service?.name ?? "",
      description: service?.description ?? "",
      duration_minutes: service?.duration_minutes ?? 60,
      price: service?.price ?? undefined,
      price_max: service?.price_max ?? undefined,
      category: service?.category ?? "",
      active: service?.active ?? true,
    },
  })

  const isActive = watch("active")

  function applyAIFields(fields: Partial<ServiceAIFields>) {
    if (fields.name) setValue("name", fields.name, { shouldDirty: true })
    if (fields.description) setValue("description", fields.description, { shouldDirty: true })
    if (fields.duration_minutes) setValue("duration_minutes", fields.duration_minutes, { shouldDirty: true })
    if (fields.price != null) setValue("price", fields.price, { shouldDirty: true })
    if (fields.category) setValue("category", fields.category, { shouldDirty: true })
  }

  function resetAi() {
    setAiResultReady(false)
    setAiVerified(false)
    setAiQuestion("")
    setAiFollowUp("")
    setAiOutOfScope(false)
    setAiExtracted(null)
    setAiPreview({})
    setAiError("")
  }

  async function handleAiGenerate() {
    setAiGenerating(true)
    setAiQuestion("")
    setAiOutOfScope(false)
    setAiError("")

    const combinedPrompt = aiFollowUp.trim()
      ? `${aiPrompt.trim()}\n${aiFollowUp.trim()}`
      : aiPrompt.trim()
    if (aiFollowUp.trim()) setAiPrompt(combinedPrompt)
    setAiFollowUp("")

    try {
      const res = await fetch("/api/ai/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: "service", description: combinedPrompt }),
      })
      const data = await res.json() as {
        fields: Partial<ServiceAIFields>
        question: string | null
        preview: Record<string, string>
        outOfScope?: boolean
        error?: string
      }
      if (data.outOfScope) { setAiOutOfScope(true); return }
      if (data.error) { setAiError(data.error); return }
      if (data.question) { setAiQuestion(data.question); return }
      setAiExtracted(data.fields)
      setAiPreview(data.preview ?? {})
      setAiResultReady(true)
    } catch {
      setAiError("Erro ao conectar com a IA")
    } finally {
      setAiGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      {(
        <div className="flex bg-surface-2 rounded-md p-1 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("manual")}
            className={cn(
              "flex-1 py-2 rounded text-sm text-center cursor-pointer transition-[color,background-color,box-shadow] duration-150 ease-brand-out",
              activeTab === "manual" ? "font-semibold bg-surface text-ink" : "text-ink-3 hover:text-ink-2"
            )}
            style={activeTab === "manual" ? { boxShadow: "var(--shadow-1)" } : undefined}
          >
            Preencher manualmente
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            className={cn(
              "flex-1 py-2 rounded text-sm text-center cursor-pointer transition-[color,background-color,box-shadow] duration-150 ease-brand-out",
              activeTab === "ai" ? "font-semibold bg-surface text-ink" : "text-ink-3 hover:text-ink-2"
            )}
            style={activeTab === "ai" ? { boxShadow: "var(--shadow-1)" } : undefined}
          >
            <span className="text-brand">✦</span> Descrever com IA
          </button>
        </div>
      )}

      {activeTab === "ai" ? (
        <div className="space-y-3">
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Ex: Corte feminino, 45 minutos, R$ 80, categoria Cabelo"
            rows={3}
            className={inputCls}
          />

          {/* Clarifying question */}
          {aiQuestion && !aiResultReady && (
            <div className="space-y-2">
              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-surface-2 border border-border text-sm text-ink leading-relaxed">
                <Sparkles className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
                <span>{aiQuestion}</span>
              </div>
              <textarea
                value={aiFollowUp}
                onChange={(e) => setAiFollowUp(e.target.value)}
                placeholder="Sua resposta..."
                rows={2}
                className={inputCls}
                autoFocus
              />
            </div>
          )}

          {/* Out-of-scope warning */}
          {aiOutOfScope && !aiResultReady && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-danger/8 border border-danger/25 text-sm text-danger leading-relaxed">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Isso está fora do assunto. Por favor, descreva apenas o serviço que você quer cadastrar.</span>
            </div>
          )}

          {/* Error */}
          {aiError && (
            <p className="text-xs text-danger">{aiError}</p>
          )}

          {/* Generate button */}
          {!aiResultReady && (
            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={aiGenerating || (!aiPrompt.trim() && !aiFollowUp.trim())}
              className="w-full py-2.5 rounded-xl border border-brand/30 bg-tint text-brand text-sm font-semibold flex items-center justify-center gap-2 hover:bg-tint/80 transition-colors disabled:opacity-50"
            >
              {aiGenerating ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analisando...</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5" /> {aiQuestion ? "Gerar com minha resposta" : "Descrever com IA"}</>
              )}
            </button>
          )}

          {/* Result preview + verify / redo / edit */}
          {aiResultReady && (
            <div className="rounded-xl bg-tint border border-brand/20 p-3 space-y-3">
              <div className="space-y-1.5">
                {Object.entries(aiPreview)
                  .filter(([, v]) => v && v !== "null")
                  .map(([label, value]) => (
                    <div key={label} className="flex items-center gap-2 text-sm">
                      <span className="text-brand font-bold text-xs">✦</span>
                      <span className="text-ink-3">{label}:</span>
                      <span className="text-ink font-medium">{value}</span>
                    </div>
                  ))}
              </div>
              {aiVerified ? (
                <>
                  <div className="flex items-center gap-2 text-xs text-moss font-medium">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    Verificado — pode continuar
                  </div>
                  <button
                    type="button"
                    onClick={resetAi}
                    disabled={aiGenerating}
                    className="w-full py-2 rounded-lg border border-brand/30 bg-surface text-brand text-sm font-semibold flex items-center justify-center gap-2 hover:bg-tint transition-colors disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Gerar novamente
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("manual")}
                    className="flex items-center gap-1 text-xs text-ink-3 hover:text-ink transition-colors mx-auto"
                  >
                    <PenLine className="w-3 h-3" /> Editar manualmente
                  </button>
                </>
              ) : (
                <>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (aiExtracted) applyAIFields(aiExtracted)
                        setAiVerified(true)
                      }}
                      className="flex-1 py-2 rounded-lg border-2 border-moss bg-moss/8 text-moss text-sm font-semibold flex items-center justify-center gap-2 hover:bg-moss/15 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" /> Verificar
                    </button>
                    <button
                      type="button"
                      onClick={resetAi}
                      disabled={aiGenerating}
                      className="flex-1 py-2 rounded-lg border border-border bg-surface text-ink-2 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-surface-2 transition-colors disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Gerar novamente
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("manual")}
                    className="flex items-center gap-1 text-xs text-ink-3 hover:text-ink transition-colors mx-auto"
                  >
                    <PenLine className="w-3 h-3" /> Editar manualmente
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Nome */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5">
          Nome do serviço <span className="text-danger">*</span>
        </Label>
        <Input
          {...register("name")}
          placeholder="Ex: Corte Feminino"
          className="border-border bg-surface text-ink placeholder:text-ink-4 focus-visible:ring-brand/20 focus-visible:border-brand h-10"
        />
        {errors.name && (
          <p className="text-xs text-danger">{errors.name.message}</p>
        )}
      </div>

      {/* Descrição */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5">Descrição</Label>
        <Textarea
          {...register("description")}
          placeholder="Descrição opcional do serviço..."
          rows={2}
          className="bg-surface-2 border-border text-ink placeholder:text-ink-4 resize-none focus-visible:ring-brand/20 focus-visible:border-brand"
        />
      </div>

      {/* Duração */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5">
          Duração <span className="text-danger">*</span>
        </Label>
        <Controller
          name="duration_minutes"
          control={control}
          render={({ field }) => (
            <Select
              value={String(field.value)}
              onValueChange={(val) => field.onChange(Number(val))}
            >
              <SelectTrigger className="border-border bg-surface text-ink font-mono focus:ring-brand/20">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="bg-surface border-border">
                {DURATION_OPTIONS.map((d) => (
                  <SelectItem
                    key={d}
                    value={String(d)}
                    className="font-mono text-ink focus:bg-surface-2"
                  >
                    {d} minutos
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.duration_minutes && (
          <p className="text-xs text-danger">{errors.duration_minutes.message}</p>
        )}
      </div>

      {/* Preço */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5">Preço (R$)</Label>
          <Input
            {...register("price", { valueAsNumber: true })}
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            className="border-border bg-surface text-ink placeholder:text-ink-4 font-mono focus-visible:ring-brand/20 focus-visible:border-brand h-10"
          />
          {errors.price && (
            <p className="text-xs text-danger">{errors.price.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5">
            Preço máximo (R$){" "}
            <span className="text-ink-3 font-normal text-xs normal-case">opcional</span>
          </Label>
          <Input
            {...register("price_max", { valueAsNumber: true })}
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            className="border-border bg-surface text-ink placeholder:text-ink-4 font-mono focus-visible:ring-brand/20 focus-visible:border-brand h-10"
          />
          {errors.price_max && (
            <p className="text-xs text-danger">{errors.price_max.message}</p>
          )}
        </div>
      </div>

      {/* Categoria */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5">Categoria</Label>
        <Input
          {...register("category")}
          placeholder="Ex: Cabelo, Estética, Manutenção..."
          className="border-border bg-surface text-ink placeholder:text-ink-4 focus-visible:ring-brand/20 focus-visible:border-brand h-10"
        />
      </div>

      {/* Ativo */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-4 py-3">
        <div>
          <p className="text-sm text-ink font-medium">Ativo</p>
          <p className="text-xs text-ink-3">
            Serviços ativos aparecem para agendamento
          </p>
        </div>
        <button
          type="button"
          onClick={() => setValue("active", !isActive, { shouldDirty: true })}
          className={cn(
            "relative h-6 w-11 rounded-full transition-colors",
            isActive ? "bg-brand" : "bg-border"
          )}
        >
          <span
            className={cn(
              "absolute top-1 h-4 w-4 rounded-full bg-white transition-transform",
              isActive ? "translate-x-6" : "translate-x-1"
            )}
          />
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <Button
          type="button"
          variant="outline"
          className="flex-1 border-border bg-surface text-ink-2 hover:bg-surface-2"
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 text-white font-semibold disabled:opacity-50"
          style={{ background: "var(--brand-grad)" }}
        >
          {isSubmitting ? "Salvando..." : service ? "Salvar alterações" : "Criar serviço"}
        </Button>
      </div>
    </form>
      )}
    </div>
  )
}
