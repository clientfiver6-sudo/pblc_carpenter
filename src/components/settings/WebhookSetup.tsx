"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface WebhookSetupProps {
  appUrl: string;
  verifyToken?: string;
}

function CopyableRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // fallback for non-HTTPS contexts
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-ink-3 uppercase tracking-wide">{label}</p>
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2">
        <span
          className={cn(
            "flex-1 truncate text-sm text-ink-3 break-all",
            mono && "font-mono text-xs"
          )}
        >
          {value}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-md p-1 text-ink-3 transition-colors hover:text-ink"
          aria-label={`Copiar ${label}`}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-brand" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

const STEPS = [
  "Acesse Meta Business Manager → WhatsApp → Configurações de API",
  'Em "Webhooks", clique em "Editar"',
  "Cole a URL e o Token de verificação acima",
  'Selecione os eventos: messages',
  'Clique em "Verificar e salvar"',
];

export default function WebhookSetup({ appUrl, verifyToken }: WebhookSetupProps) {
  const webhookUrl = `${appUrl}/api/webhooks/whatsapp`;
  const tokenDisplay = verifyToken ?? "Defina WHATSAPP_WEBHOOK_VERIFY_TOKEN no .env.local";
  const hasToken = Boolean(verifyToken);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <CopyableRow label="URL do Webhook" value={webhookUrl} />
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-ink-3 uppercase tracking-wide">
            Token de Verificação
          </p>
          {hasToken ? (
            <CopyableRow label="Token de Verificação" value={tokenDisplay} />
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2">
              <span className="flex-1 truncate font-mono text-xs text-ink-4 italic">
                {tokenDisplay}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Step-by-step instructions */}
      <div className="bg-surface border border-border rounded-lg p-5 space-y-3 shadow-1">
        <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide">
          Como configurar no Meta Business Manager
        </p>
        <ol className="space-y-2.5">
          {STEPS.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-tint border border-brand/20 text-[10px] font-bold text-brand">
                {i + 1}
              </span>
              <span className="text-sm text-ink-3 leading-snug">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
