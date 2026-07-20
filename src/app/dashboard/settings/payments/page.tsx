"use client";

import { useState, useTransition, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Zap, CreditCard, CheckCircle2, AlertCircle, Send, RefreshCw, Unlink, ArrowRight, Banknote, Clock,
} from "lucide-react";
import { savePaymentSettings, updateBusiness } from "@/lib/settings/actions";
import { createClient } from "@/lib/supabase/client";
import { createAutomation, toggleAutomation } from "@/lib/automations/actions";
import type { Automation } from "@/types/database";

const pixSchema = z.object({
  pix_key: z.string().min(1, "Chave Pix é obrigatória"),
  pix_key_type: z.string().min(1, "Selecione o tipo da chave"),
});
type PixFormData = z.infer<typeof pixSchema>;
type Tab = "pix" | "mercadopago";

export default function PaymentsSettingsPage() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("pix");

  // PIX
  const [pixKeyType, setPixKeyType] = useState("");
  const [isPendingPix, startPixTransition] = useTransition();
  const [pixError, setPixError] = useState<string | null>(null);
  const [pixSuccess, setPixSuccess] = useState(false);
  const [pixConfigured, setPixConfigured] = useState(false);
  const pixForm = useForm<PixFormData>({ resolver: zodResolver(pixSchema) });

  // Payment preferences
  const [paymentMethods, setPaymentMethods] = useState<string[]>([])
  const [chargeTiming, setChargeTiming] = useState<string | null>(null)
  const [autoReminder, setAutoReminder] = useState(false)
  const [reminderAutomation, setReminderAutomation] = useState<Automation | null>(null)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [prefsSaved, setPrefsSaved] = useState(false)
  const [togglingReminder, setTogglingReminder] = useState(false)
  const [businessId, setBusinessId] = useState<string | null>(null)

  // MP
  const [mpConfigured, setMpConfigured] = useState(false);
  const [mpBanner, setMpBanner] = useState<"connected" | "error" | null>(null);
  const [showReconnect, setShowReconnect] = useState(false);
  const [disconnectConfirm, setDisconnectConfirm] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    const mp = searchParams.get("mp");
    if (mp === "connected") { setMpBanner("connected"); setMpConfigured(true); setTab("mercadopago"); }
    else if (mp === "error") { setMpBanner("error"); setTab("mercadopago"); }
    if (mp) {
      const url = new URL(window.location.href);
      url.searchParams.delete("mp");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: rawBu } = await supabase
        .from("business_users").select("business_id").eq("user_id", user.id).single();
      const bu = rawBu as { business_id: string } | null;
      if (!bu?.business_id) return;
      setBusinessId(bu.business_id)
      const { data: rawBiz } = await supabase
        .from("businesses")
        .select("pix_key, pix_key_type, mercadopago_access_token, settings")
        .eq("id", bu.business_id).single();
      const biz = rawBiz as {
        pix_key: string | null; pix_key_type: string | null; mercadopago_access_token: string | null;
        settings: Record<string, unknown> | null;
      } | null;
      if (!biz) return;
      if (biz.pix_key) { pixForm.setValue("pix_key", biz.pix_key); setPixConfigured(true); }
      if (biz.pix_key_type) { setPixKeyType(biz.pix_key_type); pixForm.setValue("pix_key_type", biz.pix_key_type); }
      setMpConfigured(Boolean(biz.mercadopago_access_token));
      // Load payment preferences from settings JSONB
      const s = biz.settings ?? {}
      if (Array.isArray(s.payment_methods)) setPaymentMethods(s.payment_methods as string[])
      if (typeof s.charge_timing === "string") setChargeTiming(s.charge_timing)
      if (typeof s.auto_payment_reminder === "boolean") setAutoReminder(s.auto_payment_reminder)
      // Load reminder automation state
      const { data: automations } = await supabase
        .from("automations")
        .select("*")
        .eq("business_id", bu.business_id)
        .eq("trigger_type", "payment_pending")
        .limit(1)
        .maybeSingle()
      if (automations) {
        setReminderAutomation(automations as Automation)
        setAutoReminder((automations as Automation).active)
      }
    }
    load();
  }, [pixForm]);

  function onPixSubmit(data: PixFormData) {
    setPixError(null);
    setPixSuccess(false);
    startPixTransition(async () => {
      try {
        await savePaymentSettings(data);
        setPixSuccess(true);
        setPixConfigured(true);
        setTimeout(() => setPixSuccess(false), 3000);
      } catch (err) {
        setPixError(err instanceof Error ? err.message : "Erro ao salvar");
      }
    });
  }

  async function handleDisconnectMp() {
    setIsDisconnecting(true);
    try {
      const res = await fetch("/api/mercadopago/disconnect", { method: "POST" });
      if (res.ok) { setMpConfigured(false); setDisconnectConfirm(false); setShowReconnect(false); setTestResult(null); }
    } finally { setIsDisconnecting(false); }
  }

  function toggleMethod(method: string) {
    setPaymentMethods(prev =>
      prev.includes(method) ? prev.filter(m => m !== method) : [...prev, method]
    )
  }

  async function savePreferences() {
    setSavingPrefs(true)
    try {
      const s = (await (async () => {
        const supabase = createClient()
        const { data } = await supabase.from("businesses").select("settings").eq("id", businessId!).single()
        return (data as { settings: Record<string, unknown> | null } | null)?.settings ?? {}
      })())
      await updateBusiness({
        settings: { ...s, payment_methods: paymentMethods, ...(chargeTiming ? { charge_timing: chargeTiming } : {}) }
      } as never)
      setPrefsSaved(true)
      setTimeout(() => setPrefsSaved(false), 3000)
    } finally {
      setSavingPrefs(false)
    }
  }

  async function handleToggleReminder() {
    if (!businessId) return
    setTogglingReminder(true)
    const next = !autoReminder
    try {
      if (!reminderAutomation) {
        const created = await createAutomation({
          business_id: businessId,
          name: "Lembrete de Pagamento",
          trigger_type: "payment_pending",
          message_template: "Olá, {{customer_name}}! Lembramos que há um pagamento pendente referente ao seu atendimento em *{{business_name}}*.\n\nValor: *{{payment_amount}}*\n\nQualquer dúvida, é só falar! 🙏",
          delay_minutes: 1440,
          active: true,
          conditions: [],
          last_run_at: null,
          run_count: 0,
        })
        setReminderAutomation(created)
        setAutoReminder(true)
      } else {
        await toggleAutomation(reminderAutomation.id, next)
        setReminderAutomation(prev => prev ? { ...prev, active: next } : prev)
        setAutoReminder(next)
      }
      // Persist in settings
      const supabase = createClient()
      const { data } = await supabase.from("businesses").select("settings").eq("id", businessId).single()
      const s = (data as { settings: Record<string, unknown> | null } | null)?.settings ?? {}
      await updateBusiness({ settings: { ...s, auto_payment_reminder: next } } as never)
    } finally {
      setTogglingReminder(false)
    }
  }

  async function handleTestMp() {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/mercadopago/test", { method: "POST" });
      if (res.ok) {
        setTestResult({ ok: true, message: "Integração Mercado Pago funcionando!" });
      } else {
        const body = await res.json().catch(() => ({}));
        setTestResult({ ok: false, message: (body as { error?: string }).error ?? "Falha ao testar" });
      }
    } catch { setTestResult({ ok: false, message: "Erro de rede ao testar" }); }
    finally { setIsTesting(false); }
  }

  const pixPlaceholder =
    pixKeyType === "phone" ? "+55 11 99999-9999" :
    pixKeyType === "email" ? "seu@email.com" :
    pixKeyType === "cpf_cnpj" ? "000.000.000-00 ou 00.000.000/0001-00" :
    pixKeyType === "random" ? "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" :
    "Cole sua chave aqui";

  return (
    <div className="max-w-[560px] mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-ink tracking-tight">Pagamentos</h2>
        <p className="text-sm text-ink-3 mt-0.5">Configure como você quer receber dos seus clientes</p>
      </div>

      {/* Pill toggle */}
      <div className="flex gap-1 p-1 bg-surface-2 rounded-xl w-fit border border-border">
        {(["pix", "mercadopago"] as Tab[]).map((t) => {
          const active = tab === t;
          const configured = t === "pix" ? pixConfigured : mpConfigured;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`relative flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-semibold transition-all duration-150 ${
                active
                  ? "bg-surface text-ink shadow-sm"
                  : "text-ink-3 hover:text-ink-2"
              }`}
            >
              {t === "pix" ? "Pix" : "Mercado Pago"}
              {configured && (
                <span className={`w-1.5 h-1.5 rounded-full bg-moss shrink-0 ${active ? "" : "opacity-60"}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── PIX panel ── */}
      {tab === "pix" && (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
            <div className="w-9 h-9 rounded-lg bg-tint flex items-center justify-center shrink-0">
              <Zap className="w-4.5 h-4.5 text-brand" />
            </div>
            <div>
              <p className="text-sm font-bold text-ink">Transferência via Pix</p>
              <p className="text-xs text-ink-3">Sem taxas · Qualquer banco · Confirmação imediata</p>
            </div>
          </div>

          <form onSubmit={pixForm.handleSubmit(onPixSubmit)} className="px-6 py-5 space-y-4">
            <p className="text-xs text-ink-3 leading-relaxed">
              Informe a chave que seus clientes vão usar para transferir o pagamento direto para a sua conta.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Tipo de chave</label>
              <Select
                value={pixKeyType}
                onValueChange={(v) => { setPixKeyType(v); pixForm.setValue("pix_key_type", v); }}
              >
                <SelectTrigger className="border border-border bg-surface text-ink rounded-lg h-10 px-3 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 w-full">
                  <SelectValue placeholder="Selecione o tipo da chave" />
                </SelectTrigger>
                <SelectContent className="bg-surface border-border">
                  <SelectItem value="phone" className="text-ink focus:bg-surface-2">Telefone</SelectItem>
                  <SelectItem value="email" className="text-ink focus:bg-surface-2">E-mail</SelectItem>
                  <SelectItem value="cpf_cnpj" className="text-ink focus:bg-surface-2">CPF / CNPJ</SelectItem>
                  <SelectItem value="random" className="text-ink focus:bg-surface-2">Chave aleatória</SelectItem>
                </SelectContent>
              </Select>
              {pixForm.formState.errors.pix_key_type && (
                <p className="text-xs text-danger">{pixForm.formState.errors.pix_key_type.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Chave</label>
              <input
                {...pixForm.register("pix_key")}
                placeholder={pixPlaceholder}
                type={pixKeyType === "email" ? "email" : "text"}
                className="w-full border border-border bg-surface text-ink rounded-lg h-10 px-3 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 placeholder:text-ink-4 font-mono text-sm"
              />
              {pixForm.formState.errors.pix_key && (
                <p className="text-xs text-danger">{pixForm.formState.errors.pix_key.message}</p>
              )}
            </div>

            {pixError && (
              <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {pixError}
              </div>
            )}
            {pixSuccess && (
              <div className="flex items-center gap-2 text-sm text-moss bg-moss/10 border border-moss/20 rounded-lg px-3 py-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Chave Pix salva com sucesso!
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isPendingPix}
                className="flex items-center gap-2 px-5 h-10 rounded-lg text-white text-sm font-semibold transition hover:opacity-90 disabled:opacity-40"
                style={{ background: "var(--brand-grad)" }}
              >
                {isPendingPix && (
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                )}
                {isPendingPix ? "Salvando…" : pixConfigured ? "Atualizar chave" : "Salvar chave Pix"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Mercado Pago panel ── */}
      {tab === "mercadopago" && (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
            <div className="w-9 h-9 rounded-lg bg-tint flex items-center justify-center shrink-0">
              <CreditCard className="w-4.5 h-4.5 text-brand" />
            </div>
            <div>
              <p className="text-sm font-bold text-ink">Mercado Pago</p>
              <p className="text-xs text-ink-3">Cobranças automáticas pelo chat</p>
            </div>
          </div>

          {/* Banners */}
          {mpBanner === "connected" && (
            <div className="flex items-center gap-2 mx-6 mt-5 rounded-xl border border-moss/30 bg-moss/5 px-4 py-3 text-sm text-moss font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Mercado Pago conectado com sucesso!
            </div>
          )}
          {mpBanner === "error" && (
            <div className="flex items-center gap-2 mx-6 mt-5 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Erro ao conectar. Tente novamente.
            </div>
          )}

          {/* ── Not connected: inviting empty state ── */}
          {!mpConfigured ? (
            <div className="px-6 py-8 flex flex-col items-center text-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-tint flex items-center justify-center">
                <CreditCard className="w-8 h-8 text-brand" />
              </div>

              <div className="space-y-1.5 max-w-xs">
                <p className="text-base font-bold text-ink">Conecte sua conta</p>
                <p className="text-sm text-ink-3 leading-relaxed">
                  Gere links de pagamento e QR Codes direto pelo WhatsApp. Quando o cliente pagar, você recebe confirmação automática.
                </p>
              </div>

              <ul className="space-y-2 text-left w-full max-w-xs">
                {[
                  "Envie cobranças pelo chat com um clique",
                  "Cliente paga por QR Code ou link",
                  "Confirmação automática no RetornAI",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-ink-2">
                    <CheckCircle2 className="w-4 h-4 text-moss shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>

              <a
                href="/api/integrations/mercadopago/connect"
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm transition hover:opacity-90 active:scale-[0.98]"
                style={{ background: "var(--brand-grad)" }}
              >
                Entrar com Mercado Pago
                <ArrowRight className="w-4 h-4" />
              </a>

              <p className="text-xs text-ink-4">
                Você será redirecionado para autorizar o RetornAI no Mercado Pago.
              </p>
            </div>
          ) : (
            /* ── Connected state ── */
            <div className="px-6 py-5 space-y-4">
              {!showReconnect ? (
                <div className="flex items-center gap-3 rounded-xl border border-moss/30 bg-moss/5 px-4 py-3">
                  <CheckCircle2 className="w-5 h-5 text-moss shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">Conta conectada</p>
                    <p className="text-xs text-ink-3">Autorizado via OAuth</p>
                  </div>
                </div>
              ) : (
                <a
                  href="/api/integrations/mercadopago/connect"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-white font-semibold text-sm transition hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "var(--brand-grad)" }}
                >
                  <CreditCard className="w-4 h-4" />
                  Entrar com Mercado Pago
                </a>
              )}

              {!showReconnect && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleTestMp}
                    disabled={isTesting}
                    className="flex items-center gap-1.5 px-4 h-9 rounded-lg text-white text-sm font-semibold transition hover:opacity-90 disabled:opacity-40"
                    style={{ background: "var(--brand-grad)" }}
                  >
                    {isTesting ? (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    {isTesting ? "Testando…" : "Testar conexão"}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setShowReconnect(true); setDisconnectConfirm(false); }}
                    className="flex items-center gap-1.5 px-3 h-9 rounded-xl border border-border text-ink-2 text-sm font-semibold hover:bg-surface-2 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reconectar
                  </button>

                  <div className="flex-1" />

                  {disconnectConfirm ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-3">Tem certeza?</span>
                      <button
                        type="button"
                        onClick={handleDisconnectMp}
                        disabled={isDisconnecting}
                        className="text-xs font-semibold text-danger hover:opacity-80 transition disabled:opacity-40"
                      >
                        {isDisconnecting ? "Desconectando…" : "Sim, desconectar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDisconnectConfirm(false)}
                        className="text-xs text-ink-3 hover:text-ink transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDisconnectConfirm(true)}
                      className="flex items-center gap-1.5 px-3 h-9 rounded-xl border border-danger/30 text-danger text-sm font-semibold hover:bg-danger/5 transition"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      Desconectar
                    </button>
                  )}
                </div>
              )}

              {testResult && (
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm border ${
                  testResult.ok
                    ? "text-moss bg-moss/10 border-moss/20"
                    : "text-danger bg-danger/10 border-danger/20"
                }`}>
                  {testResult.ok
                    ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                    : <AlertCircle className="w-4 h-4 shrink-0" />}
                  {testResult.message}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {/* ── Preferências de cobrança ── */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-tint flex items-center justify-center shrink-0">
            <Banknote className="w-4 h-4 text-brand" />
          </div>
          <div>
            <p className="text-sm font-bold text-ink">Preferências de Cobrança</p>
            <p className="text-xs text-ink-3">Como você cobra seus clientes</p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Payment methods */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Formas aceitas</p>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "pix", label: "Pix" },
                { key: "card", label: "Cartão" },
                { key: "cash", label: "Dinheiro" },
                { key: "transfer", label: "Transferência" },
              ].map(({ key, label }) => {
                const active = paymentMethods.includes(key)
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleMethod(key)}
                    className={`px-4 h-9 rounded-lg text-sm font-semibold border transition-all ${
                      active
                        ? "bg-tint border-brand/30 text-brand"
                        : "bg-surface-2 border-border text-ink-3 hover:text-ink"
                    }`}
                  >
                    {active && <span className="mr-1.5">✓</span>}
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Charge timing */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Quando cobrar</p>
            <div className="flex flex-col gap-2">
              {[
                { key: "before", label: "Antes do serviço", sub: "Cliente paga ao agendar" },
                { key: "after", label: "Após o serviço", sub: "Cobra na conclusão do atendimento" },
                { key: "link_auto", label: "Link automático ao concluir", sub: "RetornAI envia o Pix automaticamente" },
              ].map(({ key, label, sub }) => {
                const active = chargeTiming === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setChargeTiming(key)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                      active ? "border-brand/30 bg-tint" : "border-border hover:bg-surface-2"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                      active ? "border-brand" : "border-border"
                    }`}>
                      {active && <div className="w-2 h-2 rounded-full bg-brand" />}
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${active ? "text-ink" : "text-ink-2"}`}>{label}</p>
                      <p className="text-xs text-ink-3">{sub}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Auto reminder toggle */}
          <div className="flex items-center justify-between gap-4 py-1">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-ink-3 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-ink">Lembrete de cobrança automático</p>
                <p className="text-xs text-ink-3">Envia mensagem ao cliente após 24h de pagamento pendente</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleReminder}
              disabled={togglingReminder || !businessId}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-40 ${autoReminder ? "bg-brand" : "bg-border"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${autoReminder ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          {prefsSaved && (
            <div className="flex items-center gap-2 text-sm text-moss bg-moss/10 border border-moss/20 rounded-lg px-3 py-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Preferências salvas!
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={savePreferences}
              disabled={savingPrefs || !businessId}
              className="flex items-center gap-2 px-5 h-10 rounded-lg text-white text-sm font-semibold transition hover:opacity-90 disabled:opacity-40"
              style={{ background: "var(--brand-grad)" }}
            >
              {savingPrefs && <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
              {savingPrefs ? "Salvando…" : "Salvar preferências"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
