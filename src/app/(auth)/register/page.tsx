"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Loader2, Eye, EyeOff, Check, X } from "lucide-react";
import { signUpDirect } from "@/lib/auth/actions";
import { Logo } from "@/components/Logo";

const ESTADOS_BR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO",
];

const passwordSchema = z.string()
  .min(8, "Mínimo 8 caracteres")
  .regex(/[A-Z]/, "Pelo menos uma letra maiúscula")
  .regex(/[0-9]/, "Pelo menos um número");

const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: passwordSchema,
  confirmPassword: z.string().min(1, "Confirme sua senha"),
  telefone: z.string()
    .min(1, "Telefone é obrigatório")
    .refine((v) => v.replace(/\D/g, "").length >= 10, "Telefone inválido"),
  cidade: z.string().min(2, "Cidade é obrigatória"),
  estado: z.string().min(2, "Selecione um estado"),
  cep: z.string()
    .refine((v) => v.replace(/\D/g, "").length === 8, "CEP deve ter 8 dígitos"),
  termsAccepted: z.boolean().refine((v) => v, { message: "Você deve aceitar os termos para continuar" }),
}).refine((d) => d.password === d.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

const PW_RULES = [
  { label: "Mínimo 8 caracteres",       test: (v: string) => v.length >= 8 },
  { label: "Uma letra maiúscula",        test: (v: string) => /[A-Z]/.test(v) },
  { label: "Um número",                  test: (v: string) => /[0-9]/.test(v) },
];

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export default function RegisterPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { termsAccepted: false, estado: "" },
  });

  const passwordValue = watch("password") ?? "";

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatPhone(e.target.value);
    setValue("telefone", formatted, { shouldValidate: true });
  }

  function handleCepChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatCep(e.target.value);
    setValue("cep", formatted, { shouldValidate: true });
  }

  async function onSubmit(data: RegisterForm) {
    setServerError(null);
    setSubmitting(true);
    const formData = new FormData();
    formData.set("name", data.name);
    formData.set("email", data.email);
    formData.set("password", data.password);
    formData.set("telefone", data.telefone);
    formData.set("cidade", data.cidade);
    formData.set("estado", data.estado);
    formData.set("cep", data.cep);

    const result = await signUpDirect(formData);
    if (result?.error) {
      setServerError(result.error);
      setSubmitting(false);
    }
    // on success the server redirects — keep spinner until navigation completes
  }

  const inputClass =
    "w-full border border-border rounded-md h-11 px-4 text-sm text-ink bg-surface placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/40";

  return (
    <div className="min-h-screen flex">
      {/* LEFT PANEL — brand orange */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "var(--brand-grad)" }}
      >
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at top left, rgba(255,255,255,0.12) 0%, transparent 55%)" }}
        />
        <div className="absolute bottom-0 right-0 pointer-events-none w-[400px] h-[400px]"
          style={{ background: "radial-gradient(ellipse at bottom right, rgba(0,0,0,0.10) 0%, transparent 65%)" }}
        />
        <Logo size={32} onDark />
        <div className="space-y-5 relative z-10">
          <p className="font-display text-[44px] leading-tight text-white">
            Crie sua conta<br />e comece agora.
          </p>
          <p className="text-base leading-relaxed text-white/70">
            IA para o empresário brasileiro — agendamentos, WhatsApp, cobranças e equipe em um só lugar.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap relative z-10">
          {["Agendamentos", "WhatsApp IA", "Cobranças", "CRM"].map((f) => (
            <span key={f} className="px-3 py-1 rounded-full text-xs font-medium border border-white/25 bg-white/15 text-white">
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL — register form */}
      <div className="flex-1 flex items-start justify-center bg-bg px-4 py-8 sm:p-8 overflow-y-auto pb-28 sm:pb-8">
        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-300 py-4">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-ink mb-2">Criar sua conta</h2>
            <p className="text-ink-3 text-sm">
              Comece a gerenciar seu negócio com inteligência
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-sm font-medium text-ink-2">
                Seu nome
              </label>
              <input
                id="name"
                type="text"
                placeholder="João Silva"
                autoComplete="name"
                className={inputClass}
                {...register("name")}
              />
              {errors.name && (
                <p className="text-danger text-xs animate-in fade-in slide-in-from-top-1 duration-200">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-ink-2">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
                className={inputClass}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-danger text-xs animate-in fade-in slide-in-from-top-1 duration-200">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-ink-2">
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className={`${inputClass} pr-10`}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-4 hover:text-ink-2 transition-colors"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Requirements checklist */}
              {passwordValue.length > 0 && (
                <ul className="space-y-1 pt-1">
                  {PW_RULES.map(({ label, test }) => {
                    const ok = test(passwordValue);
                    return (
                      <li key={label} className={`flex items-center gap-1.5 text-xs transition-colors ${ok ? "text-moss" : "text-ink-4"}`}>
                        {ok ? <Check className="w-3 h-3 shrink-0" /> : <X className="w-3 h-3 shrink-0" />}
                        {label}
                      </li>
                    );
                  })}
                </ul>
              )}
              {errors.password && (
                <p className="text-danger text-xs animate-in fade-in slide-in-from-top-1 duration-200">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-ink-2">
                Confirmar senha
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className={`${inputClass} pr-10`}
                  {...register("confirmPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-4 hover:text-ink-2 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-danger text-xs animate-in fade-in slide-in-from-top-1 duration-200">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label htmlFor="telefone" className="text-sm font-medium text-ink-2">
                Telefone / WhatsApp
              </label>
              <input
                id="telefone"
                type="tel"
                placeholder="(11) 99999-9999"
                autoComplete="tel"
                className={inputClass}
                {...register("telefone")}
                onChange={handlePhoneChange}
              />
              {errors.telefone && (
                <p className="text-danger text-xs animate-in fade-in slide-in-from-top-1 duration-200">
                  {errors.telefone.message}
                </p>
              )}
            </div>

            {/* City + State in a row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="cidade" className="text-sm font-medium text-ink-2">
                  Cidade
                </label>
                <input
                  id="cidade"
                  type="text"
                  placeholder="São Paulo"
                  autoComplete="address-level2"
                  className={inputClass}
                  {...register("cidade")}
                />
                {errors.cidade && (
                  <p className="text-danger text-xs animate-in fade-in slide-in-from-top-1 duration-200">
                    {errors.cidade.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="estado" className="text-sm font-medium text-ink-2">
                  Estado
                </label>
                <select
                  id="estado"
                  className={`${inputClass} cursor-pointer`}
                  {...register("estado")}
                >
                  <option value="">Selecione...</option>
                  {ESTADOS_BR.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
                {errors.estado && (
                  <p className="text-danger text-xs animate-in fade-in slide-in-from-top-1 duration-200">
                    {errors.estado.message}
                  </p>
                )}
              </div>
            </div>

            {/* CEP */}
            <div className="space-y-1.5">
              <label htmlFor="cep" className="text-sm font-medium text-ink-2">
                CEP
              </label>
              <input
                id="cep"
                type="text"
                placeholder="00000-000"
                autoComplete="postal-code"
                className={inputClass}
                {...register("cep")}
                onChange={handleCepChange}
              />
              {errors.cep && (
                <p className="text-danger text-xs animate-in fade-in slide-in-from-top-1 duration-200">
                  {errors.cep.message}
                </p>
              )}
            </div>

            {/* Terms */}
            <div className="flex items-start gap-3">
              <input
                id="termsAccepted"
                type="checkbox"
                className="mt-0.5 w-4 h-4 accent-brand rounded"
                {...register("termsAccepted")}
              />
              <label htmlFor="termsAccepted" className="text-xs text-ink-3 leading-relaxed">
                Li e concordo com os{" "}
                <Link href="/termos" target="_blank" className="text-brand hover:underline">
                  Termos de Uso
                </Link>{" "}
                e a{" "}
                <Link href="/privacidade" target="_blank" className="text-brand hover:underline">
                  Política de Privacidade
                </Link>
              </label>
            </div>
            {errors.termsAccepted && (
              <p className="text-danger text-xs -mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                {errors.termsAccepted.message}
              </p>
            )}

            {/* Server error */}
            {serverError && (
              <div className="rounded-md bg-danger/5 border border-danger/20 px-3 py-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <p className="text-danger text-xs">{serverError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-md text-white font-semibold text-sm hover:opacity-90 active:scale-[0.97] transition-[opacity,transform] duration-150 ease-brand-out disabled:opacity-60"
              style={{ background: "var(--brand-grad)" }}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
              ) : (
                "Criar minha conta"
              )}
            </button>
          </form>

          <p className="text-ink-3 text-sm text-center mt-6">
            Já tem uma conta?{" "}
            <Link href="/login" className="text-brand hover:text-brand-2 font-medium">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
