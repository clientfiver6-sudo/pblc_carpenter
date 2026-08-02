import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
    <div className="text-gray-900 font-sans overflow-x-hidden bg-[#F1ECE4] selection:bg-brand/10 selection:text-brand">

      {/* ─── STICKY HEADER ─── */}
      <header className="sticky top-0 z-50 w-full glass-subtle transition-all duration-300">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <Logo size={28} />
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#funcionalidades" className="text-sm font-medium text-ink-2 hover:text-ink transition-colors">
              Funcionalidades
            </a>
            <a href="#como-funciona" className="text-sm font-medium text-ink-2 hover:text-ink transition-colors">
              Como funciona
            </a>
            <a href="#precos" className="text-sm font-medium text-ink-2 hover:text-ink transition-colors">
              Preços
            </a>
            <a href="#faq" className="text-sm font-medium text-ink-2 hover:text-ink transition-colors">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-ink-2 hover:text-ink px-3 py-2 rounded-lg transition-colors">
              Entrar
            </Link>
            <Link
              href="/register"
              className="text-sm font-semibold text-white px-4 py-2 rounded-xl transition-all duration-200 hover:opacity-90 hover:scale-[1.02] shadow-sm active:scale-[0.98]"
              style={{ background: "var(--brand-grad)" }}
            >
              Começar grátis
            </Link>
          </div>
        </div>
      </header>

      {/* ─── HERO SECTION ─── */}
      <section className="relative pt-12 pb-24 text-center overflow-hidden">
        {/* Mockup-accurate organic fluid vector background shapes */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <svg className="absolute w-full h-[125%] min-h-[900px] top-0 left-0" viewBox="0 0 1440 1000" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            {/* Left wavy organic shape (darker sand) */}
            <path d="M -50 -100 
                     C 120 -100, 280 -50, 320 150 
                     C 360 350, 140 480, 210 650 
                     C 270 800, 360 850, 300 1050
                     L -50 1050 Z" fill="#C5B4A2" opacity="0.8" />
                     
            <path d="M -50 -100 
                     C 60 -100, 190 -80, 230 80 
                     C 270 240, 110 350, 160 500 
                     C 210 650, 290 720, 250 880
                     L -50 880 Z" fill="#D3C3B1" opacity="0.5" />

            {/* Top Right large smooth wave (soft brown-terracotta) */}
            <path d="M 1490 -100 
                     C 1280 -100, 1080 50, 1030 250 
                     C 980 450, 1180 600, 1080 800 
                     C 1030 900, 1130 1050, 1180 1150
                     L 1490 1150 Z" fill="#BFA692" opacity="0.75" />
                     
            <path d="M 1490 -100 
                     C 1230 -50, 1160 150, 1130 320 
                     C 1100 490, 1230 580, 1180 750 
                     C 1140 880, 1260 1000, 1300 1100
                     L 1490 1100 Z" fill="#C87D55" opacity="0.15" />

            {/* Bottom Left soft highlight */}
            <path d="M -100 800 C 100 850, 200 950, 100 1100 L -100 1100 Z" fill="#C5B4A2" opacity="0.4" />
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

          <p className="text-base sm:text-lg leading-relaxed max-w-xl mx-auto text-ink-3">
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

      {/* ─── TRUST STRIP ─── */}
      <div className="relative py-10 overflow-hidden">
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-white/45 backdrop-blur-md border border-border/60 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
            <div className="flex items-center gap-2.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
              <span className="text-[10px] font-extrabold text-ink-3 uppercase tracking-widest">Ideal para negócios de</span>
            </div>
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-2.5">
              {["Ar-condicionado", "Clínicas & Médicos", "Estética & Beleza", "Eletricistas", "Assistência Técnica", "Pet Shops", "Consultórios"].map((s) => (
                <span key={s} className="px-3.5 py-1.5 rounded-2xl text-xs font-bold bg-white border border-border/80 text-ink-2 hover:text-brand hover:border-brand/30 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all hover:scale-[1.03] cursor-default">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── DYNAMIC FEATURES SECTION ─── */}
      <section id="funcionalidades" className="max-w-6xl mx-auto px-6 py-28 text-center space-y-16">
        <div className="space-y-4 max-w-xl mx-auto">
          <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: "var(--brand)" }}>Funcionalidades</p>
          <h2 className="font-display text-4xl sm:text-5xl text-gray-900 leading-tight">
            Tudo o que seu negócio precisa em um só painel
          </h2>
          <p className="text-ink-3 text-base sm:text-lg">
            Do primeiro alô no WhatsApp até o recebimento do Pix e a emissão do serviço.
          </p>
        </div>
        <InteractiveFeatures />
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="como-funciona" className="py-28 relative bg-[#FBF8F3] border-y border-[#ECE5D8]/60">
        <div className="max-w-5xl mx-auto px-6 space-y-16">
          <div className="text-center space-y-4">
            <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: "var(--brand)" }}>Fácil e rápido</p>
            <h2 className="font-display text-4xl sm:text-5xl text-gray-900">Seu negócio pronto em 3 passos</h2>
            <p className="text-ink-3 text-base max-w-md mx-auto">Sem complicações técnicas. Configuração feita em menos de 5 minutos.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Crie seu perfil", desc: "Faça o cadastro da sua empresa. A plataforma adapta-se automaticamente ao seu segmento de serviço." },
              { step: "02", title: "Defina seus horários", desc: "Cadastre seus serviços, colaboradores e disponibilidades. O assistente de IA lerá essas regras." },
              { step: "03", title: "Conecte seu WhatsApp", desc: "Leia o QR Code com seu celular. A IA assume os agendamentos e atualiza seu calendário em tempo real." },
            ].map((s) => (
              <div key={s.step} className="group bg-white border border-border/85 rounded-2xl p-7 text-left space-y-4 hover:-translate-y-1.5 hover:shadow-md transition-all duration-300 relative overflow-hidden">
                <div className="absolute top-4 right-4 text-7xl font-extrabold select-none opacity-[0.06] group-hover:opacity-[0.12] transition-opacity duration-300 font-display text-brand">
                  {s.step}
                </div>
                <div className="w-10 h-10 rounded-xl bg-tint flex items-center justify-center shadow-inner">
                  <span className="font-extrabold text-sm text-brand">{s.step}</span>
                </div>
                <h3 className="font-extrabold text-gray-900 text-lg group-hover:text-brand transition-colors">{s.title}</h3>
                <p className="text-sm text-ink-3 leading-relaxed font-medium">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="precos" className="max-w-6xl mx-auto px-6 py-28 text-center space-y-16">
        <div className="space-y-4 max-w-xl mx-auto">
          <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: "var(--brand)" }}>Preços simples</p>
          <h2 className="font-display text-4xl sm:text-5xl text-gray-900 leading-tight">
            Planos sem pegadinhas e com IA inclusa
          </h2>
          <p className="text-ink-3 text-base sm:text-lg">
            Escolha o melhor plano para o seu estágio de crescimento. Cancele quando quiser.
          </p>
        </div>
        <PricingSection />
      </section>

      {/* ─── FAQ SECTION ─── */}
      <section id="faq" className="bg-[#FBF8F3] border-y border-[#ECE5D8]/60 py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
            <div className="space-y-4 text-left lg:sticky lg:top-24">
              <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: "var(--brand)" }}>Dúvidas frequentes</p>
              <h2 className="font-display text-4xl text-gray-900 leading-tight">Perguntas Comuns</h2>
              <p className="text-ink-3 text-sm sm:text-base leading-relaxed">
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

      {/* ─── FINAL CTA ─── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="relative overflow-hidden rounded-3xl py-20 px-8 text-center border border-[#F2D9C2]/60 shadow-lg"
          style={{
            background: "radial-gradient(120% 120% at 100% 0%, #FFE7D6 0%, transparent 65%), linear-gradient(135deg, #FFF7EF 0%, #FFF1E5 100%)"
          }}
        >
          <div className="absolute top-[-50%] right-[-20%] w-[500px] h-[500px] bg-brand/5 blur-[80px] pointer-events-none rounded-full" />
          <div className="absolute bottom-[-50%] left-[-20%] w-[500px] h-[500px] bg-brand-2/5 blur-[80px] pointer-events-none rounded-full" />

          <div className="relative z-10 max-w-2xl mx-auto space-y-8">
            <h2 className="font-display text-4xl sm:text-5xl text-gray-900 tracking-tight leading-tight">
              Pronto para colocar o atendimento do seu negócio no automático?
            </h2>
            <p className="text-base sm:text-lg text-ink-3 leading-relaxed max-w-lg mx-auto font-medium">
              Junte-se a centenas de prestadores de serviços brasileiros que usam a IA para economizar horas de trabalho todos os dias.
            </p>
            <div className="pt-2">
              <Link
                href="/register"
                className="inline-flex items-center gap-2.5 px-8 py-4.5 rounded-xl text-white font-bold text-base hover:opacity-95 hover:scale-[1.02] shadow-md transition-all duration-200 active:scale-[0.98] hover-glow-premium"
                style={{ background: "var(--brand-grad)" }}
              >
                Criar minha conta grátis
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── ABOUT SECTION ─── */}
      <section id="sobre" className="py-20 bg-[#FBF8F3] border-t border-[#ECE5D8]">
        <div className="max-w-2xl mx-auto px-6 text-center space-y-4">
          <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: "var(--brand)" }}>Nossa história</p>
          <h2 className="font-display text-3xl sm:text-4xl text-gray-900 leading-tight">
            Feito por cariocas para o empresário brasileiro
          </h2>
          <p className="text-ink-2 text-base leading-relaxed">
            O RetornAI nasceu da nossa vivência no Rio de Janeiro. Vimos de perto pequenos prestadores de serviços, assistências técnicas e clínicas médicas perderem clientes e se afogarem em planilhas por falta de tempo. Criamos uma inteligência artificial simples, acessível e focada na nossa realidade comercial.
          </p>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="bg-[#FBF8F3] border-t border-[#ECE5D8] py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-ink-3">
          <Link href="/" className="font-bold text-base text-gray-900 tracking-tight">
            retorn<span style={{ color: "var(--brand)" }}>.ai</span>
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <a href="#sobre" className="hover:text-gray-900 transition-colors">Sobre</a>
            <Link href="/termos" className="hover:text-gray-900 transition-colors">Termos de Uso</Link>
            <Link href="/privacidade" className="hover:text-gray-900 transition-colors">Privacidade</Link>
            <a href="mailto:contato@retornai.com.br" className="hover:text-gray-900 transition-colors">contato@retornai.com.br</a>
          </div>
          <p className="text-gray-400">© 2026 RetornAI. Todos os direitos reservados.</p>
        </div>
      </footer>

    </div>
  );
}
