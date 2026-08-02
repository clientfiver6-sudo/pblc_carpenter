"use client";

import { useState } from "react";
import { MessageSquare, Calendar, CreditCard, Users, Check, Bot } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

type TabId = "whatsapp" | "calendar" | "payments" | "team";

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

export function InteractiveFeatures() {
  const [activeTab, setActiveTab] = useState<TabId>("whatsapp");

  const tabs: TabConfig[] = [
    {
      id: "whatsapp",
      label: "WhatsApp com IA",
      icon: MessageSquare,
      description: "Atendimento 24/7 automático no seu número. A IA atende, negocia e agenda sozinha.",
    },
    {
      id: "calendar",
      label: "Agenda Inteligente",
      icon: Calendar,
      description: "Calendário sincronizado com profissionais, serviços e horários em tempo real.",
    },
    {
      id: "payments",
      label: "Cobranças Pix",
      icon: CreditCard,
      description: "Geração de Pix automática por WhatsApp e conciliação instantânea.",
    },
    {
      id: "team",
      label: "Gestão de Equipe",
      icon: Users,
      description: "Distribua ordens de serviço, controle rotas e acompanhe a produtividade.",
    },
  ];

  return (
    <div className="space-y-12">
      {/* Tabs list */}
      <div className="flex flex-wrap justify-center gap-2 max-w-3xl mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-white text-brand border border-brand/20 shadow-md scale-[1.02]"
                  : "bg-surface/50 text-ink-3 hover:bg-surface hover:text-ink border border-transparent"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-brand" : "text-ink-4"}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Showcase area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white border border-border/60 rounded-3xl p-6 sm:p-10 shadow-2 relative overflow-hidden">
        {/* Subtle decorative grid background */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: "radial-gradient(#181613 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
        
        {/* Text column */}
        <div className="lg:col-span-5 space-y-6 relative z-10">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-tint text-brand uppercase tracking-wider">
            {tabs.find((t) => t.id === activeTab)?.label}
          </span>
          <h3 className="text-3xl font-bold text-ink leading-tight">
            {activeTab === "whatsapp" && "Atendimento instantâneo no piloto automático"}
            {activeTab === "calendar" && "Seu calendário organizado sem conflitos"}
            {activeTab === "payments" && "Receba com Pix de forma 100% automatizada"}
            {activeTab === "team" && "Toda a sua equipe na mesma página"}
          </h3>
          <p className="text-ink-2 text-base leading-relaxed">
            {tabs.find((t) => t.id === activeTab)?.description}
          </p>

          <ul className="space-y-2.5 text-sm text-ink-3">
            {activeTab === "whatsapp" && (
              <>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-moss shrink-0" /> Responde dúvidas frequentes em segundos</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-moss shrink-0" /> Agenda no calendário e envia lembrete</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-moss shrink-0" /> Transborda para atendente humano se precisar</li>
              </>
            )}
            {activeTab === "calendar" && (
              <>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-moss shrink-0" /> Evita marcação em horários duplicados</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-moss shrink-0" /> Visualização por dia, semana ou profissional</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-moss shrink-0" /> Atualização instantânea com drag and drop</li>
              </>
            )}
            {activeTab === "payments" && (
              <>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-moss shrink-0" /> Link de pagamento enviado direto no WhatsApp</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-moss shrink-0" /> Confirmação imediata do Mercado Pago</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-moss shrink-0" /> Sem taxas de adesão, pague apenas por Pix liquidado</li>
              </>
            )}
            {activeTab === "team" && (
              <>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-moss shrink-0" /> Distribua chamados por WhatsApp automaticamente</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-moss shrink-0" /> Painel simples para o profissional de campo</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-moss shrink-0" /> Histórico de serviços por colaborador</li>
              </>
            )}
          </ul>
        </div>

        {/* Visual Mockup column */}
        <div className="lg:col-span-7 bg-[#FBF8F3] border border-border/80 rounded-2xl p-5 shadow-inner h-[380px] overflow-hidden flex flex-col justify-center relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full h-full flex items-center justify-center"
            >
              {activeTab === "whatsapp" && (
                <div className="w-[320px] bg-white border border-border/60 rounded-3xl shadow-3 overflow-hidden font-sans flex flex-col h-[340px]">
                  {/* WhatsApp header */}
                  <div className="bg-[#075E54] text-white p-3.5 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-teal-800 flex items-center justify-center font-bold text-sm shrink-0">
                      R
                    </div>
                    <div>
                      <div className="font-bold text-xs">RetornAI Assistant</div>
                      <div className="text-[9px] opacity-80 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                        online
                      </div>
                    </div>
                  </div>

                  {/* Messages container */}
                  <div className="flex-1 bg-[#ECE5DD] p-3 space-y-3 overflow-y-auto text-[11px] flex flex-col justify-end">
                    <div className="bg-white text-ink rounded-lg rounded-tl-none p-2 max-w-[85%] self-start shadow-sm leading-normal">
                      Olá! Como posso ajudar você hoje? 😊
                    </div>
                    <div className="bg-[#DCF8C6] text-ink rounded-lg rounded-tr-none p-2 max-w-[85%] self-end shadow-sm leading-normal">
                      Gostaria de agendar uma limpeza de ar-condicionado para amanhã às 14h, por favor.
                    </div>
                    <div className="bg-white text-ink rounded-lg rounded-tl-none p-2.5 max-w-[85%] self-start shadow-sm leading-normal flex items-start gap-1.5 border border-brand/10">
                      <div className="w-4 h-4 rounded-full bg-tint flex items-center justify-center text-brand text-[9px] shrink-0 mt-0.5"><Bot className="w-2.5 h-2.5" /></div>
                      <div>
                        Claro! Verifiquei que nosso técnico <strong>João Silva</strong> está disponível às 14:00. Posso confirmar seu agendamento?
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "calendar" && (
                <div className="w-full max-w-[420px] bg-white border border-border/60 rounded-2xl shadow-3 overflow-hidden flex flex-col h-[320px]">
                  {/* Calendar header */}
                  <div className="border-b border-border/60 p-3 flex items-center justify-between">
                    <span className="text-xs font-bold text-ink">Agenda - Amanhã</span>
                    <span className="text-[10px] font-medium text-brand bg-tint px-2 py-0.5 rounded-full">3 Serviços</span>
                  </div>
                  {/* Calendar grid */}
                  <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">
                    {[
                      { time: "09:00 - 11:00", service: "Limpeza de Split", client: "Eduardo Santos", provider: "João Silva", status: "Confirmado", color: "bg-brand/10 border-brand/20 text-brand" },
                      { time: "11:30 - 13:00", service: "Manutenção Preventiva", client: "Clínica Bem Estar", provider: "Carlos Souza", status: "Confirmado", color: "bg-info/10 border-info/20 text-info" },
                      { time: "14:00 - 16:00", service: "Instalação 12000 BTUs", client: "Mariana Costa", provider: "João Silva", status: "Pendente Pix", color: "bg-warning/10 border-warning/20 text-warning" },
                    ].map((item, idx) => (
                      <div key={idx} className={`p-2.5 rounded-xl border flex items-center justify-between text-left text-xs ${item.color}`}>
                        <div>
                          <div className="font-bold">{item.service}</div>
                          <div className="text-[10px] opacity-95 mt-0.5">{item.client} · {item.provider}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono text-[10px] block font-semibold">{item.time}</span>
                          <span className="text-[9px] opacity-80 uppercase tracking-wide font-bold">{item.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "payments" && (
                <div className="w-[300px] bg-white border border-border/60 rounded-2xl shadow-3 p-4 space-y-4">
                  <div className="text-center">
                    <span className="w-10 h-10 rounded-full bg-green-50 text-moss flex items-center justify-center mx-auto mb-2"><Check className="w-5 h-5" /></span>
                    <h4 className="text-sm font-bold text-ink">Cobrança Gerada e Enviada</h4>
                    <p className="text-[10.5px] text-ink-3">Pix enviado automático no WhatsApp</p>
                  </div>
                  <div className="bg-[#FBF8F3] border border-border/60 rounded-xl p-3 space-y-2.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-ink-3">Cliente</span>
                      <span className="font-semibold text-ink">Eduardo Santos</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-ink-3">Serviço</span>
                      <span className="font-semibold text-ink">Limpeza de Split</span>
                    </div>
                    <div className="border-t border-border/60 my-1 pt-1.5 flex justify-between text-xs">
                      <span className="font-bold text-ink">Valor</span>
                      <span className="font-bold text-brand">R$ 150,00</span>
                    </div>
                  </div>
                  <div className="w-full py-2 rounded-xl text-center font-bold text-xs bg-[#00A389] text-white flex items-center justify-center gap-1.5">
                    <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                    Aguardando PIX...
                  </div>
                </div>
              )}

              {activeTab === "team" && (
                <div className="w-full max-w-[380px] bg-white border border-border/60 rounded-2xl shadow-3 overflow-hidden">
                  <div className="border-b border-border/60 p-3 flex justify-between items-center bg-surface">
                    <span className="text-xs font-bold text-ink">Minha Equipe</span>
                    <span className="text-[10px] text-ink-3">Painel em Tempo Real</span>
                  </div>
                  <div className="p-3 divide-y divide-border/60 space-y-2.5">
                    {[
                      { name: "João Silva", role: "Técnico de Climatização", status: "Em campo", color: "bg-brand text-white" },
                      { name: "Carlos Souza", role: "Instalador Sênior", status: "Disponível", color: "bg-moss text-white" },
                      { name: "Ana Beatriz", role: "Supervisora Técnica", status: "Indisponível", color: "bg-danger/10 text-danger border-danger/25 border" },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between pt-2.5 first:pt-0">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-xs font-semibold text-ink">
                            {item.name.substring(0, 2)}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-ink">{item.name}</div>
                            <div className="text-[10px] text-ink-3">{item.role}</div>
                          </div>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${item.color}`}>
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
