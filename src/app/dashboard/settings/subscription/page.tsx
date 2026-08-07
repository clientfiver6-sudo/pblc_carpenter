"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, AlertCircle, CalendarDays, Loader2, Check, Tag } from "lucide-react";
import { applyPromoCode } from "./actions";

interface SubscriptionState {
  businessId: string | null;
  status: string;
  plan: string;
  endsAt: string | null;
  loading: boolean;
}

function statusInfo(status: string): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    active:    { label: "Ativo",              cls: "bg-moss/15 text-moss border-moss/30" },
    trialing:  { label: "Em teste",           cls: "bg-tint text-brand border-brand/30" },
    past_due:  { label: "Pagamento atrasado", cls: "bg-warning/15 text-warning border-warning/30" },
    cancelled: { label: "Cancelado",          cls: "bg-danger/10 text-danger border-danger/30" },
  };
  return map[status] ?? { label: status, cls: "bg-surface-2 text-ink-3 border-border" };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

const STARTER_FEATURES = [
  "Clientes e CRM",
  "Agenda e chamados",
  "Conversas + WhatsApp IA",
  "Pagamentos e cobranças",
  "Equipe e serviços",
];

const PRO_FEATURES = [
  "Tudo do Starter",
  "Automações",
  "Personalize sua IA como quiser",
  "Analytics completo",
  "Gráficos com IA",
  "Aprovações da IA",
  "Assistente RetornAI",
];

const MEDICAL_FEATURES = [
  "Tudo do Pro",
  "Prontuários SOAP com IA",
  "Anamnese digital",
  "Prescrições",
  "Pedidos de exames",
  "Convênios",
];

