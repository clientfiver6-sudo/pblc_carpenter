"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface FAQItem {
  question: string;
  answer: string;
}

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs: FAQItem[] = [
    {
      question: "Como funciona a Inteligência Artificial no WhatsApp?",
      answer: "O RetornAI conecta-se ao número de WhatsApp da sua empresa. A IA é treinada exclusivamente com os dados do seu negócio (preços, serviços, horários, equipe). Ela conversa com os clientes de forma humanizada, tira dúvidas comuns, negocia o melhor horário e realiza o agendamento na sua agenda automaticamente.",
    },
    {
      question: "Eu preciso trocar de número de WhatsApp?",
      answer: "Não! Você pode continuar utilizando o seu número de WhatsApp atual. A conexão é feita de forma simples através da leitura de um QR Code, idêntico ao processo de login do WhatsApp Web.",
    },
    {
      question: "O que acontece se eu quiser falar com o cliente no meio da conversa?",
      answer: "Você tem controle total! Pelo painel de Conversas no dashboard, você acompanha os chats da IA em tempo real. Se você decidir mandar uma mensagem manual para o cliente, o assistente de IA entra em modo de pausa automaticamente naquele contato, permitindo que você assuma.",
    },
    {
      question: "Como funciona a cobrança por Pix?",
      answer: "Integramos com sua conta do Mercado Pago de forma segura. A IA gera e envia a chave Copia e Cola e o QR Code do Pix diretamente no WhatsApp do cliente. Quando o Pix é pago, o RetornAI detecta o recebimento em segundos e marca o serviço como pago na sua agenda, disparando a confirmação.",
    },
    {
      question: "Tem contrato de fidelidade? Como funciona o cancelamento?",
      answer: "Não há fidelidade nem taxas de cancelamento. Você pode cancelar sua assinatura mensal ou anual a qualquer momento diretamente pela tela de configurações do seu painel. Se assinar o plano anual e cancelar, você mantém o acesso até o fim do período já pago.",
    },
  ];

  function toggle(idx: number) {
    setOpenIndex(openIndex === idx ? null : idx);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-3.5">
      {faqs.map((faq, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div
            key={idx}
            className="border border-border/70 rounded-2xl bg-white overflow-hidden transition-all duration-200"
          >
            <button
              onClick={() => toggle(idx)}
              className="w-full px-6 py-4.5 text-left font-bold text-ink text-sm sm:text-base flex items-center justify-between gap-4 focus:outline-none"
            >
              <span>{faq.question}</span>
              <ChevronDown
                className={`w-4.5 h-4.5 text-ink-3 shrink-0 transition-transform duration-200 ${
                  isOpen ? "rotate-180 text-brand" : ""
                }`}
              />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                >
                  <div className="px-6 pb-5 pt-1 text-sm text-ink-2 leading-relaxed border-t border-border/30">
                    {faq.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
