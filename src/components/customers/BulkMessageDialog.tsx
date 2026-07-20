"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Users,
  Calendar,
  Tag,
  ChevronRight,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Send,
} from "lucide-react";
import {
  sendBulkMessage,
  getTargetCustomerCount,
  type BulkTargetFilter,
} from "@/lib/customers/bulk-actions";

interface BulkMessageDialogProps {
  businessId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableTags?: string[];
}

type Step = "compose" | "target" | "confirm" | "result";

interface ResultState {
  sent: number;
  failed: number;
}

export function BulkMessageDialog({
  businessId,
  open,
  onOpenChange,
  availableTags = [],
}: BulkMessageDialogProps) {
  const [step, setStep] = useState<Step>("compose");
  const [message, setMessage] = useState("");
  const [filterType, setFilterType] = useState<BulkTargetFilter["type"]>("all_active");
  const [selectedTag, setSelectedTag] = useState(availableTags[0] ?? "");
  const [customTagInput, setCustomTagInput] = useState("");
  const [targetCount, setTargetCount] = useState<number | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);
  const [isSending, startSending] = useTransition();
  const [isCounting, startCounting] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep("compose");
        setMessage("");
        setFilterType("all_active");
        setTargetCount(null);
        setResult(null);
        setError(null);
      }, 300);
    }
  }, [open]);

  function buildFilter(): BulkTargetFilter {
    if (filterType === "all_active") return { type: "all_active" };
    if (filterType === "upcoming_7_days") return { type: "upcoming_7_days" };
    const tag = customTagInput.trim() || selectedTag;
    return { type: "by_tag", tag };
  }

  function handleGoToTarget() {
    if (!message.trim()) {
      setError("Escreva uma mensagem antes de continuar.");
      return;
    }
    setError(null);
    setStep("target");
  }

  function handleGoToConfirm() {
    setError(null);
    const filter = buildFilter();
    setTargetCount(null);

    startCounting(async () => {
      try {
        const count = await getTargetCustomerCount(businessId, filter);
        setTargetCount(count);
        setStep("confirm");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao contar destinatários.");
      }
    });
  }

  function handleSend() {
    setError(null);
    const filter = buildFilter();

    startSending(async () => {
      try {
        const res = await sendBulkMessage({
          businessId,
          message,
          targetFilter: filter,
        });
        setResult(res);
        setStep("result");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao enviar mensagens.");
      }
    });
  }

  const insertVariable = (variable: string) => {
    setMessage((prev) => prev + variable);
  };

  const tagToUse = customTagInput.trim() || selectedTag;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border text-ink max-w-lg rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-ink">
            <MessageSquare className="w-5 h-5 text-brand" />
            Enviar mensagem em massa
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-ink-3">
          {(["compose", "target", "confirm"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="w-3 h-3" />}
              <span
                className={cn(
                  "px-2 py-0.5 rounded",
                  step === s
                    ? "text-brand bg-tint font-medium"
                    : step === "result" || (s === "compose" && ["target", "confirm"].includes(step)) || (s === "target" && step === "confirm")
                    ? "text-ink-4 line-through"
                    : "text-ink-3"
                )}
              >
                {s === "compose" ? "1. Mensagem" : s === "target" ? "2. Destinatários" : "3. Confirmar"}
              </span>
            </div>
          ))}
        </div>

        {/* ── Step 1: Compose ── */}
        {step === "compose" && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5 block">
                Mensagem
              </label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Olá {{nome}}, temos uma novidade para você!"
                rows={5}
                className="bg-surface-2 border-border text-ink placeholder:text-ink-4 resize-none focus-visible:ring-brand focus-visible:ring-1"
              />
              <p className="text-xs text-ink-3 mt-1">
                {message.length} caracteres
              </p>
            </div>

            <div>
              <p className="text-xs text-ink-2 mb-2">Variáveis disponíveis:</p>
              <div className="flex gap-2 flex-wrap">
                {["{{nome}}", "{{negocio}}"].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="text-xs px-2 py-1 rounded border border-border bg-surface-2 text-brand hover:bg-tint font-mono transition-colors"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-xs text-danger flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                {error}
              </p>
            )}
          </div>
        )}

        {/* ── Step 2: Target ── */}
        {step === "target" && (
          <div className="space-y-3">
            <p className="text-sm text-ink-2">Selecione o grupo de destinatários:</p>

            {[
              {
                value: "all_active" as const,
                label: "Todos os clientes ativos",
                icon: <Users className="w-4 h-4" />,
                description: "Clientes com status Ativo e número de WhatsApp",
              },
              {
                value: "upcoming_7_days" as const,
                label: "Agendamentos nos próximos 7 dias",
                icon: <Calendar className="w-4 h-4" />,
                description: "Clientes com atendimento agendado para os próximos 7 dias",
              },
              {
                value: "by_tag" as const,
                label: "Por tag",
                icon: <Tag className="w-4 h-4" />,
                description: "Clientes com uma tag específica",
              },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilterType(option.value)}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-lg border transition-colors",
                  filterType === option.value
                    ? "border-brand bg-tint"
                    : "border-border bg-surface-2 hover:border-border-2"
                )}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className={
                      filterType === option.value ? "text-brand" : "text-ink-3"
                    }
                  >
                    {option.icon}
                  </span>
                  <span className="text-sm font-medium text-ink">
                    {option.label}
                  </span>
                </div>
                <p className="text-xs text-ink-3 ml-6">{option.description}</p>
              </button>
            ))}

            {/* Sub-option: tag picker */}
            {filterType === "by_tag" && (
              <div className="ml-4 space-y-2">
                {availableTags.length > 0 && (
                  <select
                    value={selectedTag}
                    onChange={(e) => setSelectedTag(e.target.value)}
                    className="w-full h-9 rounded-md border border-border bg-surface-2 text-ink text-sm px-3 focus:outline-none focus:border-brand"
                  >
                    {availableTags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  placeholder="Ou digite uma tag..."
                  className="w-full h-9 rounded-md border border-border bg-surface-2 text-ink text-sm px-3 placeholder:text-ink-4 focus:outline-none focus:border-brand"
                />
              </div>
            )}

            {error && (
              <p className="text-xs text-danger flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                {error}
              </p>
            )}
          </div>
        )}

        {/* ── Step 3: Confirm ── */}
        {step === "confirm" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-surface-2 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-2">Destinatários</span>
                <span className="font-mono text-lg font-bold text-brand">
                  {targetCount !== null ? targetCount : "—"}
                </span>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-xs text-ink-2 mb-1">Pré-visualização da mensagem:</p>
                <p className="text-sm text-ink whitespace-pre-wrap bg-surface rounded p-3 border border-border">
                  {message || "(vazia)"}
                </p>
              </div>
            </div>

            {targetCount === 0 && (
              <div className="flex items-center gap-2 text-warning text-sm">
                <AlertCircle className="w-4 h-4" />
                Nenhum cliente encontrado para esse filtro.
              </div>
            )}

            {error && (
              <p className="text-xs text-danger flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                {error}
              </p>
            )}
          </div>
        )}

        {/* ── Step 4: Result ── */}
        {step === "result" && result && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-surface-2 p-6 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-moss mx-auto" />
              <div>
                <p className="text-ink font-semibold text-lg">
                  Envio concluído!
                </p>
                <p className="text-ink-2 text-sm mt-1">
                  {result.sent} mensagem{result.sent !== 1 ? "s" : ""} enviada
                  {result.sent !== 1 ? "s" : ""}
                  {result.failed > 0 && (
                    <span className="text-danger">
                      {" "}· {result.failed} falha{result.failed !== 1 ? "s" : ""}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center gap-2">
          {/* Back / Close */}
          {step === "compose" && (
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="border border-border bg-surface text-ink-2 hover:bg-surface-2 rounded-md h-9 px-4 text-sm font-semibold"
            >
              Cancelar
            </Button>
          )}
          {step === "target" && (
            <Button
              variant="ghost"
              onClick={() => setStep("compose")}
              className="border border-border bg-surface text-ink-2 hover:bg-surface-2 rounded-md h-9 px-4 text-sm font-semibold gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </Button>
          )}
          {step === "confirm" && (
            <Button
              variant="ghost"
              onClick={() => setStep("target")}
              disabled={isSending}
              className="border border-border bg-surface text-ink-2 hover:bg-surface-2 rounded-md h-9 px-4 text-sm font-semibold gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </Button>
          )}
          {step === "result" && (
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="border border-border bg-surface text-ink-2 hover:bg-surface-2 rounded-md h-9 px-4 text-sm font-semibold"
            >
              Fechar
            </Button>
          )}

          {/* Forward / Send */}
          {step === "compose" && (
            <Button
              onClick={handleGoToTarget}
              className="text-white font-semibold gap-2"
              style={{ background: "var(--brand-grad)" }}
            >
              Próximo
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
          {step === "target" && (
            <Button
              onClick={handleGoToConfirm}
              disabled={isCounting || (filterType === "by_tag" && !tagToUse)}
              className="text-white font-semibold gap-2"
              style={{ background: "var(--brand-grad)" }}
            >
              {isCounting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Confirmar filtro
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          )}
          {step === "confirm" && (
            <Button
              onClick={handleSend}
              disabled={isSending || targetCount === 0}
              className="text-white font-semibold gap-2"
              style={{ background: "var(--brand-grad)" }}
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Enviar para {targetCount ?? 0} cliente{targetCount !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
