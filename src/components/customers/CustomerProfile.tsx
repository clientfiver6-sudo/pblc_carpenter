"use client";

import { useState, useTransition } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { formatPhone, getInitials } from "@/lib/utils";
import { CustomerStats } from "@/components/customers/CustomerStats";
import { CustomerTimeline } from "@/components/customers/CustomerTimeline";
import { CustomerProntuario } from "@/components/customers/CustomerProntuario";
import { DadosAdicionais } from "@/components/customers/DadosAdicionais";
import { TagManager } from "@/components/customers/TagManager";
import { QuickMessage } from "@/components/customers/QuickMessage";
import { EquipmentList } from "@/components/equipment/EquipmentList";
import { updateCustomerNotes, updateCustomer } from "@/lib/customers/actions";
import { ConsultationRecorder } from "@/components/medical/ConsultationRecorder";
import { SOAPNote } from "@/components/medical/SOAPNote";
import { AnamneseForm } from "@/components/medical/AnamneseForm";
import { PrescriptionForm } from "@/components/medical/PrescriptionForm";
import { ExamRequestForm } from "@/components/medical/ExamRequestForm";
import type { MedicalNote } from "@/components/medical/SOAPNote";
import type { Customer, CustomerStatus } from "@/types/database";
import type { BusinessType } from "@/lib/config/business-types";
import type { Plan } from "@/lib/auth/plan";
import { Phone, Mail, MapPin, Check, X, FileText } from "lucide-react";
import Link from "next/link";

interface CustomerProfileProps {
  customer: Customer;
  businessType: BusinessType;
  plan?: Plan;
  businessName?: string;
}

const STATUS_BADGE_VARIANT: Record<CustomerStatus, "moss" | "secondary" | "destructive"> = {
  active: "moss",
  inactive: "secondary",
  blocked: "destructive",
};

const STATUS_LABELS: Record<CustomerStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
  blocked: "Bloqueado",
};

type Tab = "perfil" | "prontuario" | "equipamentos" | "medico";

