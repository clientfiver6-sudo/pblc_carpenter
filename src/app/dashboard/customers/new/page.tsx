"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createCustomerWithAuth } from "./actions";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight, UserPlus } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AIEntryPanel } from "@/components/ai/AIEntryPanel";

const newCustomerSchema = z.object({
  full_name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  phone_number: z.string().optional().or(z.literal("")),
  email: z
    .string()
    .email("E-mail inválido")
    .optional()
    .or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

type NewCustomerFormData = z.infer<typeof newCustomerSchema>;

interface CustomerAIFields {
  full_name?: string
  phone_number?: string
  email?: string
  address?: string
  city?: string
  notes?: string
}

export default function NewCustomerPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"manual" | "ai">("manual");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<NewCustomerFormData>({
    resolver: zodResolver(newCustomerSchema),
    defaultValues: {
      full_name: "",
      phone_number: "",
      email: "",
      address: "",
      city: "",
      notes: "",
    },
  });

  function handleAIFill(fields: Partial<CustomerAIFields>) {
    if (fields.full_name) setValue("full_name", fields.full_name)
    if (fields.phone_number) setValue("phone_number", fields.phone_number)
    if (fields.email) setValue("email", fields.email)
    if (fields.address) setValue("address", fields.address)
    if (fields.city) setValue("city", fields.city)
    if (fields.notes) setValue("notes", fields.notes)
    setActiveTab("manual")
  }

  function onSubmit(data: NewCustomerFormData) {
    setServerError(null);
    startTransition(async () => {
      try {
        const customer = await createCustomerWithAuth(data);
        router.push(`/dashboard/customers/${customer.id}`);
      } catch (err) {
        setServerError(
          err instanceof Error ? err.message : "Erro ao criar cliente"
        );
      }
    });
  }

  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-6 md:px-4 sm:px-6 md:px-8 py-7 pb-28 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-ink-3 hover:text-ink">
        <Link
          href="/dashboard/customers"
          className="text-ink-3 hover:text-ink text-sm flex items-center gap-1 transition-colors"
        >
          Clientes
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-ink-3" />
        <span className="text-ink-2">Novo cliente</span>
      </nav>

      <h2 className="text-2xl font-bold text-ink tracking-tight">Novo Cliente</h2>

      {/* Entry mode tabs */}
      <div className="flex bg-surface-2 rounded-md p-1 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("manual")}
          className={cn(
            "flex-1 py-2 rounded text-sm text-center cursor-pointer transition-[color,background-color,box-shadow] duration-150 ease-brand-out",
            activeTab === "manual" ? "font-semibold bg-surface text-ink" : "text-ink-3 hover:text-ink-2"
          )}
          style={activeTab === "manual" ? { boxShadow: "var(--shadow-1)" } : undefined}
        >
          Preencher manualmente
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ai")}
          className={cn(
            "flex-1 py-2 rounded text-sm text-center cursor-pointer transition-[color,background-color,box-shadow] duration-150 ease-brand-out",
            activeTab === "ai" ? "font-semibold bg-surface text-ink" : "text-ink-3 hover:text-ink-2"
          )}
          style={activeTab === "ai" ? { boxShadow: "var(--shadow-1)" } : undefined}
        >
          <span className="text-brand">✦</span> Descrever com IA
        </button>
      </div>

      {activeTab === "ai" ? (
        <AIEntryPanel<CustomerAIFields>
          entityType="customer"
          placeholder="Ex: Maria Silva, telefone (11) 99999-8888, mora em São Paulo, cliente de skincare"
          onFill={handleAIFill}
        />
      ) : (
        <Card className="bg-surface border border-border rounded-lg shadow-sm">
          <CardHeader>
            <CardTitle className="text-ink flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-brand" />
              Dados do cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Nome completo */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5 block">
                  Nome completo <span className="text-danger">*</span>
                </label>
                <Input
                  {...register("full_name")}
                  placeholder="Ex: Maria Silva"
                  className="border-border bg-surface text-ink rounded-md h-10 px-3 placeholder:text-ink-4 focus-visible:ring-brand focus-visible:ring-2 focus:border-brand"
                />
                {errors.full_name && (
                  <p className="text-xs text-danger">{errors.full_name.message}</p>
                )}
              </div>

              {/* Phone + email row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5 block">Telefone</label>
                  <Input
                    {...register("phone_number")}
                    placeholder="(11) 99999-9999"
                    className="border-border bg-surface text-ink rounded-md h-10 px-3 placeholder:text-ink-4 font-mono focus-visible:ring-brand focus-visible:ring-2 focus:border-brand"
                  />
                  {errors.phone_number && (
                    <p className="text-xs text-danger">{errors.phone_number.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5 block">E-mail</label>
                  <Input
                    {...register("email")}
                    type="email"
                    placeholder="maria@email.com"
                    className="border-border bg-surface text-ink rounded-md h-10 px-3 placeholder:text-ink-4 focus-visible:ring-brand focus-visible:ring-2 focus:border-brand"
                  />
                  {errors.email && (
                    <p className="text-xs text-danger">{errors.email.message}</p>
                  )}
                </div>
              </div>

              {/* Address + city row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5 block">Endereço</label>
                  <Input
                    {...register("address")}
                    placeholder="Rua, número"
                    className="border-border bg-surface text-ink rounded-md h-10 px-3 placeholder:text-ink-4 focus-visible:ring-brand focus-visible:ring-2 focus:border-brand"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5 block">Cidade</label>
                  <Input
                    {...register("city")}
                    placeholder="São Paulo"
                    className="border-border bg-surface text-ink rounded-md h-10 px-3 placeholder:text-ink-4 focus-visible:ring-brand focus-visible:ring-2 focus:border-brand"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5 block">Observações</label>
                <Textarea
                  {...register("notes")}
                  placeholder="Informações adicionais sobre o cliente..."
                  rows={3}
                  className="border-border bg-surface text-ink rounded-md placeholder:text-ink-4 resize-none focus-visible:ring-brand focus-visible:ring-2 focus:border-brand"
                />
              </div>

              {serverError && (
                <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                  {serverError}
                </p>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/dashboard/customers")}
                  disabled={isPending}
                  className="border border-border bg-surface text-ink-2 hover:bg-surface-2 rounded-md h-9 px-4 text-sm font-semibold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="text-white font-semibold rounded-md h-10 px-5 text-sm min-w-28"
                  style={{ background: "var(--brand-grad)" }}
                >
                  {isPending ? "Salvando..." : "Criar cliente"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
