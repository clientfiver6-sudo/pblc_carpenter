import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  MessageSquare,
  CalendarDays,
  ClipboardList,
  Wrench,
  BarChart3,
  Check,
  ArrowRight,
  Bot,
  Stethoscope,
} from "lucide-react";
import { Logo } from "@/components/Logo";

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
    <div className="text-gray-900 font-sans overflow-x-hidden">

      {/* ─── HERO ─── */}
      <div className="relative overflow-hidden bg-[#FFFAF6]">
        <div className="absolute top-0 right-0 pointer-events-none w-[700px] h-[700px]"
          style={{ background: "radial-gradient(ellipse at top right, rgba(232,93,31,0.10) 0%, transparent 65%)" }}
        />
        <div className="absolute bottom-0 left-0 pointer-events-none w-[500px] h-[500px]"
          style={{ background: "radial-gradient(ellipse at bottom left, rgba(249,115,22,0.07) 0%, transparent 65%)" }}
        />

        {/* Nav */}
        <nav className="relative z-10 max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/"><Logo size={28} /></Link>
          <div className="flex items-center gap-3">
            <a href="#sobre" className="text-sm text-gray-500 hover:text-gray-800 px-3 py-2 rounded-lg transition-colors hidden sm:block">
              Sobre
            </a>
            <Link href="/login" className="text-sm text-gray-500 hover:text-gray-800 px-3 py-2 rounded-lg transition-colors">
              Entrar
            </Link>
            <Link
              href="/register"
              className="text-sm font-semibold text-white px-4 py-2 rounded-lg transition-opacity duration-150 hover:opacity-90"
              style={{ background: "var(--brand-grad)" }}
            >
              Começar grátis
            </Link>
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 pt-14 pb-32 text-center stagger">
          <h1 className="font-display text-6xl sm:text-7xl lg:text-[82px] text-gray-900 leading-[1.03] mb-6">
            IA para quem<br />
            <span
              className="shimmer-text"
              style={{ backgroundImage: "linear-gradient(90deg, #F97316, #E85D1F, #F9A66C, #E85D1F, #F97316)" }}
            >
              serve, cuida
            </span>
            <br />e repara
          </h1>

          <p className="text-lg sm:text-xl leading-relaxed max-w-xl mx-auto mb-10 text-gray-500">
            Gestão completa + atendimento automático no WhatsApp para serviços de campo e clínicas de saúde.
            Mais atendimentos, menos planilha.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-white font-semibold text-base transition-[transform,opacity] duration-150 ease-brand-out hover:opacity-90 hover:scale-[1.02] active:scale-[0.97]"
              style={{ background: "var(--brand-grad)" }}
            >
              Começar agora — grátis
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-base border border-gray-200 text-gray-600 bg-white transition-[background-color,border-color] duration-150 hover:border-gray-300 hover:bg-gray-50"
            >
              Ver como funciona
            </a>
          </div>
        </div>
      </div>

      {/* ─── Social Proof Strip ─── */}
      <div className="bg-[#FBF8F3] border-y border-[#ECE5D8] py-5">
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-widest shrink-0">Usado por</span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {["Ar-condicionado", "Elétrica", "Dedetização", "Hidráulica", "Refrigeração", "Limpeza", "Clínicas", "Consultórios"].map((s) => (
              <span key={s} className="px-3 py-1 rounded-full text-xs font-medium bg-white border border-[#ECE5D8] text-gray-600 shadow-sm">
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Features Grid ─── */}
      <section id="funcionalidades" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "var(--brand)" }}>Funcionalidades</p>
          <h2 className="font-display text-4xl sm:text-5xl text-gray-900 mb-4 leading-tight">
            Tudo que você precisa,<br />em um só lugar
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Do primeiro contato no WhatsApp até a emissão do contrato de manutenção.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger">
          {[
            { icon: Bot,           title: "Assistente IA 24/7",    desc: "IA treinada no seu negócio — agenda, responde dúvidas, envia cobranças e faz follow-up no WhatsApp enquanto você trabalha.",  accent: "#E85D1F", bg: "#FFF1E8" },
            { icon: MessageSquare, title: "WhatsApp com IA",       desc: "Atendimento automático no número da sua empresa. Conversas organizadas, contexto completo, resposta instantânea.",        accent: "#16A34A", bg: "#F0FDF4" },
            { icon: CalendarDays,  title: "Agenda Inteligente",    desc: "Chamados e consultas organizados por profissional, data e status. Confirmações automáticas e lembretes para o cliente.",  accent: "#2E6BAA", bg: "#EFF6FF" },
            { icon: ClipboardList, title: "Gestão de Equipe",      desc: "Distribua atendimentos por profissional, acompanhe produtividade e mantenha toda a equipe alinhada em tempo real.",      accent: "#7C3AED", bg: "#F5F3FF" },
            { icon: Stethoscope,   title: "Prontuário Médico",     desc: "Anamnese, prescrições, laudos e exames — tudo em um só lugar. Prontuário eletrônico completo para clínicas. (Medical)",   accent: "#0F766E", bg: "#F0FDFA" },
            { icon: BarChart3,     title: "Analytics Completo",    desc: "Receita por período, taxa de conversão, clientes que mais gastam, tendências — tudo em dashboards claros. (Pro)",        accent: "#4338CA", bg: "#EEF2FF" },
          ].map((f) => (
            <div
              key={f.title}
              className="group bg-white border border-gray-100 rounded-2xl p-6 hover:border-gray-200 hover:shadow-lg hover:-translate-y-1 transition-[transform,box-shadow,border-color] duration-200 ease-brand-out cursor-default"
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-transform duration-200 group-hover:scale-110"
                style={{ background: f.bg }}
              >
                <f.icon className="w-5 h-5" style={{ color: f.accent }} />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="como-funciona" className="py-24 relative" style={{ background: "#FBF8F3" }}>
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "var(--brand)" }}>Como funciona</p>
            <h2 className="font-display text-4xl sm:text-5xl text-gray-900 mb-4">Pronto em 3 passos</h2>
            <p className="text-gray-500 text-lg">Sem instalação, sem técnico de TI, sem complicação.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 stagger">
            {[
              { step: "01", title: "Cadastre seu negócio",       desc: "Crie sua conta em 2 minutos. Defina o tipo de serviço e o RetornAI configura tudo automaticamente." },
              { step: "02", title: "Configure seu negócio",      desc: "Adicione seus serviços, horários de atendimento e equipe. A plataforma adapta tudo à sua realidade." },
              { step: "03", title: "Clientes entram, IA resolve", desc: "Agendamentos, orçamentos, cobranças e follow-up — a IA cuida de tudo. Você foca no serviço." },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div
                  className="font-display text-6xl font-bold mb-5 leading-none"
                  style={{
                    background: "linear-gradient(135deg, #E85D1F, #F9A66C)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {s.step}
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-lg">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="precos" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "var(--brand)" }}>Preços</p>
          <h2 className="font-display text-4xl sm:text-5xl text-gray-900 mb-4">Simples e sem surpresas</h2>
          <p className="text-gray-500 text-lg">WhatsApp com IA incluso em todos os planos.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

          {/* Starter */}
          <div className="bg-white border border-gray-200 rounded-2xl p-8">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Starter</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="font-display text-5xl text-gray-900">R$149,90</span>
              <span className="text-sm text-gray-400 mb-2">/mês</span>
            </div>
            <p className="text-sm text-gray-500 mb-7">Para quem está começando</p>
            <ul className="space-y-3 mb-8">
              {["Clientes e CRM", "Agenda e chamados", "WhatsApp com IA", "Pagamentos e cobranças", "Automações"].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                  <Check className="w-4 h-4 text-green-500 shrink-0" />{f}
                </li>
              ))}
            </ul>
            <Link href="/register" className="block text-center py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 hover:border-gray-300 active:scale-[0.97] transition-[background-color,border-color,transform] duration-150">
              Começar com Starter
            </Link>
          </div>

          {/* Pro */}
          <div
            className="rounded-2xl p-8 relative border-2"
            style={{ background: "linear-gradient(145deg, #FFF1E8 0%, #FFE8D6 100%)", borderColor: "rgba(232,93,31,0.30)" }}
          >
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="text-xs font-bold px-4 py-1.5 rounded-full text-white uppercase tracking-wide"
                style={{ background: "var(--brand-grad)" }}>
                Mais popular
              </span>
            </div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--brand)" }}>Pro</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="font-display text-5xl text-gray-900">R$199,90</span>
              <span className="text-sm text-gray-500 mb-2">/mês</span>
            </div>
            <p className="text-sm text-gray-500 mb-7">Para negócios em crescimento</p>
            <ul className="space-y-3 mb-8">
              {["Tudo do Starter", "Instruções de Time", "Analytics completo", "Gráficos com IA", "Aprovações da IA", "Assistente RetornAI"].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-gray-700">
                  <Check className="w-4 h-4 shrink-0" style={{ color: "var(--brand)" }} />{f}
                </li>
              ))}
            </ul>
            <Link href="/register" className="block text-center py-3 rounded-xl text-white font-semibold text-sm transition-[opacity,transform] duration-150 ease-brand-out hover:opacity-90 active:scale-[0.97]"
              style={{ background: "var(--brand-grad)" }}>
              Começar com Pro
            </Link>
          </div>

          {/* Medical */}
          <div className="bg-white border border-gray-200 rounded-2xl p-8 relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="text-xs font-bold px-4 py-1.5 rounded-full text-white uppercase tracking-wide bg-[#0F766E]">
                Saúde
              </span>
            </div>
            <p className="text-xs font-bold text-[#0F766E] uppercase tracking-widest mb-3">Medical</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="font-display text-5xl text-gray-900">R$249,90</span>
              <span className="text-sm text-gray-400 mb-2">/mês</span>
            </div>
            <p className="text-sm text-gray-500 mb-7">Para clínicas e consultórios</p>
            <ul className="space-y-3 mb-8">
              {["Tudo do Pro", "Prontuário eletrônico", "Anamnese digital", "Prescrições", "Laudos e exames"].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                  <Check className="w-4 h-4 text-[#0F766E] shrink-0" />{f}
                </li>
              ))}
            </ul>
            <Link href="/register" className="block text-center py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 hover:border-gray-300 active:scale-[0.97] transition-[background-color,border-color,transform] duration-150">
              Começar com Medical
            </Link>
          </div>

        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="relative overflow-hidden py-24 text-center" style={{ background: "#FFF1E8" }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none w-[800px] h-[400px]"
          style={{ background: "radial-gradient(ellipse at top, rgba(232,93,31,0.12) 0%, transparent 65%)" }}
        />
        <div className="relative z-10 max-w-2xl mx-auto px-6">
          <h2 className="font-display text-4xl sm:text-5xl text-gray-900 mb-5">Pronto para crescer?</h2>
          <p className="text-lg text-gray-500 mb-10 leading-relaxed">
            Feito para o prestador de serviço brasileiro que quer crescer com inteligência.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-bold text-base hover:opacity-90 transition-opacity"
            style={{ background: "var(--brand-grad)" }}
          >
            Criar conta grátis
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ─── About ─── */}
      <section id="sobre" className="py-20 bg-[#FBF8F3] border-t border-[#ECE5D8]">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "var(--brand)" }}>Sobre nós</p>
          <h2 className="font-display text-3xl sm:text-4xl text-gray-900 mb-5 leading-tight">
            Feito por quem entende o Brasil de verdade
          </h2>
          <p className="text-gray-500 text-lg leading-relaxed">
            O RetornAI foi criado por dois estudantes cariocas que viram de perto como os prestadores de serviço ficavam para trás — sem tempo, sem ferramenta, sem uma IA que falasse a língua deles. A gente resolveu mudar isso.
          </p>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="bg-[#FBF8F3] border-t border-[#ECE5D8] py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <Link href="/" className="font-bold text-base text-gray-900 tracking-tight">
            retorn<span style={{ color: "var(--brand)" }}>.ai</span>
          </Link>
          <div className="flex items-center gap-6">
            <a href="#sobre" className="hover:text-gray-900 transition-colors">Sobre</a>
            <Link href="/termos" className="hover:text-gray-900 transition-colors">Termos de Uso</Link>
            <Link href="/privacidade" className="hover:text-gray-900 transition-colors">Privacidade</Link>
            <a href="mailto:contato@retornai.com.br" className="hover:text-gray-900 transition-colors">contato@retornai.com.br</a>
          </div>
          <p className="text-gray-400">© 2026 RetornAI</p>
        </div>
      </footer>

    </div>
  );
}
