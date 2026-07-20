"use client";

import { useState, useTransition, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Webhook, Plus, Trash2, Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  toggleWebhookActive,
} from "@/lib/webhooks/actions";
import { PROVIDER_CONFIGS } from "@/lib/webhooks/provider-adapters";

const TRIGGER_TYPES = [
  { value: "booking_created", label: "Agendamento criado" },
  { value: "booking_confirmed", label: "Agendamento confirmado" },
  { value: "booking_24h_before", label: "24h antes do agendamento" },
  { value: "booking_completed", label: "Agendamento concluído" },
  { value: "booking_cancelled", label: "Agendamento cancelado" },
  { value: "booking_no_show", label: "Não compareceu" },
  { value: "payment_pending", label: "Pagamento pendente" },
  { value: "payment_received", label: "Pagamento recebido" },
  { value: "lead_created", label: "Lead criado" },
  { value: "lead_inactive", label: "Lead inativo" },
  { value: "customer_inactive", label: "Cliente inativo" },
] as const;

interface WebhookEndpoint {
  id: string;
  name: string;
  provider: string;
  path_suffix: string;
  active: boolean;
  event_map: Record<string, string>;
  created_at: string;
}

interface EventMapEntry {
  event: string;
  trigger: string;
}

function getAppUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://app.retorn.ai";
}

