"use client";

import { useState, useTransition } from "react";
import { updateCustomerMetadata } from "@/lib/customers/attachments";
import type { CustomerCustomFields } from "@/types/database";
import { Plus, X, Check, Loader2 } from "lucide-react";

interface DadosAdicionaisProps {
  customerId: string;
  initialMetadata: Record<string, unknown>;
}

type CustomField = { key: string; value: string };

const PLACEHOLDER_KEYS = [
  "Data de nascimento",
  "Alergias",
  "Tipo sanguíneo",
  "Plano de saúde",
];

function parseMeta(meta: Record<string, unknown>): CustomField[] {
  const typed = meta as CustomerCustomFields;
  if (!typed.customFields || !Array.isArray(typed.customFields)) return [];
  return typed.customFields.filter(
    (f): f is CustomField =>
      typeof f === "object" &&
      f !== null &&
      typeof f.key === "string" &&
      typeof f.value === "string"
  );
}

export function DadosAdicionais({
  customerId,
  initialMetadata,
}: DadosAdicionaisProps) {
  const [fields, setFields] = useState<CustomField[]>(
    parseMeta(initialMetadata)
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function addField() {
    // Suggest a placeholder key not already in use
    const usedKeys = new Set(fields.map((f) => f.key));
    const suggestion =
      PLACEHOLDER_KEYS.find((k) => !usedKeys.has(k)) ?? "";
    setFields((prev) => [...prev, { key: suggestion, value: "" }]);
    setSaved(false);
  }

  function updateField(
    idx: number,
    part: "key" | "value",
    val: string
  ) {
    setFields((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, [part]: val } : f))
    );
    setSaved(false);
  }

  function removeField(idx: number) {
    setFields((prev) => prev.filter((_, i) => i !== idx));
    setSaved(false);
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    // Filter out fields with empty keys
    const cleaned = fields.filter((f) => f.key.trim());
    startTransition(async () => {
      const result = await updateCustomerMetadata(customerId, {
        ...initialMetadata,
        customFields: cleaned,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setFields(cleaned);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
          Dados adicionais
        </p>
        <button
          type="button"
          onClick={addField}
          className="flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-2 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar
        </button>
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-ink-3">
          Nenhum dado adicional. Clique em &quot;Adicionar&quot; para incluir informações
          como data de nascimento, alergias, etc.
        </p>
      ) : (
        <ul className="space-y-2">
          {fields.map((field, idx) => (
            <li key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={field.key}
                onChange={(e) => updateField(idx, "key", e.target.value)}
                placeholder={PLACEHOLDER_KEYS[idx % PLACEHOLDER_KEYS.length]}
                className="w-36 shrink-0 text-xs bg-surface-2 border border-border rounded-md px-2 py-1.5 text-ink placeholder:text-ink-4 outline-none focus:border-brand transition-colors"
                aria-label="Chave do campo"
              />
              <span className="text-ink-3 text-xs">:</span>
              <input
                type="text"
                value={field.value}
                onChange={(e) => updateField(idx, "value", e.target.value)}
                placeholder="Valor"
                className="flex-1 min-w-0 text-xs bg-surface-2 border border-border rounded-md px-2 py-1.5 text-ink placeholder:text-ink-4 outline-none focus:border-brand transition-colors"
                aria-label="Valor do campo"
              />
              <button
                type="button"
                onClick={() => removeField(idx)}
                className="shrink-0 p-1 rounded hover:bg-surface-2 text-ink-4 hover:text-danger transition-colors"
                aria-label="Remover campo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

      {fields.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-1.5 text-xs font-medium bg-brand text-white rounded-lg px-3 py-1.5 hover:bg-brand-2 transition-colors disabled:opacity-60"
          >
            {isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : saved ? (
              <Check className="w-3 h-3" />
            ) : null}
            {isPending ? "Salvando..." : saved ? "Salvo!" : "Salvar"}
          </button>
        </div>
      )}
    </div>
  );
}
