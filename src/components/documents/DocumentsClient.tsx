"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  FileText, FileImage, File, Upload, Download, Trash2, Loader2,
  X, Sparkles, Clock,
} from "lucide-react"

export interface BusinessDocument {
  id: string
  file_name: string
  file_url: string
  file_type: string
  storage_path: string | null
  uploaded_at: string
  analyzed: boolean
  title: string | null
  description: string | null
  category: string | null
}

const CATEGORY_META: Record<string, { label: string; cls: string }> = {
  preco:         { label: "Tabela de Preços",  cls: "bg-brand/10 text-brand border-brand/25" },
  cardapio:      { label: "Cardápio",          cls: "bg-moss/10 text-moss border-moss/25" },
  contrato:      { label: "Contrato",          cls: "bg-warning/10 text-warning border-warning/25" },
  manual:        { label: "Manual",            cls: "bg-blue-500/10 text-blue-600 border-blue-500/25" },
  portfolio:     { label: "Portfólio",         cls: "bg-pink-500/10 text-pink-600 border-pink-500/25" },
  relatorio:     { label: "Relatório",         cls: "bg-purple-500/10 text-purple-600 border-purple-500/25" },
  ficha_tecnica: { label: "Ficha Técnica",     cls: "bg-teal-500/10 text-teal-600 border-teal-500/25" },
  outro:         { label: "Documento",         cls: "bg-surface-2 text-ink-3 border-border" },
}

function categoryMeta(cat: string | null) {
  return CATEGORY_META[cat ?? "outro"] ?? CATEGORY_META.outro
}

function FileIcon({ type }: { type: string }) {
  if (type.startsWith("image/")) return <FileImage className="w-5 h-5 text-ink-3 shrink-0" />
  if (type.includes("pdf") || type.includes("word") || type.includes("text"))
    return <FileText className="w-5 h-5 text-ink-3 shrink-0" />
  return <File className="w-5 h-5 text-ink-3 shrink-0" />
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
}

interface Props {
  businessId: string
  initialDocs: BusinessDocument[]
}

export function DocumentsClient({ businessId, initialDocs }: Props) {
  const router = useRouter()
  const [docs, setDocs] = useState<BusinessDocument[]>(initialDocs)

  // Sync when server re-fetches after router.refresh()
  useEffect(() => { setDocs(initialDocs) }, [initialDocs])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.set("file", file)
      form.set("businessId", businessId)
      await fetch("/api/documents/upload", { method: "POST", body: form })
      router.refresh()
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void uploadFile(file)
  }

  async function deleteDoc(id: string) {
    setDeletingId(id)
    try {
      await fetch(`/api/documents/${id}`, { method: "DELETE" })
      setDocs(prev => prev.filter(d => d.id !== id))
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl px-6 py-7 text-center cursor-pointer transition-[border-color,background-color,transform] duration-150 ease-brand-out
          ${dragging ? "border-brand/60 bg-tint/30 scale-[1.01]" : "border-border hover:border-brand/40 hover:bg-surface-2/40"}
        `}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 text-brand animate-spin" />
            <p className="text-sm text-ink-3">Enviando e classificando...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-6 h-6 text-ink-4" />
            <p className="text-sm text-ink-2 font-medium">Solte um arquivo aqui ou clique para selecionar</p>
            <p className="text-xs text-ink-4">PDF, Word, imagens ou texto — a IA classifica automaticamente</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) void uploadFile(f) }}
        />
      </div>

      {/* Stored documents section */}
      <div className="flex items-center gap-3 pt-2">
        <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider">Documentos armazenados</p>
        {docs.length > 0 && (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-surface-2 border border-border text-[10px] font-bold text-ink-3">
            {docs.length}
          </span>
        )}
        <div className="flex-1 h-px bg-border" />
      </div>

      {docs.length === 0 ? (
        <div className="text-center py-10">
          <FileText className="w-9 h-9 text-ink-4 mx-auto mb-3" />
          <p className="text-sm text-ink-3">Nenhum documento ainda.</p>
          <p className="text-xs text-ink-4 mt-1">Envie tabelas de preços, cardápios ou portfólios.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => {
            const cat = categoryMeta(doc.category)
            const title = doc.title ?? doc.file_name
            return (
              <div
                key={doc.id}
                className="bg-surface border border-border rounded-xl p-4 flex items-start gap-3 hover:border-brand/25 transition-colors"
              >
                <FileIcon type={doc.file_type} />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-ink leading-snug">{title}</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cat.cls}`}>
                      {cat.label}
                    </span>
                    {!doc.analyzed && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-warning/10 text-warning border-warning/25">
                        <Clock className="w-2.5 h-2.5" />
                        Classificando
                      </span>
                    )}
                    {doc.analyzed && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-tint text-brand border-brand/20">
                        <Sparkles className="w-2.5 h-2.5" />
                        IA
                      </span>
                    )}
                  </div>
                  {doc.description && (
                    <p className="text-xs text-ink-3 leading-relaxed">{doc.description}</p>
                  )}
                  <p className="text-xs text-ink-4">{fmtDate(doc.uploaded_at)}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={doc.file_url}
                    download={doc.file_name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-md text-ink-4 hover:text-brand hover:bg-tint/50 transition-colors"
                    title="Baixar"
                  >
                    <Download className="w-4 h-4" />
                  </a>

                  {confirmDeleteId === doc.id ? (
                    <div className="flex items-center gap-1.5 bg-surface-2 border border-danger/30 rounded-lg px-2 py-1">
                      <span className="text-xs text-ink-3">Excluir?</span>
                      <button
                        onClick={() => void deleteDoc(doc.id)}
                        disabled={deletingId === doc.id}
                        className="text-xs font-semibold text-danger hover:text-danger/80 transition-colors"
                      >
                        {deletingId === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Sim"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-ink-4 hover:text-ink-2 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(doc.id)}
                      className="p-1.5 rounded-md text-ink-4 hover:text-danger hover:bg-danger/5 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