export default function SubscriptionPage() {
  const searchParams = useSearchParams();
  const [sub, setSub] = useState<SubscriptionState>({
    businessId: null,
    status: "trialing",
    plan: "starter",
    endsAt: null,
    loading: true,
  });
  const [banner, setBanner] = useState<"success" | "error" | null>(null);
  const [isPending, startTransition] = useTransition();
  const submitting = useRef(false);
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  useEffect(() => {
    const result = searchParams.get("sub");
    if (result === "success") setBanner("success");
    else if (result === "error") setBanner("error");
    if (result) window.history.replaceState({}, "", window.location.pathname);
  }, [searchParams]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: buData } = await supabase
        .from("business_users")
        .select("business_id")
        .eq("user_id", user.id)
        .single();
      if (!buData) return;
      const businessId = (buData as { business_id: string }).business_id;
      const { data: bizData } = await supabase
        .from("businesses")
        .select("subscription_status,subscription_plan,subscription_ends_at")
        .eq("id", businessId)
        .single();
      const biz = bizData as { subscription_status: string; subscription_plan: string; subscription_ends_at: string | null } | null;
      setSub({
        businessId,
        status: biz?.subscription_status ?? "trialing",
        plan: biz?.subscription_plan ?? "starter",
        endsAt: biz?.subscription_ends_at ?? null,
        loading: false,
      });
    }
    load();
  }, []);

  function handleSubscribe(plan: "starter" | "pro" | "medical") {
    if (!sub.businessId) return;
    if (submitting.current) return;
    submitting.current = true;
    setActionError(null);
    setPendingPlan(plan);
    startTransition(async () => {
      const res = await fetch("/api/subscriptions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: sub.businessId, plan }),
      });
      setPendingPlan(null);
      submitting.current = false;
      if (!res.ok) {
        if (res.status === 409) { setActionError("Você já possui uma assinatura ativa."); return; }
        setActionError("Erro ao criar assinatura. Tente novamente.");
        return;
      }
      const { url } = (await res.json()) as { url?: string };
      if (url) window.location.href = url;
    });
  }

  async function handlePromo() {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError(null);
    const result = await applyPromoCode(promoCode.trim());
    setPromoLoading(false);
    if (result.error) { setPromoError(result.error); return; }
    setPromoApplied(true);
    setPromoCode("");
    // Reload subscription state from DB
    setSub(s => ({ ...s, status: "active", plan: result.plan ?? s.plan }));
  }

  function handleCancel() {
    if (!sub.businessId) return;
    setActionError(null);
    startTransition(async () => {
      const res = await fetch("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: sub.businessId }),
      });
      if (!res.ok) { setActionError("Erro ao cancelar assinatura. Tente novamente."); setCancelConfirm(false); return; }
      setSub(s => ({ ...s, status: "cancelled" }));
      setCancelConfirm(false);
    });
  }

  const { label, cls } = statusInfo(sub.status);
  const canSubscribe = sub.status === "trialing" || sub.status === "cancelled" || sub.status === "past_due";
  const isActive = sub.status === "active";

  return (
    <div className="min-h-screen bg-bg text-ink">
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 md:px-8 py-7 pb-28 space-y-6">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-ink tracking-tight">Plano & Cobrança</h2>
          <p className="text-sm text-ink-3 mt-0.5">Gerencie sua assinatura RetornAI</p>
        </div>

        {banner === "success" && (
          <div className="flex items-center gap-3 bg-moss/10 border border-moss/30 text-moss rounded-lg px-4 py-3 text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> Assinatura ativada com sucesso!
          </div>
        )}
        {banner === "error" && (
          <div className="flex items-center gap-3 bg-danger/10 border border-danger/30 text-danger rounded-lg px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> Ocorreu um erro na assinatura. Tente novamente.
          </div>
        )}

        {sub.loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 text-ink-4 animate-spin" />
          </div>
        ) : (
          <>
            {/* Current status */}
            <div className="bg-surface border border-border rounded-xl px-5 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-ink">
                  Plano atual: <span className="capitalize">{sub.plan === "medical" ? "Medical" : sub.plan === "pro" ? "Pro" : "Starter"}</span>
                </p>
                {sub.endsAt && isActive && (
                  <div className="flex items-center gap-1.5 text-xs text-ink-3 mt-1">
                    <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                    Próxima cobrança em {fmtDate(sub.endsAt)}
                  </div>
                )}
                {sub.status === "trialing" && <p className="text-xs text-ink-3 mt-1">Período de avaliação gratuita</p>}
                {sub.status === "past_due" && <p className="text-xs text-danger mt-1">Problema com o pagamento. Atualize para continuar.</p>}
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${cls}`}>{label}</span>
            </div>

            {actionError && (
              <div className="flex items-center gap-2 text-danger text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" /> {actionError}
              </div>
            )}

            {/* Plan cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Starter */}
              <div className={`rounded-xl border p-5 relative ${sub.plan === "starter" && isActive ? "border-2 border-ink" : "border-border bg-surface"}`}>
                {sub.plan === "starter" && isActive && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-ink text-white uppercase tracking-wide">Plano atual</span>
                  </div>
                )}
                <div className="mb-4">
                  <p className="text-lg font-bold text-ink">Starter</p>
                  <p className="text-2xl font-bold text-ink mt-1">R$20,00<span className="text-sm font-normal text-ink-3">/mês</span></p>
                </div>
                <ul className="space-y-2 mb-5">
                  {STARTER_FEATURES.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-ink-2">
                      <Check className="w-4 h-4 text-moss shrink-0 mt-0.5" />{f}
                    </li>
                  ))}
                </ul>
                {(canSubscribe || (isActive && sub.plan !== "starter")) && (
                  <button
                    onClick={() => handleSubscribe("starter")}
                    disabled={isPending}
                    className="w-full py-2 rounded-lg border border-border text-sm font-medium text-ink-2 hover:bg-surface-2 transition-colors disabled:opacity-60"
                  >
                    {isPending && pendingPlan === "starter"
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                      : isActive ? "Mudar para Starter" : "Assinar Starter"}
                  </button>
                )}
              </div>

              {/* Pro */}
              <div className={`rounded-xl border p-5 relative ${sub.plan === "pro" && isActive ? "border-2 border-brand" : "border-brand/40 bg-tint/20"}`}>
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-brand text-white uppercase tracking-wide">
                    {sub.plan === "pro" && isActive ? "Plano atual" : "Recomendado"}
                  </span>
                </div>
                <div className="mb-4">
                  <p className="text-lg font-bold text-ink">Pro</p>
                  <p className="text-2xl font-bold text-ink mt-1">R$50,00<span className="text-sm font-normal text-ink-3">/mês</span></p>
                </div>
                <ul className="space-y-2 mb-5">
                  {PRO_FEATURES.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-ink">
                      <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--brand)" }} />{f}
                    </li>
                  ))}
                </ul>
                {(canSubscribe || (isActive && sub.plan !== "pro")) && (
                  <button
                    onClick={() => handleSubscribe("pro")}
                    disabled={isPending}
                    className="w-full py-2 rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
                    style={{ background: "var(--brand-grad)" }}
                  >
                    {isPending && pendingPlan === "pro"
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                      : isActive && sub.plan === "starter" ? "Fazer upgrade para Pro" : isActive ? "Mudar para Pro" : "Assinar Pro"}
                  </button>
                )}
              </div>

              {/* Medical */}
              <div className={`rounded-xl border p-5 relative ${sub.plan === "medical" && isActive ? "border-2 border-info" : "border-info/30 bg-info/5"}`}>
                {sub.plan === "medical" && isActive && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-info text-white uppercase tracking-wide">Plano atual</span>
                  </div>
                )}
                <div className="mb-4">
                  <p className="text-lg font-bold text-ink">Medical</p>
                  <p className="text-2xl font-bold text-ink mt-1">R$100,00<span className="text-sm font-normal text-ink-3">/mês</span></p>
                </div>
                <ul className="space-y-2 mb-5">
                  {MEDICAL_FEATURES.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-ink">
                      <Check className="w-4 h-4 shrink-0 mt-0.5 text-info" />{f}
                    </li>
                  ))}
                </ul>
                {(canSubscribe || (isActive && sub.plan !== "medical")) && (
                  <button
                    onClick={() => handleSubscribe("medical")}
                    disabled={isPending}
                    className="w-full py-2 rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60 bg-info hover:bg-info/90"
                  >
                    {isPending && pendingPlan === "medical"
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                      : isActive ? "Mudar para Medical" : "Assinar Medical"}
                  </button>
                )}
              </div>
            </div>

            {/* Promo code */}
            <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-ink-3 shrink-0" />
                <p className="text-sm font-medium text-ink">Código promocional</p>
              </div>
              {promoApplied ? (
                <div className="flex items-center gap-2 text-sm text-moss">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Cupom aplicado! Seu plano foi ativado.
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={e => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="Ex: STARTERFREE"
                    className="flex-1 h-9 rounded-lg border border-border bg-bg px-3 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                  />
                  <button
                    onClick={handlePromo}
                    disabled={promoLoading || !promoCode.trim()}
                    className="px-4 h-9 rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 shrink-0"
                    style={{ background: "var(--brand-grad)" }}
                  >
                    {promoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Aplicar"}
                  </button>
                </div>
              )}
              {promoError && <p className="text-xs text-danger">{promoError}</p>}
            </div>

            {/* Cancel */}
            {isActive && (
              <div className="pt-2">
                {!cancelConfirm ? (
                  <button
                    onClick={() => setCancelConfirm(true)}
                    className="text-sm text-ink-3 hover:text-danger transition-colors"
                  >
                    Cancelar assinatura
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-ink-3">Tem certeza?</span>
                    <button
                      onClick={handleCancel}
                      disabled={isPending}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-danger text-white text-sm font-medium hover:bg-danger/90 transition-colors disabled:opacity-60"
                    >
                      {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Confirmar cancelamento
                    </button>
                    <button
                      onClick={() => setCancelConfirm(false)}
                      className="px-3 py-1.5 rounded-lg border border-border text-sm text-ink-3 hover:bg-surface-2 transition-colors"
                    >
                      Voltar
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
