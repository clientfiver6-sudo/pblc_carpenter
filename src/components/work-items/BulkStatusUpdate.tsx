"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CheckSquare, CheckCircle2, XCircle, Loader2, Square } from "lucide-react";
import { bulkUpdateStatus } from "@/lib/work-items/bulk-actions";
import type { WorkItemStatus } from "@/types/database";

interface BulkStatusUpdateProps {
  /** All selectable item IDs */
  allIds: string[];
  businessId: string;
  /** Called after a successful bulk update so parent can refresh */
  onSuccess?: () => void;
}

export function BulkStatusUpdate({
  allIds,
  businessId,
  onSuccess,
}: BulkStatusUpdateProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const allSelected = allIds.length > 0 && selectedIds.size === allIds.length;
  const someSelected = selectedIds.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleBulkUpdate(status: WorkItemStatus) {
    setError(null);
    const ids = Array.from(selectedIds);
    startTransition(async () => {
      try {
        await bulkUpdateStatus(ids, status, businessId);
        setSelectedIds(new Set());
        onSuccess?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao atualizar.");
      }
    });
  }

  return {
    selectedIds,
    toggleOne,
    toggleAll,
    allSelected,
    someSelected,
    // Render the floating action bar separately
    floatingBar: someSelected ? (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-center gap-3 bg-ink border border-ink/80 rounded-xl px-4 py-3 shadow-3">
          <span className="text-sm text-ink-4 font-mono whitespace-nowrap">
            {selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""}
          </span>

          <div className="w-px h-5 bg-white/20" />

          <Button
            size="sm"
            onClick={() => handleBulkUpdate("confirmed")}
            disabled={isPending}
            className="gap-1.5 bg-info/15 text-info border border-info/30 hover:bg-info/25 h-8"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckSquare className="w-3.5 h-3.5" />
            )}
            Confirmar todos
          </Button>

          <Button
            size="sm"
            onClick={() => handleBulkUpdate("completed")}
            disabled={isPending}
            className="gap-1.5 bg-moss/15 text-moss border border-moss/30 hover:bg-moss/25 h-8"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            Concluir todos
          </Button>

          <Button
            size="sm"
            onClick={() => handleBulkUpdate("cancelled")}
            disabled={isPending}
            className="gap-1.5 bg-[#F43F5E]/15 text-danger border border-[#F43F5E]/30 hover:bg-[#F43F5E]/25 h-8"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <XCircle className="w-3.5 h-3.5" />
            )}
            Cancelar todos
          </Button>

          {error && (
            <span className="text-xs text-danger">{error}</span>
          )}
        </div>
      </div>
    ) : null,
    // Render the select-all checkbox
    selectAllCheckbox: (
      <button
        type="button"
        onClick={toggleAll}
        className={cn(
          "flex items-center gap-1.5 text-xs transition-colors",
          allSelected ? "text-brand" : "text-ink-3 hover:text-ink-2"
        )}
        title={allSelected ? "Desselecionar todos" : "Selecionar todos"}
      >
        {allSelected ? (
          <CheckSquare className="w-4 h-4" />
        ) : (
          <Square className="w-4 h-4" />
        )}
        <span>{allSelected ? "Desselecionar todos" : "Selecionar todos"}</span>
      </button>
    ),
  };
}

// ─── Standalone checkbox for individual items ──────────────────────────────

interface ItemCheckboxProps {
  id: string;
  selected: boolean;
  onToggle: (id: string) => void;
}

export function ItemCheckbox({ id, selected, onToggle }: ItemCheckboxProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle(id);
      }}
      className={cn(
        "flex-shrink-0 w-5 h-5 rounded border transition-colors",
        selected
          ? "bg-brand border-brand text-white"
          : "border-border bg-transparent hover:border-border-2"
      )}
      title={selected ? "Desselecionar" : "Selecionar"}
    >
      {selected && (
        <svg viewBox="0 0 12 12" fill="none" className="w-full h-full p-0.5">
          <path
            d="M2 6l3 3 5-5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
