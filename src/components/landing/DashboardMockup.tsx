"use client";

import { Calendar, MessageSquare, CreditCard, Users, TrendingUp, Bot, Sparkles } from "lucide-react";

export function DashboardMockup() {
  return (
    <div className="w-full max-w-5xl mx-auto rounded-2xl border border-border/80 bg-white shadow-3 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Browser window header bar */}
      <div className="bg-[#FBF8F3] border-b border-border/80 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-3 h-3 rounded-full bg-red-400/90" />
          <span className="w-3 h-3 rounded-full bg-yellow-400/90" />
          <span className="w-3 h-3 rounded-full bg-green-400/90" />
        </div>
        <div className="h-6 w-80 bg-surface border border-border/40 rounded-md text-[10px] text-ink-4 flex items-center justify-center font-mono">
          app.retorn.ai/dashboard
        </div>
        <div className="w-12 shrink-0" />
      </div>

      {/* Main mockup layout */}
      <div className="grid grid-cols-12 bg-[#FBF8F3] h-[480px] overflow-hidden text-left font-sans">
        
        {/* Left Sidebar */}
        <aside className="col-span-2 bg-white border-r border-border/70 p-3 hidden md:flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <div className="w-6 h-6 rounded-lg bg-brand flex items-center justify-center text-white text-[10px] font-bold">R</div>
              <span className="text-xs font-bold text-ink">retorn.ai</span>
            </div>
            
            <nav className="space-y-1">
              {[
                { label: "Dashboard", icon: TrendingUp, active: true },
                { label: "Agenda", icon: Calendar, active: false },
                { label: "Conversas", icon: MessageSquare, active: false, badge: 2 },
                { label: "Clientes", icon: Users, active: false },
                { label: "Cobranças", icon: CreditCard, active: false },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 px-2 py-2 rounded-lg text-[11px] font-semibold transition-colors ${
                    item.active
                      ? "bg-ink text-white"
                      : "text-ink-3 hover:bg-surface-2 hover:text-ink"
                  }`}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto bg-brand text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                      {item.badge}
                    </span>
                  )}
                </div>
              ))}
            </nav>
          </div>

          <div className="p-2 border border-brand/20 bg-tint/30 rounded-xl space-y-1.5 text-center">
            <div className="text-[9px] font-bold text-brand uppercase tracking-wider">Plano Pro</div>
            <div className="text-[8px] text-ink-3 leading-normal">Inteligência Artificial Ativa</div>
          </div>
        </aside>

        {/* Dashboard Area */}
        <main className="col-span-12 md:col-span-6 p-5 space-y-5 overflow-y-auto">
          {/* Greeting */}
          <div className="space-y-0.5">
            <h4 className="text-base font-bold text-ink flex items-center gap-1.5">
              Olá, Barbearia Don Corleone 👋
            </h4>
            <p className="text-[10.5px] text-ink-3">Aqui está o resumo do seu negócio para hoje.</p>
          </div>

          {/* Cards metrics */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Receita Hoje", value: "R$ 480,00", desc: "+12% vs ontem", color: "text-moss bg-green-50/50" },
              { label: "Agendamentos", value: "14", desc: "4 pendentes", color: "text-brand bg-tint/20" },
              { label: "Conversas IA", value: "32", desc: "100% resolvidas", color: "text-info bg-info/5" },
            ].map((card, idx) => (
              <div key={idx} className={`p-3 rounded-xl border border-border/50 bg-white ${card.color}`}>
                <div className="text-[8px] font-bold text-ink-3 uppercase tracking-wider">{card.label}</div>
                <div className="text-base font-extrabold text-ink mt-1 font-mono tracking-tight">{card.value}</div>
                <div className="text-[8px] text-ink-4 mt-0.5">{card.desc}</div>
              </div>
            ))}
          </div>

          {/* Schedule list */}
          <div className="bg-white border border-border/50 rounded-xl p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="text-xs font-bold text-ink">Agenda de Hoje</span>
              <span className="text-[9px] text-moss font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-moss rounded-full" />
                2 Técnicos em campo
              </span>
            </div>
            
            <div className="space-y-2 text-[10.5px]">
              {[
                { time: "14:00", service: "Corte de Cabelo + Barba", client: "Marcelo Fonseca", status: "Confirmado", color: "border-l-brand" },
                { time: "15:00", service: "Coloração Platinado", client: "Tiago Ramos", status: "Confirmado", color: "border-l-moss" },
                { time: "16:30", service: "Corte Social", client: "Eduardo Rocha", status: "Pendente Pix", color: "border-l-warning" },
              ].map((item, idx) => (
                <div key={idx} className={`p-2 bg-surface-2/50 rounded-lg flex items-center justify-between border-l-2 ${item.color}`}>
                  <div>
                    <span className="font-semibold text-ink">{item.service}</span>
                    <span className="text-ink-3 text-[9px] block">{item.client}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-ink font-bold block">{item.time}</span>
                    <span className="text-[8px] uppercase tracking-wide font-extrabold opacity-75">{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Live WhatsApp chat simulator */}
        <section className="col-span-12 md:col-span-4 bg-teal-950/10 border-l border-border/70 p-4 flex flex-col justify-between h-full relative">
          
          {/* Decorative WhatsApp background indicator */}
          <div className="absolute top-2 right-2 bg-white/70 backdrop-blur-md px-2 py-0.5 rounded-full border border-border/60 text-[8px] font-bold text-brand uppercase tracking-wider flex items-center gap-1 z-20">
            <Bot className="w-2.5 h-2.5" />
            WhatsApp IA Ativo
          </div>

          <div className="w-full bg-white border border-border/60 rounded-2xl shadow-lg overflow-hidden flex flex-col h-[400px] max-w-[270px] mx-auto mt-4 font-sans relative">
            {/* Header */}
            <div className="bg-[#075E54] text-white p-3 flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-teal-800 flex items-center justify-center font-bold text-xs shrink-0">
                AI
              </div>
              <div>
                <div className="font-bold text-[10px]">Assistente Don Corleone</div>
                <div className="text-[8px] opacity-75">Responde na hora</div>
              </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 bg-[#ECE5DD] p-2.5 space-y-2 overflow-y-auto text-[9.5px] flex flex-col justify-end">
              <div className="bg-[#DCF8C6] text-ink rounded-lg rounded-tr-none p-2 max-w-[85%] self-end shadow-sm leading-relaxed">
                Tem horário livre para cabelo e barba hoje à tarde?
              </div>
              
              <div className="bg-white text-ink rounded-lg rounded-tl-none p-2 max-w-[85%] self-start shadow-sm leading-relaxed border border-brand/5">
                Olá! Sim, temos! Temos vagas com o barbeiro <strong>Enzo</strong> às <strong>14:00</strong> ou às <strong>17:30</strong>. Qual prefere?
              </div>

              <div className="bg-[#DCF8C6] text-ink rounded-lg rounded-tr-none p-2 max-w-[85%] self-end shadow-sm leading-relaxed">
                Pode ser às 14:00.
              </div>

              <div className="bg-white text-ink rounded-lg rounded-tl-none p-2 max-w-[85%] self-start shadow-sm leading-relaxed border border-brand/5 flex items-start gap-1">
                <span className="text-[10px] text-brand shrink-0">✦</span>
                <div>
                  Perfeito! Agendado para hoje às 14h. Vou te enviar o link do Pix para confirmação.
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
