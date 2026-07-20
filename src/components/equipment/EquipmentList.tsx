"use client";

import { useState, useEffect, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Pencil, Trash2, Loader2, AlertCircle, Cpu } from "lucide-react";
import type { Equipment } from "@/types/database";

interface EquipmentListProps {
  businessId: string;
  customerId: string;
}

const CONDITION_MAP: Record<string, { label: string; cls: string }> = {
  good: { label: "Bom estado", cls: "bg-moss/10 text-moss" },
  fair: { label: "Regular",   cls: "bg-warning/10 text-warning" },
  poor: { label: "Ruim",      cls: "bg-danger/10 text-danger" },
};

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function EquipmentList({ businessId, customerId }: EquipmentListProps) {
  const [items, setItems] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [adding, setAdding] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("equipment")
      .select("*")
      .eq("business_id", businessId)
      .eq("customer_id", customerId)
      .order("name", { ascending: true });
    setItems((data ?? []) as Equipment[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  function handleDelete(id: string) {
    if (!confirm("Remover este equipamento?")) return;
    startTransition(async () => {
      const res = await fetch(`/api/equipment/${id}`, { method: "DELETE" });
      if (res.ok) setItems((prev) => prev.filter((e) => e.id !== id));
      else setError("Erro ao remover equipamento.");
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 text-ink-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 text-danger text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {items.length === 0 && !adding && (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-ink-4">
          <Cpu className="w-8 h-8" />
          <p className="text-sm">Nenhum equipamento cadastrado</p>
        </div>
      )}

      {items.map((eq) => (
        <div key={eq.id} className="border border-border rounded-lg p-4 bg-surface space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-ink truncate">{eq.name}</p>
              {(eq.brand || eq.model) && (
                <p className="text-xs text-ink-3">{[eq.brand, eq.model].filter(Boolean).join(" — ")}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${CONDITION_MAP[eq.condition]?.cls ?? "bg-surface-2 text-ink-3"}`}>
                {CONDITION_MAP[eq.condition]?.label ?? eq.condition}
              </span>
              <button
                onClick={() => setEditing(eq)}
                className="p-1.5 rounded text-ink-4 hover:text-ink hover:bg-surface-2 transition-colors"
                type="button"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(eq.id)}
                disabled={isPending}
                className="p-1.5 rounded text-ink-4 hover:text-danger hover:bg-danger/10 transition-colors"
                type="button"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-ink-4 flex-wrap">
            {eq.location && <span>📍 {eq.location}</span>}
            {eq.serial_number && <span>S/N: {eq.serial_number}</span>}
            {eq.installation_date && <span>Instalado em {fmtDate(eq.installation_date)}</span>}
          </div>
          {eq.notes && <p className="text-xs text-ink-3 mt-1">{eq.notes}</p>}
        </div>
      ))}

      {(adding || editing) && (
        <EquipmentFormInline
          businessId={businessId}
          customerId={customerId}
          initial={editing}
          onSaved={(eq) => {
            if (editing) setItems((prev) => prev.map((e) => e.id === eq.id ? eq : e));
            else setItems((prev) => [...prev, eq]);
            setAdding(false);
            setEditing(null);
          }}
          onCancel={() => { setAdding(false); setEditing(null); }}
        />
      )}

      {!adding && !editing && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-dashed border-border text-sm text-ink-3 hover:border-brand/50 hover:text-brand transition-colors w-full"
        >
          <Plus className="w-4 h-4" />
          Adicionar equipamento
        </button>
      )}
    </div>
  );
}

function EquipmentFormInline({
  businessId,
  customerId,
  initial,
  onSaved,
  onCancel,
}: {
  businessId: string;
  customerId: string;
  initial: Equipment | null;
  onSaved: (eq: Equipment) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    brand: initial?.brand ?? "",
    model: initial?.model ?? "",
    serialNumber: initial?.serial_number ?? "",
    installationDate: initial?.installation_date ?? "",
    location: initial?.location ?? "",
    condition: initial?.condition ?? "good",
    notes: initial?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSave() {
    if (!form.name.trim()) { setErr("Nome é obrigatório."); return; }
    setSaving(true);
    setErr(null);

    const url = initial ? `/api/equipment/${initial.id}` : "/api/equipment";
    const method = initial ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId,
        customerId,
        name: form.name,
        brand: form.brand || null,
        model: form.model || null,
        serialNumber: form.serialNumber || null,
        installationDate: form.installationDate || null,
        location: form.location || null,
        condition: form.condition,
        notes: form.notes || null,
      }),
    });

    setSaving(false);
    if (!res.ok) { setErr("Erro ao salvar equipamento."); return; }
    const data = await res.json();
    onSaved(data.equipment as Equipment);
  }

  const field = (label: string, key: keyof typeof form, type = "text") => (
    <div>
      <label className="block text-xs font-medium text-ink-3 mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="w-full px-3 py-1.5 rounded-md border border-border bg-surface-2 text-ink text-sm placeholder:text-ink-4 focus:outline-none focus:border-brand"
      />
    </div>
  );

  return (
    <div className="border border-brand/30 rounded-lg p-4 bg-tint/20 space-y-3">
      <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
        {initial ? "Editar equipamento" : "Novo equipamento"}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">{field("Nome *", "name")}</div>
        {field("Marca", "brand")}
        {field("Modelo", "model")}
        {field("Número de série", "serialNumber")}
        {field("Data de instalação", "installationDate", "date")}
        {field("Localização (ex: sala, quarto 1)", "location")}
        <div>
          <label className="block text-xs font-medium text-ink-3 mb-1">Condição</label>
          <select
            value={form.condition}
            onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
            className="w-full px-3 py-1.5 rounded-md border border-border bg-surface-2 text-ink text-sm focus:outline-none focus:border-brand"
          >
            <option value="good">Bom estado</option>
            <option value="fair">Regular</option>
            <option value="poor">Ruim</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-ink-3 mb-1">Observações</label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="w-full px-3 py-1.5 rounded-md border border-border bg-surface-2 text-ink text-sm placeholder:text-ink-4 focus:outline-none focus:border-brand resize-none"
          />
        </div>
      </div>
      {err && <p className="text-xs text-danger">{err}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-ink-3 hover:text-ink border border-border rounded-md transition-colors">
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-brand text-white rounded-md hover:bg-brand/90 transition-colors disabled:opacity-60"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Salvar
        </button>
      </div>
    </div>
  );
}
