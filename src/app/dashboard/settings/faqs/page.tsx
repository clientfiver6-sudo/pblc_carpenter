"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle, ChevronDown, ArrowLeft } from "lucide-react";

const FAQS = [
  {
    q: "O que é o RetornAI?",
    a: "RetornAI é um sistema operacional para pequenas e médias empresas brasileiras. Ele usa inteligência artificial para atender clientes pelo WhatsApp, gerenciar agendamentos, cobranças e equipe — tudo em um só lugar.",
  },
  {
    q: "Como o assistente responde pelos meus clientes?",
    a: "O assistente lê as mensagens do WhatsApp conectado e responde automaticamente com base nas informações do seu negócio: serviços, horários, preços e perguntas frequentes que você cadastrou. Mensagens que ele não sabe responder são encaminhadas para você.",
  },
  {
    q: "O WhatsApp precisa ficar conectado o tempo todo?",
    a: "Sim. O RetornAI funciona via Evolution API, então o celular ou a sessão do WhatsApp Business precisa estar ativa. Se a conexão cair, você recebe um alerta e pode reconectar direto nas configurações.",
  },
  {
    q: "O assistente funciona 24 horas?",
    a: "Sim. O assistente responde clientes a qualquer hora do dia, mesmo fora do horário de atendimento. Você pode configurar mensagens específicas para horário fora do expediente.",
  },
  {
    q: "Como o RetornAI cobra dos meus clientes?",
    a: "Você pode receber por Pix (configurando sua chave) ou por Mercado Pago (conectando sua conta via OAuth). O assistente consegue gerar cobranças e enviar links de pagamento direto pelo chat.",
  },
  {
    q: "Meus dados ficam seguros?",
    a: "Sim. Todos os dados são armazenados com criptografia em repouso e em trânsito. As credenciais sensíveis (tokens de WhatsApp, Mercado Pago) são criptografadas antes de serem salvas no banco de dados.",
  },
  {
    q: "Posso adicionar membros da equipe?",
    a: "Sim. Você pode convidar colaboradores pelo painel de configurações. Cada membro tem acesso ao mesmo negócio e pode visualizar conversas, agendamentos e pagamentos.",
  },
  {
    q: "Como cancelo ou altero minha assinatura?",
    a: "Entre em contato com nossa equipe pelo e-mail suporte@retornai.com.br. O cancelamento é processado até o final do ciclo de faturamento atual, sem multas.",
  },
];

export default function FaqsSettingsPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const router = useRouter();

  return (
    <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-8 space-y-6">
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
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-tint flex items-center justify-center shrink-0">
          <HelpCircle className="w-4.5 h-4.5 text-brand" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-ink tracking-tight">Perguntas Frequentes</h2>
          <p className="text-sm text-ink-3 mt-0.5">Dúvidas comuns sobre o RetornAI</p>
        </div>
      </div>

      {/* Accordion */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden divide-y divide-border">
        {FAQS.map((faq, idx) => {
          const open = openIdx === idx;
          return (
            <div key={idx}>
              <button
                type="button"
                onClick={() => setOpenIdx(open ? null : idx)}
                className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left hover:bg-surface-2 transition-colors"
              >
                <span className="text-sm font-semibold text-ink leading-snug">{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-ink-3 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                />
              </button>
              {open && (
                <div className="px-6 pb-5 pt-1 bg-surface-2 border-t border-border">
                  <p className="text-sm text-ink-3 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-ink-4 text-center">
        Não encontrou o que procurava?{" "}
        <a href="/dashboard/settings/contact" className="text-brand hover:underline font-medium">
          Fale com a gente
        </a>
      </p>
    </div>
  );
}
