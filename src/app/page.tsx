import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, Sparkles, MessageSquare, Shield, Users, Calendar, Zap } from "lucide-react";
import { Logo } from "@/components/Logo";
import { DashboardMockup } from "@/components/landing/DashboardMockup";
import { InteractiveFeatures } from "@/components/landing/InteractiveFeatures";
import { PricingSection } from "@/components/landing/PricingSection";
import { FAQSection } from "@/components/landing/FAQSection";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: businessUser } = await supabase
      .from("business_users")
      .select("business_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (businessUser) redirect("/dashboard");
  }

  return (
    <div className="text-gray-900 font-sans overflow-x-hidden bg-[#FAFAF8] selection:bg-brand/10 selection:text-brand relative grain min-h-screen">
      
      {/* ─── STICKY HEADER (FLOATING PILL) ─── */}
      <div className="sticky top-4 z-50 w-full px-4 sm:px-6">
        <header className="max-w-6xl mx-auto rounded-2xl glass shadow-md border border-white/20 transition-all duration-300">
          <div className="px-6 py-3.5 flex items-center justify-between">
            <Link href="/" className="hover:opacity-90 transition-opacity">
              <Logo size={26} />
            </Link>
            <nav className="hidden md:flex items-center gap-8">
              <a href="#funcionalidades" className="text-xs font-bold uppercase tracking-wider text-ink-2 hover:text-brand transition-colors">
                Funcionalidades
              </a>
              <a href="#como-funciona" className="text-xs font-bold uppercase tracking-wider text-ink-2 hover:text-brand transition-colors">
                Como funciona
              </a>
              <a href="#precos" className="text-xs font-bold uppercase tracking-wider text-ink-2 hover:text-brand transition-colors">
                Preços
              </a>
              <a href="#faq" className="text-xs font-bold uppercase tracking-wider text-ink-2 hover:text-brand transition-colors">
                FAQ
              </a>
            </nav>
            <div className="flex items-center gap-3">
              <Link href="/login" className="text-sm font-semibold text-ink-2 hover:text-brand px-3 py-2 rounded-lg transition-colors">
                Entrar
              </Link>
              <Link
                href="/register"
                className="text-xs font-bold uppercase tracking-wider text-white px-4 py-2.5 rounded-xl transition-all duration-200 hover:opacity-95 hover:scale-[1.02] shadow-sm hover:shadow-md active:scale-[0.98]"
                style={{ background: "var(--brand-grad)" }}
              >
                Começar grátis
              </Link>
            </div>
          </div>
        </header>
      </div>

      {/* ─── SECTION 1: HERO (LIGHT THEME) ─── */}
      <section className="relative pt-20 pb-28 text-center overflow-hidden bg-[#FAFAF8]">
        {/* Soft background vector shapes */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <svg className="absolute w-full h-[125%] min-h-[900px] top-0 left-0" viewBox="0 0 1440 1000" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <path d="M -50 -100 C 120 -100, 280 -50, 320 150 C 360 350, 140 480, 210 650 C 270 800, 360 850, 300 1050 L -50 1050 Z" fill="#D5C9B8" opacity="0.45" />
            <path d="M -50 -100 C 60 -100, 190 -80, 230 80 C 270 240, 110 350, 160 500 C 210 650, 290 720, 250 880 L -50 880 Z" fill="#DDD2C3" opacity="0.3" />
            <path d="M 1490 -100 C 1280 -100, 1080 50, 1030 250 C 980 450, 1180 600, 1080 800 C 1030 900, 1130 1050, 1180 1150 L 1490 1150 Z" fill="#CEBAA8" opacity="0.4" />
            <path d="M 1490 -100 C 1230 -50, 1160 150, 1130 320 C 1100 490, 1230 580, 1180 750 C 1140 880, 1260 1000, 1300 1100 L 1490 1100 Z" fill="#C87D55" opacity="0.08" />
            <path d="M -100 800 C 100 850, 200 950, 100 1100 L -100 1100 Z" fill="#D5C9B8" opacity="0.25" />
          </svg>
        </div>

        <div className="max-w-4xl mx-auto px-6 space-y-8 relative z-10">
          {/* Micro-badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-tint text-brand border border-brand/10 text-xs font-bold animate-in fade-in slide-in-from-bottom-2 duration-300">
            <span>✨</span> Novo: WhatsApp com IA em todos os planos
          </div>

          {/* Typography */}
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl text-gray-900 leading-[1.05] tracking-tight">
            IA para quem<br />
            <span
              className="shimmer-text bg-gradient-to-r from-brand via-brand-2 to-[#D63E68] bg-clip-text text-transparent font-display"
              style={{ backgroundImage: "linear-gradient(90deg, #F97316, #E85D1F, #D63E68, #E85D1F, #F97316)" }}
            >
              serve, cuida e repara
            </span>
          </h1>

          <p className="text-base sm:text-lg leading-relaxed max-w-xl mx-auto text-ink-2">
            Gestão completa e assistente inteligente no WhatsApp para prestadores de serviços, técnicos e clínicas.
            Aumente seus agendamentos e elimine a burocracia.
          </p>

          {/* Actions */}
          <div className="flex items-center justify-center gap-4 flex-wrap pt-2">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-7 py-4 rounded-xl text-white font-bold text-base shadow-lg transition-all duration-200 hover:opacity-95 hover:scale-[1.02] active:scale-[0.97]"
              style={{ background: "var(--brand-grad)" }}
            >
              Começar agora — Grátis
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex items-center gap-2 px-7 py-4 rounded-xl font-bold text-base border border-border bg-white text-ink hover:border-border-2 hover:bg-surface-2 transition-all duration-150 active:scale-[0.97]"
            >
              Ver como funciona
            </a>
          </div>
        </div>

        {/* Dashboard Mockup Display */}
        <div className="max-w-6xl mx-auto px-6 pt-16 relative z-10">
          <DashboardMockup />
        </div>
      </section>

      {/* ─── DYNAMIC SEGMENTS STRIP (LIGHT THEME) ─── */}
      <div className="relative py-12 overflow-hidden z-10 border-y border-border/40 bg-white/40">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand"></span>
              </span>
              <span className="text-[10px] font-extrabold text-ink-3 uppercase tracking-widest">Negócios que atendemos</span>
            </div>
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-3">
              {[
                { label: "Ar-condicionado", icon: Zap },
                { label: "Clínicas & Médicos", icon: Users },
                { label: "Estética & Beleza", icon: Sparkles },
                { label: "Eletricistas", icon: Zap },
                { label: "Assistência Técnica", icon: Shield },
                { label: "Pet Shops", icon: Sparkles },
                { label: "Consultórios", icon: Calendar }
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold bg-white border border-border/80 text-ink-2 hover:text-brand hover:border-brand/30 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all hover:scale-[1.03] cursor-default">
                    <Icon className="w-3.5 h-3.5 text-brand" />
                    <span>{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ─── SECTION 2: FEATURES (DARK THEME) ─── */}
      <section id="funcionalidades" className="bg-[#181613] text-white py-28 relative overflow-hidden z-10">
        {/* Soft background glows */}
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-brand/10 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-brand-2/10 rounded-full blur-[90px] pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 space-y-16 relative z-10">
          <div className="space-y-4 max-w-xl mx-auto text-center">
            <span className="text-xs font-extrabold uppercase tracking-widest text-brand bg-brand/10 px-3.5 py-1.5 rounded-full border border-brand/20">
              Funcionalidades
            </span>
            <h2 className="font-display text-4xl sm:text-5xl text-white leading-tight">
              Tudo o que seu negócio precisa em um só painel
            </h2>
            <p className="text-gray-400 text-base sm:text-lg font-medium">
              Do primeiro alô no WhatsApp até o recebimento do Pix e a emissão do serviço.
            </p>
          </div>
          <InteractiveFeatures />
        </div>
      </section>

      {/* ─── SECTION 3: HOW IT WORKS (LIGHT THEME) ─── */}
      <section id="como-funciona" className="py-28 relative bg-[#FAFAF8] border-y border-border/60 z-10">
        <div className="max-w-5xl mx-auto px-6 space-y-20">
          <div className="text-center space-y-4">
            <span className="text-xs font-extrabold uppercase tracking-widest text-brand bg-tint px-3.5 py-1.5 rounded-full border border-brand/10">Processo</span>
            <h2 className="font-display text-4xl sm:text-5xl text-gray-900">Seu negócio pronto em 3 passos</h2>
            <p className="text-ink-3 text-base max-w-md mx-auto font-medium">Sem complicações técnicas. Configuração feita em menos de 5 minutos.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Timeline connector dashed line */}
            <div className="hidden md:block absolute top-[52px] left-[15%] right-[15%] h-0.5 border-t-2 border-dashed border-border-2/70 z-0" />
            
            {[
              { step: "01", title: "Crie seu perfil", desc: "Faça o cadastro da sua empresa. A plataforma adapta-se automaticamente ao seu segmento de serviço." },
              { step: "02", title: "Defina seus horários", desc: "Cadastre seus serviços, colaboradores e disponibilidades. O assistente de IA lerá essas regras." },
              { step: "03", title: "Conecte seu WhatsApp", desc: "Leia o QR Code com seu celular. A IA assume os agendamentos e atualiza seu calendário em tempo real." },
            ].map((s) => (
              <div key={s.step} className="group bg-white border border-border/80 rounded-3xl p-8 text-left space-y-4 hover:-translate-y-1.5 hover:shadow-lg transition-all duration-300 relative overflow-hidden z-10 hover:border-brand/20">
                <div className="absolute top-4 right-4 text-7xl font-extrabold select-none opacity-[0.05] group-hover:opacity-[0.10] transition-opacity duration-300 font-display text-brand">
                  {s.step}
                </div>
                <div className="w-12 h-12 rounded-2xl bg-[#FAFAF8] flex items-center justify-center shadow-inner relative z-10 border border-border-2/40">
                  <span className="font-extrabold text-sm text-brand">{s.step}</span>
                </div>
                <h3 className="font-extrabold text-gray-900 text-lg group-hover:text-brand transition-colors relative z-10">{s.title}</h3>
                <p className="text-sm text-ink-2 leading-relaxed font-medium relative z-10">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 4: PRICING (DARK THEME) ─── */}
      <section id="precos" className="bg-[#181613] text-white py-28 relative overflow-hidden z-10">
        {/* Ambient backing glow */}
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-brand/10 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-brand-2/10 rounded-full blur-[90px] pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 py-4 text-center space-y-16 relative z-10">
          <div className="space-y-4 max-w-xl mx-auto">
            <span className="text-xs font-extrabold uppercase tracking-widest text-brand bg-brand/10 px-3.5 py-1.5 rounded-full border border-brand/20">
              Preços simples
            </span>
            <h2 className="font-display text-4xl sm:text-5xl text-white leading-tight">
              Planos sem pegadinhas e com IA inclusa
            </h2>
            <p className="text-gray-400 text-base sm:text-lg font-medium">
              Escolha o melhor plano para o seu estágio de crescimento. Cancele quando quiser.
            </p>
          </div>
          <PricingSection />
        </div>
      </section>

      {/* ─── SECTION 5: FAQ (LIGHT THEME) ─── */}
      <section id="faq" className="bg-[#FAFAF8] border-y border-border/60 py-28 relative z-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
            <div className="space-y-4 text-left lg:sticky lg:top-28">
              <span className="text-xs font-extrabold uppercase tracking-widest text-brand bg-tint px-3.5 py-1.5 rounded-full border border-brand/10">Dúvidas frequentes</span>
              <h2 className="font-display text-4xl text-gray-900 leading-tight">Perguntas Comuns</h2>
              <p className="text-ink-3 text-sm sm:text-base leading-relaxed font-medium">
                Tudo o que você precisa saber sobre o funcionamento do RetornAI. Se não encontrar o que procura, entre em contato conosco.
              </p>
              <div className="pt-2">
                <a href="mailto:contato@retornai.com.br" className="inline-flex items-center gap-2 text-xs font-bold text-brand hover:underline">
                  Enviar um e-mail para o suporte
                  <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            </div>
            <div className="lg:col-span-2">
              <FAQSection />
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 6: FINAL CTA & FOOTER (DARK THEME) ─── */}
      <section className="bg-[#181613] text-white py-24 relative overflow-hidden z-10 border-t border-white/10">
        {/* Ambient backing glow */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-brand/5 rounded-full blur-[120px] pointer-events-none z-0" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-brand-2/5 rounded-full blur-[100px] pointer-events-none z-0" />

        <div className="max-w-5xl mx-auto px-6 space-y-24 relative z-10">
          
          {/* Final CTA Banner */}
          <div className="relative overflow-hidden rounded-3xl py-20 px-8 text-center border border-white/10 shadow-2xl"
            style={{
              background: "radial-gradient(120% 120% at 100% 0%, rgba(232, 93, 31, 0.12) 0%, transparent 65%), linear-gradient(135deg, #221F1B 0%, #1A1815 100%)"
            }}
          >
            <div className="absolute top-[-50%] right-[-20%] w-[500px] h-[500px] bg-brand/5 blur-[80px] pointer-events-none rounded-full" />
            <div className="absolute bottom-[-50%] left-[-20%] w-[500px] h-[500px] bg-brand-2/5 blur-[80px] pointer-events-none rounded-full" />

            <div className="relative z-10 max-w-2xl mx-auto space-y-8">
              <h2 className="font-display text-4xl sm:text-5xl text-white tracking-tight leading-tight">
                Pronto para colocar o atendimento do seu negócio no automático?
              </h2>
              <p className="text-base sm:text-lg text-gray-300 leading-relaxed max-w-lg mx-auto font-medium">
                Junte-se a centenas de prestadores de serviços brasileiros que usam a IA para economizar horas de trabalho todos os dias.
              </p>
              <div className="pt-2">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2.5 px-8 py-4.5 rounded-xl text-white font-bold text-base hover:opacity-95 hover:scale-[1.02] shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98] hover-glow-premium animate-pulse"
                  style={{ background: "var(--brand-grad)" }}
                >
                  Criar minha conta grátis
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>

          {/* About RetornAI inside Footer Area */}
          <div id="sobre" className="max-w-3xl mx-auto text-center space-y-4 pt-4 border-t border-white/5">
            <span className="text-xs font-extrabold uppercase tracking-widest text-brand bg-brand/10 px-3.5 py-1.5 rounded-full border border-brand/20">Nossa história</span>
            <h2 className="font-display text-3xl sm:text-4xl text-white leading-tight">
              Feito por cariocas para o empresário brasileiro
            </h2>
            <p className="text-gray-400 text-base leading-relaxed font-medium">
              O RetornAI nasceu da nossa vivência no Rio de Janeiro. Vimos de perto pequenos prestadores de serviços, assistências técnicas e clínicas médicas perderem clientes e se afogarem em planilhas por falta de tempo. Criamos uma inteligência artificial simples, acessível e focada na nossa realidade comercial.
            </p>
          </div>

          {/* Footer Grid */}
          <footer className="border-t border-white/5 pt-12 flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-gray-500">
            <Link href="/" className="font-bold text-base text-white tracking-tight hover:text-brand transition-colors">
              retorn<span style={{ color: "var(--brand)" }}>.ai</span>
            </Link>
            <div className="flex flex-wrap items-center justify-center gap-6">
              <a href="#sobre" className="hover:text-brand transition-colors">Sobre</a>
              <Link href="/termos" className="hover:text-brand transition-colors">Termos de Uso</Link>
              <Link href="/privacidade" className="hover:text-brand transition-colors">Privacidade</Link>
              <a href="mailto:contato@retornai.com.br" className="hover:text-brand transition-colors">contato@retornai.com.br</a>
            </div>
            <p className="text-gray-600 text-xs">© 2026 RetornAI. Todos os direitos reservados.</p>
          </footer>

        </div>
      </section>

    </div>
  );
}