export function CustomerProfile({ customer, plan, businessName = "" }: CustomerProfileProps) {
  const [activeTab, setActiveTab] = useState<Tab>("perfil");
  const [medicalNotes, setMedicalNotes] = useState<MedicalNote[]>([]);
  const [notesLoaded, setNotesLoaded] = useState(false);

  function reloadMedicalNotes() {
    fetch(`/api/medical/notes?customer_id=${customer.id}`)
      .then(r => r.json())
      .then((d: { notes: MedicalNote[] }) => { setMedicalNotes(d.notes ?? []); setNotesLoaded(true) })
      .catch(() => setNotesLoaded(true))
  }

  const isMedical = plan === "medical";
  const [name, setName] = useState(customer.full_name);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(customer.full_name);
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [isPending, startTransition] = useTransition();
  const [notesError, setNotesError] = useState<string | null>(null);

  // Derive businessId from customer
  const businessId = customer.business_id;

  function handleNameEdit() {
    setDraftName(name);
    setEditingName(true);
  }

  function handleNameCancel() {
    setEditingName(false);
    setDraftName(name);
  }

  function handleNameSave() {
    const trimmed = draftName.trim();
    if (!trimmed) return;
    setName(trimmed);
    setEditingName(false);
    startTransition(async () => {
      try {
        await updateCustomer(customer.id, { full_name: trimmed });
      } catch {
        setName(customer.full_name);
      }
    });
  }

  function handleNotesBlur() {
    setNotesError(null);
    startTransition(async () => {
      try {
        await updateCustomerNotes(customer.id, notes);
      } catch {
        setNotesError("Erro ao salvar observações.");
      }
    });
  }

  // Parse metadata safely for DadosAdicionais
  const metadataObj =
    customer.metadata &&
    typeof customer.metadata === "object" &&
    !Array.isArray(customer.metadata)
      ? (customer.metadata as Record<string, unknown>)
      : {};

  return (
    <div className="flex gap-6 items-start">
      {/* Left column: 1/3 */}
      <div className="w-1/3 min-w-0 space-y-4">
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-4">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="bg-tint text-brand-2 text-2xl font-bold">
                {getInitials(name)}
              </AvatarFallback>
            </Avatar>

            {/* Name (editable) */}
            {editingName ? (
              <div className="flex items-center gap-1 w-full">
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleNameSave();
                    if (e.key === "Escape") handleNameCancel();
                  }}
                  autoFocus
                  className="flex-1 text-center text-base font-bold bg-surface-2 border border-border rounded-md px-2 py-1 text-ink outline-none focus:border-brand min-w-0"
                />
                <button
                  onClick={handleNameSave}
                  disabled={isPending}
                  className="text-brand hover:text-brand-2"
                  aria-label="Salvar nome"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNameCancel}
                  className="text-ink-3 hover:text-ink-2"
                  aria-label="Cancelar edição"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleNameEdit}
                className="text-lg font-bold text-ink hover:text-brand transition-colors text-center leading-tight"
                title="Clique para editar o nome"
              >
                {name}
              </button>
            )}

            {/* Status badge */}
            <Badge variant={STATUS_BADGE_VARIANT[customer.status]}>
              {STATUS_LABELS[customer.status]}
            </Badge>
          </div>

          <Separator className="bg-border" />

          {/* Contact info */}
          <div className="space-y-2">
            {customer.phone_number && (
              <a
                href={`tel:${customer.phone_number}`}
                className="flex items-center gap-2 text-sm text-ink-3 hover:text-ink transition-colors group"
              >
                <Phone className="w-3.5 h-3.5 shrink-0 group-hover:text-brand" />
                <span className="font-mono truncate">
                  {formatPhone(customer.phone_number)}
                </span>
              </a>
            )}
            {customer.email && (
              <a
                href={`mailto:${customer.email}`}
                className="flex items-center gap-2 text-sm text-ink-3 hover:text-ink transition-colors group"
              >
                <Mail className="w-3.5 h-3.5 shrink-0 group-hover:text-brand" />
                <span className="truncate">{customer.email}</span>
              </a>
            )}
            {(customer.address ?? customer.city) && (
              <div className="flex items-start gap-2 text-sm text-ink-3">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="truncate">
                  {[customer.address, customer.city]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </div>
            )}
          </div>

          <Separator className="bg-border" />

          {/* Tags */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-3">Etiquetas</p>
            <TagManager
              customerId={customer.id}
              currentTags={customer.tags}
            />
          </div>

          <Separator className="bg-border" />

          {/* Quick message */}
          <QuickMessage customer={customer} businessId={businessId} />
        </div>
      </div>

      {/* Right column: 2/3 */}
      <div className="flex-1 min-w-0 space-y-5">
        {/* Stats */}
        <CustomerStats customer={customer} />

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab("perfil")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "perfil"
                ? "border-brand text-brand"
                : "border-transparent text-ink-3 hover:text-ink"
            }`}
          >
            Perfil
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("prontuario")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "prontuario"
                ? "border-brand text-brand"
                : "border-transparent text-ink-3 hover:text-ink"
            }`}
          >
            {isMedical ? "Prontuário" : "Documentos"}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("equipamentos")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "equipamentos"
                ? "border-brand text-brand"
                : "border-transparent text-ink-3 hover:text-ink"
            }`}
          >
            Equipamentos
          </button>
          {isMedical && (
            <button
              type="button"
              onClick={() => { setActiveTab("medico"); if (!notesLoaded) reloadMedicalNotes() }}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === "medico"
                  ? "border-brand text-brand"
                  : "border-transparent text-ink-3 hover:text-ink"
              }`}
            >
              Médico
            </button>
          )}
        </div>

        {/* Tab: Perfil */}
        {activeTab === "perfil" && (
          <div className="space-y-5">
            {/* Notes */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-3">
              <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-3">Observações</p>
              <Textarea
                placeholder="Adicione anotações sobre este cliente..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
                rows={4}
                className="bg-surface-2 border-border text-ink placeholder:text-ink-4 resize-none focus-visible:ring-brand focus-visible:ring-2 text-sm rounded-md"
              />
              {notesError && (
                <p className="text-xs text-danger">{notesError}</p>
              )}
              {isPending && (
                <p className="text-xs text-ink-3">Salvando...</p>
              )}
            </div>

            {/* Dados adicionais */}
            <DadosAdicionais
              customerId={customer.id}
              initialMetadata={metadataObj}
            />

            {/* Timeline */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-3">
              <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-3">Histórico</p>
              <CustomerTimeline customerId={customer.id} />
            </div>
          </div>
        )}

        {/* Tab: Prontuário */}
        {activeTab === "prontuario" && (
          <CustomerProntuario customerId={customer.id} />
        )}

        {/* Tab: Equipamentos */}
        {activeTab === "equipamentos" && (
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Equipamentos</p>
              <Link
                href={`/dashboard/customers/${customer.id}/pmoc`}
                className="flex items-center gap-1.5 text-xs text-brand hover:text-brand-2 transition-colors font-medium"
              >
                <FileText className="w-3.5 h-3.5" />
                Relatório PMOC
              </Link>
            </div>
            <EquipmentList businessId={businessId} customerId={customer.id} />
          </div>
        )}

        {/* Tab: Médico */}
        {activeTab === "medico" && isMedical && (
          <div className="space-y-6">
            {/* Insurance fields */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-3">
              <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Convênio</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: "insurance_name",        label: "Operadora",     placeholder: "Unimed, Bradesco..." },
                  { key: "insurance_plan",         label: "Plano",         placeholder: "Plano nacional, etc." },
                  { key: "insurance_card_number",  label: "Nº da Carteira", placeholder: "000000000" },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} className="space-y-1">
                    <label className="text-[11px] font-medium text-ink-3">{label}</label>
                    <input
                      defaultValue={(customer as unknown as Record<string, string>)[key] ?? ""}
                      placeholder={placeholder}
                      className="w-full rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:border-brand"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Consultation recorder */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-3">
              <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Gravador de Consulta</p>
              <ConsultationRecorder
                customerId={customer.id}
                onSaved={reloadMedicalNotes}
              />
            </div>

            {/* SOAP notes list */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-3">
              <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Notas SOAP</p>
              {!notesLoaded ? (
                <p className="text-sm text-ink-3">Carregando...</p>
              ) : medicalNotes.length === 0 ? (
                <p className="text-sm text-ink-3">Nenhuma nota registrada ainda.</p>
              ) : (
                <div className="space-y-2">
                  {medicalNotes.map(n => <SOAPNote key={n.id} note={n} />)}
                </div>
              )}
            </div>

            {/* Anamnese */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-3">
              <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Anamnese</p>
              <AnamneseForm customerId={customer.id} />
            </div>

            {/* Prescription */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-3">
              <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Receituário</p>
              <PrescriptionForm customerName={customer.full_name} businessName={businessName} />
            </div>

            {/* Exam request */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-3">
              <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Pedido de Exames</p>
              <ExamRequestForm customerName={customer.full_name} businessName={businessName} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
