"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageCircle, CheckCircle2, AlertCircle, Send,
  Unlink, RefreshCw, Loader2, Zap, Bot,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import NextLink from "next/link";
import { updateBusiness } from "@/lib/settings/actions";

type Phase = "idle" | "loading" | "qr" | "connected";
type EvoState = "open" | "connecting" | "close" | null;

interface LiveStatus {
  connected: boolean;
  state: EvoState;
  phone: string | null;
  profileName: string | null;
  instanceName: string | null;
}

const STATE_LABELS: Record<NonNullable<EvoState>, { label: string; cls: string }> = {
  open:       { label: "Conectado",    cls: "text-moss bg-moss/10 border-moss/20" },
  connecting: { label: "Conectando…",  cls: "text-amber-600 bg-amber-50 border-amber-200" },
  close:      { label: "Desconectado", cls: "text-danger bg-danger/10 border-danger/20" },
};

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "")
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`
  if (d.length === 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`
  return `+${d}`
}

export default function WhatsAppSettingsPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [instanceName, setInstanceName] = useState("");
  const [loading, setLoading] = useState(true);

  // QR flow
  const [phase, setPhase] = useState<Phase>("idle");
  const [qr, setQr] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Live Evolution API status
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Disconnect
  const [disconnectConfirm, setDisconnectConfirm] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  // AI toggle
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiToggling, setAiToggling] = useState(false);

  // Import notification (fires after reconnect)
  const [importing, setImporting] = useState(false);

  // Test send
  const [testNumber, setTestNumber] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopAllIntervals() {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    if (qrRefreshRef.current) { clearInterval(qrRefreshRef.current); qrRefreshRef.current = null; }
  }

  const fetchLiveStatus = useCallback(async (): Promise<LiveStatus | null> => {
    try {
      const res = await fetch("/api/whatsapp/connect-status");
      if (!res.ok) return null;
      return (await res.json()) as LiveStatus;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: rawBu } = await supabase
        .from("business_users")
        .select("business_id")
        .eq("user_id", user.id)
        .single();
      const bu = rawBu as { business_id: string } | null;
      if (!bu?.business_id) { setLoading(false); return; }

      const { data: rawBiz } = await supabase
        .from("businesses")
        .select("whatsapp_phone_id, whatsapp_connected_at, whatsapp_ai_enabled")
        .eq("id", bu.business_id)
        .single();
      const biz = rawBiz as {
        whatsapp_phone_id: string | null;
        whatsapp_connected_at: string | null;
        whatsapp_ai_enabled: boolean;
      } | null;

      setAiEnabled(biz?.whatsapp_ai_enabled ?? false);

      setInstanceName(biz?.whatsapp_phone_id ?? `business-${bu.business_id}`);

      if (biz?.whatsapp_phone_id) {
        // DB says connected — show disconnect UI regardless of live check result.
        // The live check adds extra info (phone, state badge) but a stale/broken
        // Evolution API instance shouldn't prevent the user from disconnecting.
        setIsConnected(true);
        setPhase("connected");

        const live = await fetchLiveStatus();
        setLiveStatus(live);
      }
      setLoading(false);
    }
    load();
    return () => stopAllIntervals();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleToggleAI() {
    setAiToggling(true);
    try {
      await updateBusiness({ whatsapp_ai_enabled: !aiEnabled } as never);
      setAiEnabled(v => !v);
    } finally {
      setAiToggling(false);
    }
  }

  async function handleRefreshStatus() {
    setRefreshing(true);
    const live = await fetchLiveStatus();
    setLiveStatus(live);
    setRefreshing(false);
  }

  function startPolling() {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const live = await fetchLiveStatus();
        if (live?.connected) {
          stopAllIntervals();
          setLiveStatus(live);
          setIsConnected(true);
          setPhase("connected");
          setQr(null);
          // Show import banner — connect-status fires the import server-side
          setImporting(true);
          setTimeout(() => setImporting(false), 10_000);
        }
      } catch {
        // ignore transient errors
      }
    }, 3000);
  }

  function startQrRefresh() {
    if (qrRefreshRef.current) clearInterval(qrRefreshRef.current);
    qrRefreshRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/whatsapp/connect-qr");
        const { qr: newQr } = (await res.json()) as { qr: string | null };
        if (newQr) setQr(newQr);
      } catch {
        // ignore
      }
    }, 20000);
  }

  async function handleConnect() {
    setPhase("loading");
    setConnectError(null);
    setQr(null);
    try {
      const res = await fetch("/api/whatsapp/connect-init", { method: "POST" });
      const data = (await res.json()) as { qr?: string | null; error?: string };
      if (!res.ok) {
        setConnectError(data.error ?? "Falha ao iniciar conexão");
        setPhase("idle");
        return;
      }
      setQr(data.qr ?? null);
      setPhase("qr");
      startPolling();
      startQrRefresh();
    } catch {
      setConnectError("Erro de rede");
      setPhase("idle");
    }
  }

  async function handleDisconnect() {
    setIsDisconnecting(true);
    setDisconnectError(null);
    try {
      const res = await fetch("/api/whatsapp/disconnect", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        setIsConnected(false);
        setLiveStatus(null);
        setDisconnectConfirm(false);
        setDisconnectError(null);
        setTestResult(null);
        setPhase("idle");
        setQr(null);
      } else {
        setDisconnectError(body.error ?? "Erro ao desconectar. Tente novamente.");
      }
    } catch {
      setDisconnectError("Erro de rede ao desconectar.");
    } finally {
      setIsDisconnecting(false);
    }
  }

  async function handleTest() {
    if (!testNumber.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testNumber.trim(), message: "Olá! Integração RetornAI funcionando ✓" }),
      });
      if (res.ok) {
        setTestResult({ ok: true, message: "Mensagem enviada! Verifique o WhatsApp." });
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setTestResult({ ok: false, message: body.error ?? "Falha ao enviar" });
      }
    } catch {
      setTestResult({ ok: false, message: "Erro de rede" });
    } finally {
      setIsTesting(false);
    }
  }

  const evoState = liveStatus?.state ?? null;
  const stateInfo = evoState ? STATE_LABELS[evoState] : null;

  return (
    <div className="max-w-[560px] mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-tint flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-brand" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-ink tracking-tight">WhatsApp</h2>
            <span className="flex items-center gap-1 text-xs font-medium text-ink-3 border border-border rounded-full px-2 py-0.5">
              <Zap className="w-3 h-3" /> Evolution API
            </span>
          </div>
          <p className="text-sm text-ink-3">Conecte o número que seus clientes já usam para falar com você</p>
        </div>
      </div>

      {/* AI toggle — always visible, gated independently of connection status */}
      <div className="rounded-2xl border border-border bg-surface p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${aiEnabled ? "bg-moss/10" : "bg-surface-2"}`}>
            <Bot className={`w-5 h-5 ${aiEnabled ? "text-moss" : "text-ink-4"}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">IA no WhatsApp</p>
            <p className="text-xs text-ink-3 leading-snug">
              {aiEnabled
                ? "Respondendo automaticamente às mensagens do negócio"
                : "Desligada — nenhuma mensagem será enviada automaticamente"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleToggleAI}
          disabled={aiToggling}
          aria-label={aiEnabled ? "Desligar IA" : "Ligar IA"}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${aiEnabled ? "bg-moss" : "bg-ink-4/30"}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${aiEnabled ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>

      {/* Import banner — shown briefly after reconnect while history syncs */}
      {importing && (
        <div className="flex items-center gap-3 rounded-xl border border-brand/30 bg-tint px-4 py-3 text-sm">
          <Loader2 className="w-4 h-4 text-brand animate-spin shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-ink">Importando histórico…</p>
            <p className="text-xs text-ink-3">
              Suas conversas aparecerão em{" "}
              <NextLink href="/dashboard/conversas" className="text-brand underline underline-offset-2">
                Conversas
              </NextLink>{" "}
              em instantes.
            </p>
          </div>
        </div>
      )}

      {/* Connect / status card */}
      <div className="rounded-2xl border border-border bg-surface p-6 space-y-4">
        {loading ? (
          <div className="h-12 rounded-xl bg-surface-2 animate-pulse" />
        ) : phase === "connected" || isConnected ? (
          <>
            {/* Connection status row */}
            <div className="flex items-start gap-3 rounded-xl border border-moss/30 bg-moss/5 px-4 py-3">
              <CheckCircle2 className="w-5 h-5 text-moss shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-sm font-semibold text-ink">WhatsApp conectado</p>
                {liveStatus?.phone && (
                  <p className="text-sm text-ink-2 font-mono">{formatPhone(liveStatus.phone)}</p>
                )}
                {liveStatus?.profileName && (
                  <p className="text-xs text-ink-3">{liveStatus.profileName}</p>
                )}
                <p className="text-xs text-ink-4 font-mono truncate">
                  Instância: {liveStatus?.instanceName ?? instanceName}
                </p>
              </div>
              <span className="text-xs font-semibold text-moss bg-moss/10 px-2 py-0.5 rounded-full shrink-0">
                Conectado
              </span>
            </div>

            {/* Live state from Evolution API */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-3">Estado Evolution API:</span>
                {stateInfo ? (
                  <span className={`text-xs font-semibold border px-2 py-0.5 rounded-full ${stateInfo.cls}`}>
                    {stateInfo.label}
                  </span>
                ) : (
                  <span className="text-xs text-ink-4">—</span>
                )}
              </div>
              <button
                type="button"
                onClick={handleRefreshStatus}
                disabled={refreshing}
                className="flex items-center gap-1.5 text-xs text-ink-3 hover:text-ink transition disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                Verificar
              </button>
            </div>

            {/* Disconnect */}
            <div className="pt-1 border-t border-border space-y-2">
              {disconnectError && (
                <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs border text-danger bg-danger/10 border-danger/20">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {disconnectError}
                </div>
              )}
              {disconnectConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-3">Tem certeza?</span>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                    className="text-xs font-semibold text-danger hover:opacity-80 transition disabled:opacity-40"
                  >
                    {isDisconnecting ? "Desconectando…" : "Sim"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDisconnectConfirm(false); setDisconnectError(null); }}
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
          </>
        ) : (
          <>
            <div>
              <p className="text-sm font-semibold text-ink mb-1">Conectar via QR Code</p>
              <p className="text-xs text-ink-3 leading-relaxed">
                Clique em &ldquo;Conectar WhatsApp&rdquo; e escaneie o QR code com seu celular para vincular o número.
                A conexão é gerenciada pelo Evolution API.
              </p>
            </div>

            {phase === "qr" && (
              <div className="flex flex-col items-center gap-3 py-2">
                {qr ? (
                  <img
                    src={qr}
                    alt="QR Code WhatsApp"
                    className="w-56 h-56 rounded-xl border border-border"
                  />
                ) : (
                  <div className="w-56 h-56 rounded-xl border border-border bg-surface-2 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-ink-3 animate-spin" />
                  </div>
                )}
                {!qr && (
                  <p className="text-sm text-ink-3 text-center">
                    Aguardando QR code… Se demorar, clique em cancelar e tente novamente.
                  </p>
                )}
                {qr && <p className="text-sm text-ink-3">Escaneie com seu WhatsApp para conectar</p>}
                <p className="text-xs text-ink-4">Atualizado automaticamente a cada 20s</p>
              </div>
            )}

            {connectError && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm border text-danger bg-danger/10 border-danger/20">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {connectError}
                </div>
                <button
                  type="button"
                  onClick={handleConnect}
                  className="text-sm font-medium text-brand hover:text-brand-2 transition-colors"
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {phase !== "qr" && (
              <button
                type="button"
                onClick={handleConnect}
                disabled={phase === "loading"}
                className="w-full h-10 rounded-lg text-white text-sm font-semibold transition hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: "var(--brand-grad)" }}
              >
                {phase === "loading" ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Criando instância…</>
                ) : (
                  "Conectar WhatsApp"
                )}
              </button>
            )}

            {phase === "qr" && (
              <button
                type="button"
                onClick={() => { stopAllIntervals(); setPhase("idle"); setQr(null); }}
                className="w-full h-10 rounded-lg border border-border text-ink-3 text-sm font-semibold hover:bg-surface-2 transition"
              >
                Cancelar
              </button>
            )}
          </>
        )}
      </div>

      {/* Test send — only shown when connected */}
      {(isConnected || phase === "connected") && (
        <div className="rounded-2xl border border-border bg-surface p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-ink-3" />
            <div>
              <p className="text-sm font-semibold text-ink">Testar envio</p>
              <p className="text-xs text-ink-3 mt-0.5">Envie uma mensagem para confirmar que está tudo funcionando</p>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={testNumber}
              onChange={(e) => setTestNumber(e.target.value)}
              placeholder="5511999999999"
              className="flex-1 rounded-lg border border-border bg-surface text-sm text-ink placeholder:text-ink-4 px-4 h-10 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 font-mono"
            />
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting || !testNumber.trim()}
              className="flex items-center gap-1.5 px-4 h-10 rounded-lg text-white text-sm font-semibold transition hover:opacity-90 disabled:opacity-40 shrink-0"
              style={{ background: "var(--brand-grad)" }}
            >
              {isTesting ? (
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              {isTesting ? "Enviando…" : "Testar"}
            </button>
          </div>

          {testResult && (
            <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm border ${
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
  );
}