export default function WebhooksSettingsPage() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create form state
  const [formName, setFormName] = useState("");
  const [formProvider, setFormProvider] = useState("generic");
  const [formSecret, setFormSecret] = useState("");
  const [formEventEntries, setFormEventEntries] = useState<EventMapEntry[]>([
    { event: "", trigger: "" },
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, startCreateTransition] = useTransition();

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  // Toggle state
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    void loadEndpoints();
  }, []);

  async function loadEndpoints() {
    setLoading(true);
    try {
      const res = await fetch("/api/webhooks-config");
      if (res.ok) {
        const json = await res.json() as { endpoints: WebhookEndpoint[] };
        setEndpoints(json.endpoints);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleProviderChange(provider: string) {
    setFormProvider(provider);
    const config = PROVIDER_CONFIGS[provider];
    if (config && config.commonEvents.length > 0) {
      setFormEventEntries(
        config.commonEvents.map((e) => ({ event: e.event, trigger: "" }))
      );
    } else {
      setFormEventEntries([{ event: "", trigger: "" }]);
    }
  }

  function addEventEntry() {
    setFormEventEntries((prev) => [...prev, { event: "", trigger: "" }]);
  }

  function removeEventEntry(index: number) {
    setFormEventEntries((prev) => prev.filter((_, i) => i !== index));
  }

  function updateEventEntry(index: number, field: "event" | "trigger", value: string) {
    setFormEventEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
    );
  }

  function resetForm() {
    setFormName("");
    setFormProvider("generic");
    setFormSecret("");
    setFormEventEntries([{ event: "", trigger: "" }]);
    setFormError(null);
  }

  function handleCreate() {
    if (!formName.trim()) {
      setFormError("Informe um nome para o webhook");
      return;
    }
    const eventMap: Record<string, string> = {};
    for (const entry of formEventEntries) {
      if (entry.event.trim() && entry.trigger) {
        eventMap[entry.event.trim()] = entry.trigger;
      }
    }
    setFormError(null);
    startCreateTransition(async () => {
      const result = await createWebhookEndpoint({
        name: formName.trim(),
        provider: formProvider,
        event_map: eventMap,
        secret: formSecret.trim() || undefined,
      });
      if (result.error) {
        setFormError(result.error);
        return;
      }
      setAddOpen(false);
      resetForm();
      await loadEndpoints();
    });
  }

  async function handleCopyUrl(endpoint: WebhookEndpoint) {
    const url = `${getAppUrl()}/api/webhooks/hub/${endpoint.path_suffix}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(endpoint.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleToggle(endpoint: WebhookEndpoint) {
    setTogglingId(endpoint.id);
    try {
      await toggleWebhookActive(endpoint.id, !endpoint.active);
      await loadEndpoints();
    } finally {
      setTogglingId(null);
    }
  }

  function handleDelete(id: string) {
    setDeleteId(id);
    startDeleteTransition(async () => {
      await deleteWebhookEndpoint(id);
      setDeleteId(null);
      await loadEndpoints();
    });
  }

  const providerKeys = Object.keys(PROVIDER_CONFIGS);

  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-6 md:px-4 sm:px-6 md:px-8 py-7 pb-28 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-tint">
            <Webhook className="h-5 w-5 text-brand" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink tracking-tight">Webhooks</h1>
            <p className="text-sm text-ink-3 mt-0.5">
              Receba eventos de serviços externos e acione automações
            </p>
          </div>
        </div>

        <Dialog
          open={addOpen}
          onOpenChange={(open) => {
            setAddOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button
              className="text-white font-semibold gap-1.5"
              style={{ background: "var(--brand-grad)" }}
            >
              <Plus className="h-4 w-4" />
              Novo Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-surface border-border text-ink max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-ink">Novo Webhook</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Name */}
              <div className="space-y-1.5">
                <Label className="text-ink-2 text-sm">Nome</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Calendly — Agendamentos"
                  className="border-border bg-surface text-ink placeholder:text-ink-4 focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>

              {/* Provider */}
              <div className="space-y-1.5">
                <Label className="text-ink-2 text-sm">Provedor</Label>
                <Select value={formProvider} onValueChange={handleProviderChange}>
                  <SelectTrigger className="border-border bg-surface text-ink focus:ring-brand/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-surface border-border text-ink">
                    {providerKeys.map((key) => (
                      <SelectItem key={key} value={key} className="focus:bg-tint focus:text-ink">
                        {PROVIDER_CONFIGS[key]?.displayName ?? key}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Secret */}
              <div className="space-y-1.5">
                <Label className="text-ink-2 text-sm">
                  Segredo HMAC{" "}
                  <span className="text-ink-4 font-normal">(opcional)</span>
                </Label>
                <Input
                  value={formSecret}
                  onChange={(e) => setFormSecret(e.target.value)}
                  placeholder="Chave secreta para validar assinatura"
                  className="border-border bg-surface text-ink placeholder:text-ink-4 focus:border-brand focus:ring-2 focus:ring-brand/20"
                  type="password"
                />
              </div>

              {/* Event map */}
              <div className="space-y-2">
                <Label className="text-ink-2 text-sm">Mapeamento de eventos</Label>
                <p className="text-xs text-ink-4">
                  Evento do provedor → Gatilho RetornAI
                </p>
                {formEventEntries.map((entry, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      value={entry.event}
                      onChange={(e) => updateEventEntry(idx, "event", e.target.value)}
                      placeholder="evento.provedor"
                      className="border-border bg-surface text-ink placeholder:text-ink-4 focus:border-brand focus:ring-2 focus:ring-brand/20 text-sm flex-1"
                    />
                    <Select
                      value={entry.trigger}
                      onValueChange={(v) => updateEventEntry(idx, "trigger", v)}
                    >
                      <SelectTrigger className="border-border bg-surface text-ink focus:ring-brand/20 text-sm flex-1">
                        <SelectValue placeholder="Gatilho" />
                      </SelectTrigger>
                      <SelectContent className="bg-surface border-border text-ink">
                        {TRIGGER_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value} className="focus:bg-tint focus:text-ink text-sm">
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formEventEntries.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEventEntry(idx)}
                        className="text-ink-4 hover:text-danger p-1 shrink-0 transition-colors"
                        aria-label="Remover linha"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addEventEntry}
                  className="text-xs text-brand hover:underline mt-1"
                >
                  + Adicionar linha
                </button>
              </div>

              {formError && (
                <p className="text-xs text-danger bg-danger/5 border border-danger/20 rounded px-3 py-2">
                  {formError}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setAddOpen(false)}
                className="border-border text-ink-2 hover:bg-surface-2"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isCreating}
                className="text-white font-semibold"
                style={{ background: "var(--brand-grad)" }}
              >
                {isCreating ? "Criando..." : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Endpoints list */}
      <Card className="bg-surface border-border shadow-1">
        <CardContent className="p-0">
          {loading ? (
            <div className="px-6 py-12 text-center text-ink-3 text-sm">
              Carregando webhooks...
            </div>
          ) : endpoints.length === 0 ? (
            <div className="px-6 py-16 text-center space-y-3">
              <Webhook className="h-10 w-10 text-border mx-auto" />
              <p className="text-ink-3 text-sm">
                Crie um webhook para receber eventos de serviços externos como Calendly, Google Calendar ou PIX
              </p>
              <Button
                onClick={() => setAddOpen(true)}
                className="text-white font-semibold gap-1.5 mt-2"
                style={{ background: "var(--brand-grad)" }}
              >
                <Plus className="h-4 w-4" />
                Novo Webhook
              </Button>
            </div>
          ) : (
            <div>
              {endpoints.map((endpoint, idx) => (
                <div key={endpoint.id}>
                  <div className="flex items-start gap-4 px-4 py-4">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm text-ink">
                          {endpoint.name}
                        </p>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-tint text-brand border border-brand/20 uppercase tracking-wide">
                          {PROVIDER_CONFIGS[endpoint.provider]?.displayName ?? endpoint.provider}
                        </span>
                      </div>

                      {/* URL */}
                      <div className="flex items-center gap-1.5">
                        <code className="text-xs text-ink-3 bg-surface-2 px-2 py-1 rounded font-mono truncate max-w-xs border border-border">
                          /api/webhooks/hub/{endpoint.path_suffix}
                        </code>
                        <button
                          type="button"
                          onClick={() => void handleCopyUrl(endpoint)}
                          className="text-ink-3 hover:text-brand transition-colors p-1"
                          aria-label="Copiar URL"
                        >
                          {copiedId === endpoint.id ? (
                            <Check className="h-3.5 w-3.5 text-brand" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>

                      {/* Event map preview */}
                      {Object.keys(endpoint.event_map).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.entries(endpoint.event_map).map(([evt, trigger]) => (
                            <span
                              key={evt}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-ink-3 font-mono border border-border"
                            >
                              {evt} → {trigger}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                      {/* Active toggle */}
                      <button
                        type="button"
                        onClick={() => void handleToggle(endpoint)}
                        disabled={togglingId === endpoint.id}
                        className={`h-7 px-2.5 rounded-full text-[11px] font-medium transition-colors border ${
                          endpoint.active
                            ? "bg-brand/10 text-brand border-brand/30 hover:bg-brand/20"
                            : "bg-border/40 text-ink-3 border-border hover:bg-surface-2"
                        } disabled:opacity-50`}
                        aria-label={endpoint.active ? "Desativar" : "Ativar"}
                      >
                        {endpoint.active ? "Ativo" : "Inativo"}
                      </button>

                      {/* Delete */}
                      <Dialog
                        open={deleteId === endpoint.id}
                        onOpenChange={(open) => {
                          if (!open) setDeleteId(null);
                        }}
                      >
                        <DialogTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setDeleteId(endpoint.id)}
                            className="h-7 w-7 flex items-center justify-center rounded-md text-ink-3 hover:bg-danger/10 hover:text-danger transition-colors"
                            aria-label="Excluir webhook"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </DialogTrigger>
                        <DialogContent className="bg-surface border-border text-ink">
                          <DialogHeader>
                            <DialogTitle className="text-ink">
                              Excluir webhook?
                            </DialogTitle>
                          </DialogHeader>
                          <p className="text-sm text-ink-3 py-2">
                            O endpoint{" "}
                            <code className="text-ink font-mono text-xs bg-surface-2 px-1.5 py-0.5 rounded border border-border">
                              /api/webhooks/hub/{endpoint.path_suffix}
                            </code>{" "}
                            será removido e eventos externos direcionados a ele serão ignorados.
                          </p>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setDeleteId(null)}
                              className="border-border text-ink-2 hover:bg-surface-2"
                            >
                              Cancelar
                            </Button>
                            <Button
                              onClick={() => handleDelete(endpoint.id)}
                              disabled={isDeleting}
                              className="bg-danger text-white hover:bg-danger/90 font-semibold"
                            >
                              {isDeleting ? "Excluindo..." : "Excluir"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  {idx < endpoints.length - 1 && (
                    <Separator className="bg-border" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
