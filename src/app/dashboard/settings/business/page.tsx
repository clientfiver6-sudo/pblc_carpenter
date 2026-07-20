"use client";

import { useState, useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Building2 } from "lucide-react";
import OpeningHoursEditor, { type OpeningHours } from "@/components/settings/OpeningHoursEditor";
import { updateBusiness } from "@/lib/settings/actions";
import { BUSINESS_TYPE_OPTIONS } from "@/lib/config/business-types";
import type { Business, Json } from "@/types/database";
import { createClient } from "@/lib/supabase/client";

const BRAZIL_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

const businessSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  type: z.string().min(1, "Selecione o tipo do negócio"),
  phone: z.string().optional(),
  whatsapp_number: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
});

type BusinessFormData = z.infer<typeof businessSchema>;

const DEFAULT_HOURS: OpeningHours = {
  monday: { open: true, start: "08:00", end: "18:00" },
  tuesday: { open: true, start: "08:00", end: "18:00" },
  wednesday: { open: true, start: "08:00", end: "18:00" },
  thursday: { open: true, start: "08:00", end: "18:00" },
  friday: { open: true, start: "08:00", end: "18:00" },
  saturday: { open: false, start: "08:00", end: "13:00" },
  sunday: { open: false, start: "08:00", end: "13:00" },
};

export default function BusinessSettingsPage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [openingHours, setOpeningHours] = useState<OpeningHours>(DEFAULT_HOURS);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BusinessFormData>({ resolver: zodResolver(businessSchema) });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: rawBu } = await supabase
        .from("business_users")
        .select("business_id")
        .eq("user_id", user.id)
        .single();
      const bu = rawBu as { business_id: string } | null;

      if (!bu?.business_id) return;

      const { data: rawBiz } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", bu.business_id)
        .single();
      const biz = rawBiz as Business | null;

      if (!biz) return;

      setBusiness(biz);
      setValue("name", biz.name);
      setValue("type", biz.type);
      setValue("phone", biz.phone ?? "");
      setValue("whatsapp_number", biz.whatsapp_number ?? "");
      setValue("address", biz.address ?? "");
      setValue("city", biz.city ?? "");
      setValue("state", biz.state ?? "");
      setValue("zip_code", biz.zip_code ?? "");

      if (biz.opening_hours && typeof biz.opening_hours === "object") {
        setOpeningHours(biz.opening_hours as unknown as OpeningHours);
      }
    }
    load();
  }, [setValue]);

  function onSubmit(data: BusinessFormData) {
    setSaveError(null);
    setSaveSuccess(false);
    startTransition(async () => {
      try {
        await updateBusiness({ ...data, opening_hours: openingHours as unknown as Json } as Parameters<typeof updateBusiness>[0]);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Erro ao salvar");
      }
    });
  }

  const typeValue = watch("type");
  const stateValue = watch("state");

  return (
    <div className="min-h-screen bg-bg text-ink">
      <div className="max-w-[860px] mx-auto px-4 sm:px-6 md:px-8 py-7 pb-28 space-y-6">
        <div className="mb-8 flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-tint flex items-center justify-center">
            <Building2 className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-ink tracking-tight">Meu Negócio</h2>
            <p className="text-sm text-ink-3 mt-0.5">Informações do seu negócio</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Informações Básicas */}
          <Card className="bg-surface border border-border rounded-lg shadow-1">
            <CardHeader>
              <CardTitle className="text-base text-ink">Informações Básicas</CardTitle>
              <CardDescription className="text-ink-3">
                Nome, tipo e contatos do seu negócio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5">
                  Nome do negócio <span className="text-danger">*</span>
                </Label>
                <Input
                  id="name"
                  {...register("name")}
                  placeholder="Ex: Clínica Saúde & Vida"
                  className="border border-border bg-surface text-ink rounded-md h-11 px-3.5 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 placeholder:text-ink-4"
                />
                {errors.name && (
                  <p className="text-xs text-danger">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5">
                  Tipo de negócio <span className="text-danger">*</span>
                </Label>
                <Select
                  value={typeValue}
                  onValueChange={(v) => setValue("type", v)}
                >
                  <SelectTrigger className="border border-border bg-surface text-ink rounded-md h-11 px-3.5 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent className="bg-surface border-border">
                    {BUSINESS_TYPE_OPTIONS.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        className="text-ink focus:bg-surface-2 focus:text-brand"
                      >
                        {opt.icon} {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.type && (
                  <p className="text-xs text-danger">{errors.type.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5">Telefone</Label>
                  <Input
                    id="phone"
                    {...register("phone")}
                    placeholder="(11) 9 9999-9999"
                    className="border border-border bg-surface text-ink rounded-md h-11 px-3.5 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 placeholder:text-ink-4"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="whatsapp_number" className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5">
                    Número WhatsApp
                  </Label>
                  <Input
                    id="whatsapp_number"
                    {...register("whatsapp_number")}
                    placeholder="5511999999999"
                    className="border border-border bg-surface text-ink rounded-md h-11 px-3.5 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 placeholder:text-ink-4 font-mono"
                  />
                  <p className="text-xs text-ink-3">
                    Formato: código país + DDD + número (sem espaços ou traços)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Localização */}
          <Card className="bg-surface border border-border rounded-lg shadow-1">
            <CardHeader>
              <CardTitle className="text-base text-ink">Localização</CardTitle>
              <CardDescription className="text-ink-3">
                Endereço do seu negócio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5">Endereço</Label>
                <Input
                  id="address"
                  {...register("address")}
                  placeholder="Rua, número, complemento"
                  className="border border-border bg-surface text-ink rounded-md h-11 px-3.5 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 placeholder:text-ink-4"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-1 space-y-1.5">
                  <Label htmlFor="city" className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5">Cidade</Label>
                  <Input
                    id="city"
                    {...register("city")}
                    placeholder="São Paulo"
                    className="border border-border bg-surface text-ink rounded-md h-11 px-3.5 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 placeholder:text-ink-4"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5">Estado</Label>
                  <Select
                    value={stateValue ?? ""}
                    onValueChange={(v) => setValue("state", v)}
                  >
                    <SelectTrigger className="border border-border bg-surface text-ink rounded-md h-11 px-3.5 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20">
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent className="bg-surface border-border">
                      {BRAZIL_STATES.map((s) => (
                        <SelectItem
                          key={s}
                          value={s}
                          className="text-ink focus:bg-surface-2 focus:text-brand"
                        >
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="zip_code" className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5">CEP</Label>
                  <Input
                    id="zip_code"
                    {...register("zip_code")}
                    placeholder="00000-000"
                    className="border border-border bg-surface text-ink rounded-md h-11 px-3.5 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 placeholder:text-ink-4 font-mono"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Horário de Funcionamento */}
          <Card className="bg-surface border border-border rounded-lg shadow-1">
            <CardHeader>
              <CardTitle className="text-base text-ink">Horário de Funcionamento</CardTitle>
              <CardDescription className="text-ink-3">
                A IA usará esses horários para informar sua disponibilidade
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OpeningHoursEditor value={openingHours} onChange={setOpeningHours} />
            </CardContent>
          </Card>

          {/* Status & Save */}
          {saveError && (
            <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-4 py-3">
              {saveError}
            </p>
          )}
          {saveSuccess && (
            <p className="text-sm text-moss bg-moss/10 border border-moss/20 rounded-lg px-4 py-3">
              Configurações salvas com sucesso!
            </p>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isPending || !business}
              className="text-white rounded-md h-11 px-5 font-semibold text-sm disabled:opacity-50"
              style={{ background: 'var(--brand-grad)' }}
            >
              {isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
