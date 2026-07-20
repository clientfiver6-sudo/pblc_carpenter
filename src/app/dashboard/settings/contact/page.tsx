"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, MessageCircle } from "lucide-react";

const CHANNELS = [
  {
    icon: Mail,
    label: "E-mail",
    value: "suporte@retornai.com.br",
    href: "mailto:suporte@retornai.com.br",
    description: "Respondemos em até 24 horas úteis",
  },
  {
    icon: MessageCircle,
    label: "WhatsApp",
    value: "+55 11 99999-9999",
    href: "https://wa.me/5511999999999",
    description: "Atendimento de segunda a sexta, das 9h às 18h",
  },
];

export default function ContactPage() {
  const router = useRouter();

  return (
    <div className="max-w-[560px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-ink tracking-tight">Fale Conosco</h2>
        <p className="text-sm text-ink-3 mt-0.5">Entre em contato com nossa equipe de suporte</p>
      </div>

      {/* Channels */}
      <div className="space-y-3">
        {CHANNELS.map(({ icon: Icon, label, value, href, description }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 bg-surface border border-border rounded-2xl p-5 hover:border-border-2 hover:shadow-2 hover:-translate-y-0.5 transition-[border-color,box-shadow,transform] duration-150 ease-brand-out group"
          >
            <div className="w-10 h-10 rounded-xl bg-tint flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide mb-0.5">{label}</p>
              <p className="text-sm font-bold text-ink">{value}</p>
              <p className="text-xs text-ink-3 mt-0.5">{description}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
