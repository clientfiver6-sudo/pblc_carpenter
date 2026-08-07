"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import Link from "next/link";

export function PricingSection() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

  const plans = [
    {
      name: "Starter",
      description: "Para quem está começando a digitalizar",
      priceMonthly: 20.00,
      priceYearly: 16.00,
      features: [
        "Clientes e CRM",
        "Agenda e chamados",
        "WhatsApp com IA",
        "Pagamentos e cobranças",
        "Automações",
      ],
      ctaText: "Começar com Starter",
      popular: false,
      color: "border-border bg-white hover:border-brand/30 hover:scale-[1.02] hover:shadow-xl relative duration-300 ease-out",
      badge: null,
    },
    {
      name: "Pro",
      description: "Para negócios em franco crescimento",
      priceMonthly: 50.00,
      priceYearly: 40.00,
      features: [
        "Tudo do Starter",
        "Instruções de Time",
        "Analytics completo",
        "Gráficos com IA",
        "Aprovações da IA",
        "Assistente RetornAI",
      ],
      ctaText: "Começar com Pro",
      popular: true,
      color: "border-brand bg-white border-2 scale-[1.02] hover:scale-[1.05] shadow-xl hover:shadow-2xl relative duration-300 ease-out",
      badge: "Mais Popular",
    },
    {
      name: "Medical",
      description: "Para clínicas, consultórios e médicos",
      priceMonthly: 100.00,
      priceYearly: 80.00,
      features: [
        "Tudo do Pro",
        "Prontuário eletrônico",
        "Anamnese digital",
        "Prescrições",
        "Laudos e exames",
      ],
      ctaText: "Começar com Medical",
      popular: false,
      color: "border-border bg-white hover:border-[#0F766E]/30 hover:scale-[1.02] hover:shadow-xl relative duration-300 ease-out",
      badge: "Saúde",
    },
  ];

  function fmtBRL(value: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }

  return (
    <div className="space-y-12">
      {/* Toggle */}
      <div className="flex items-center justify-center gap-3">
        <span className={`text-sm font-semibold transition-colors ${billingPeriod === "monthly" ? "text-white" : "text-white/50"}`}>
          Mensal
        </span>
        <button
          onClick={() => setBillingPeriod(billingPeriod === "monthly" ? "yearly" : "monthly")}
          className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out bg-white/10 focus:outline-none focus:ring-2 focus:ring-brand/40"
          role="switch"
          aria-checked={billingPeriod === "yearly"}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-brand shadow ring-0 transition duration-200 ease-in-out ${
              billingPeriod === "yearly" ? "translate-x-5 bg-brand" : "translate-x-0 bg-white/65"
            }`}
          />
        </button>
        <span className={`text-sm font-semibold transition-colors flex items-center gap-1.5 ${billingPeriod === "yearly" ? "text-white" : "text-white/50"}`}>
          Anual
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20">
            Economize 20%
          </span>
        </span>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto pt-4 items-stretch">
        {plans.map((plan) => {
          const price = billingPeriod === "monthly" ? plan.priceMonthly : plan.priceYearly;
          return (
            <div
              key={plan.name}
              className={`rounded-2xl p-8 flex flex-col justify-between transition-all duration-200 ease-brand-out ${plan.color}`}
            >
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span
                    className={`text-[10px] font-bold px-4 py-1.5 rounded-full text-white uppercase tracking-wide shadow-md ${
                      plan.name === "Medical" ? "bg-[#0F766E]" : "bg-brand"
                    }`}
                  >
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-ink">{plan.name}</h3>
                  <p className="text-xs text-ink-3 mt-1.5 leading-relaxed">{plan.description}</p>
                </div>

                <div className="flex items-end gap-1">
                  <span className="font-display text-5xl text-gray-900 tracking-tight">{fmtBRL(price)}</span>
                  <span className="text-sm text-ink-3 mb-2 font-medium">/mês</span>
                </div>

                {billingPeriod === "yearly" && (
                  <p className="text-[10.5px] font-medium text-moss">
                    Cobrado anualmente ({fmtBRL(price * 12)})
                  </p>
                )}

                <hr className="border-border/60" />

                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-ink-2">
                      <Check
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          plan.name === "Medical"
                            ? "text-[#0F766E]"
                            : plan.popular
                            ? "text-brand"
                            : "text-moss"
                        }`}
                      />
                      <span className="leading-snug">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-8">
                {plan.popular ? (
                  <Link
                    href="/register"
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-bold text-sm shadow-md transition-all duration-150 hover:opacity-95 active:scale-[0.98] glow-pulse-premium"
                    style={{ background: "var(--brand-grad)" }}
                  >
                    <Sparkles className="w-4 h-4" />
                    {plan.ctaText}
                  </Link>
                ) : (
                  <Link
                    href="/register"
                    className="w-full block text-center py-3.5 rounded-xl border border-border text-ink-2 font-bold text-sm hover:bg-surface-2 hover:border-border-2 active:scale-[0.98] transition-all duration-150"
                  >
                    {plan.ctaText}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
