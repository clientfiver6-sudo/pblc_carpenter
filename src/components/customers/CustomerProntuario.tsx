"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import {
  uploadCustomerAttachment,
  deleteCustomerAttachment,
  getCustomerAttachments,
} from "@/lib/customers/attachments";
import type { CustomerAttachment, WorkItem } from "@/types/database";
import {
  Lock,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Trash2,
  Upload,
  FileText,
  Image as ImageIcon,
  File,
  Loader2,
  Calendar,
} from "lucide-react";

interface CustomerProntuarioProps {
  customerId: string;
}

// ─── Work item record metadata shape ─────────────────────────────────────────

interface WorkItemRecord {
  findings?: string;
  procedure?: string;
  materials?: string;
  instructions?: string;
  followUp?: string;
}

interface WorkItemMeta {
  record?: WorkItemRecord;
  [key: string]: unknown;
}

// ─── Badge maps (reuse same labels as timeline) ───────────────────────────────

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "moss"
  | "amber"
  | "warm"
  | "info";

const STATUS_LABELS: Record<string, string> = {
  new: "Novo",
  scheduled: "Agendado",
  pending_confirmation: "Aguardando",
  confirmed: "Confirmado",
  in_progress: "Em andamento",
  waiting_customer: "Aguardando cliente",
  waiting_parts: "Aguardando peças",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  new: "info",
  scheduled: "info",
  pending_confirmation: "amber",
  confirmed: "warm",
  in_progress: "info",
  waiting_customer: "amber",
  waiting_parts: "amber",
  completed: "moss",
  cancelled: "destructive",
  no_show: "destructive",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fileIcon(type: string) {
  if (type.startsWith("image/"))
    return <ImageIcon className="w-4 h-4 shrink-0 text-brand" />;
  if (type === "application/pdf")
    return <FileText className="w-4 h-4 shrink-0 text-danger" />;
  return <File className="w-4 h-4 shrink-0 text-ink-3" />;
}

function recordLabel(key: keyof WorkItemRecord): string {
  const map: Record<keyof WorkItemRecord, string> = {
    findings: "Achados",
    procedure: "Procedimento",
    materials: "Materiais",
    instructions: "Instruções",
    followUp: "Retorno",
  };
  return map[key];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function WorkItemEntry({ item }: { item: WorkItem }) {
  const [open, setOpen] = useState(false);

  const meta = (
    item.metadata &&
    typeof item.metadata === "object" &&
    !Array.isArray(item.metadata)
      ? (item.metadata as WorkItemMeta)
      : {}
  );

  const record = meta.record;
  const hasRecord =
    record &&
    Object.values(record).some((v) => typeof v === "string" && v.trim());
  const hasNotes =
    typeof item.internal_notes === "string" && item.internal_notes.trim();
  const hasDetails = hasNotes || hasRecord;

  const dateStr = item.scheduled_start ?? item.created_at;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-ink-3 font-mono">
              {formatDate(dateStr)}
            </span>
            <Badge
              variant={STATUS_VARIANTS[item.status] ?? "secondary"}
              className="text-[10px] px-1.5 py-0"
            >
              {STATUS_LABELS[item.status] ?? item.status}
            </Badge>
          </div>
          <p className="text-sm font-semibold text-ink mt-1 truncate">
            {item.title}
          </p>
          {item.description && (
            <p className="text-xs text-ink-3 mt-0.5 line-clamp-1">
              {item.description}
            </p>
          )}
        </div>
        {hasDetails && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 p-1 rounded-md hover:bg-surface-2 text-ink-3 hover:text-ink transition-colors"
            aria-label={open ? "Recolher detalhes" : "Expandir detalhes"}
          >
            {open ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Inline preview: lock icon for internal notes */}
      {hasNotes && !open && (
        <div className="flex items-center gap-1.5 text-xs text-ink-3">
          <Lock className="w-3 h-3 shrink-0" />
          <span className="truncate">{item.internal_notes}</span>
        </div>
      )}

      {/* Expanded details */}
      {open && hasDetails && (
        <div className="pt-2 border-t border-border space-y-3">
          {hasNotes && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-ink-3" />
                <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
                  Notas internas
                </p>
              </div>
              <p className="text-sm text-ink whitespace-pre-wrap bg-surface-2 rounded-lg p-3">
                {item.internal_notes}
              </p>
            </div>
          )}

          {hasRecord && record && (
            <div className="space-y-2">
              {(
                [
                  "findings",
                  "procedure",
                  "materials",
                  "instructions",
                  "followUp",
                ] as Array<keyof WorkItemRecord>
              )
                .filter(
                  (k) =>
                    typeof record[k] === "string" &&
                    (record[k] as string).trim()
                )
                .map((k) => (
                  <div key={k} className="space-y-0.5">
                    <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
                      {recordLabel(k)}
                    </p>
                    <p className="text-sm text-ink whitespace-pre-wrap bg-surface-2 rounded-lg p-3">
                      {record[k]}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Attachments section ──────────────────────────────────────────────────────

interface AttachmentsSectionProps {
  customerId: string;
  initialAttachments: CustomerAttachment[];
}

function AttachmentsSection({
  customerId,
  initialAttachments,
}: AttachmentsSectionProps) {
  const [attachments, setAttachments] =
    useState<CustomerAttachment[]>(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("customer_id", customerId);

    try {
      const result = await uploadCustomerAttachment(fd);
      if (result.error) {
        setUploadError(result.error);
      } else if (result.attachment) {
        setAttachments((prev) => [result.attachment!, ...prev]);
      }
    } catch {
      setUploadError("Erro inesperado ao enviar arquivo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleDelete(id: string) {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteCustomerAttachment(id);
      if (result.error) {
        setUploadError(result.error);
      } else {
        setAttachments((prev) => prev.filter((a) => a.id !== id));
      }
      setDeletingId(null);
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-ink-3" />
          <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
            Anexos
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 text-xs font-medium text-brand hover:text-brand-2 transition-colors disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
          {uploading ? "Enviando..." : "Adicionar"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx"
          className="hidden"
          onChange={handleFileChange}
          aria-label="Selecionar arquivo para upload"
        />
      </div>

      {uploadError && (
        <p className="text-xs text-danger">{uploadError}</p>
      )}

      {attachments.length === 0 ? (
        <p className="text-sm text-ink-3 text-center py-4">
          Nenhum anexo ainda
        </p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 group"
            >
              {fileIcon(a.file_type)}
              <a
                href={a.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 text-sm text-ink hover:text-brand truncate transition-colors"
              >
                {a.file_name}
              </a>
              <span className="text-xs text-ink-4 shrink-0">
                {formatDate(a.uploaded_at)}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(a.id)}
                disabled={deletingId === a.id}
                aria-label={`Excluir ${a.file_name}`}
                className="shrink-0 p-1 rounded hover:bg-surface text-ink-4 hover:text-danger transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
              >
                {deletingId === a.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CustomerProntuario({ customerId }: CustomerProntuarioProps) {
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [attachments, setAttachments] = useState<CustomerAttachment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = createClient();

      const [workItemsRes, attachmentsData] = await Promise.all([
        supabase
          .from("work_items")
          .select("*")
          .eq("customer_id", customerId)
          .order("scheduled_start", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(100),
        getCustomerAttachments(customerId),
      ]);

      if (cancelled) return;

      setWorkItems((workItemsRes.data as WorkItem[] | null) ?? []);
      setAttachments(attachmentsData);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl bg-surface-2" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Attachments at top */}
      <AttachmentsSection
        customerId={customerId}
        initialAttachments={attachments}
      />

      {/* Visit records */}
      {workItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-ink-3">
          <Calendar className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-sm">Nenhum atendimento registrado ainda</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workItems.map((item) => (
            <WorkItemEntry key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// Export types needed by parent
export type { CustomerAttachment };
