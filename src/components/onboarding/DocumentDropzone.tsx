"use client"
import { useState, useRef } from "react"
import { Upload, CheckCircle, Loader2 } from "lucide-react"

interface DocumentDropzoneProps {
  businessId: string
  onComplete: () => void
  onSkip: () => void
}

export function DocumentDropzone({ businessId, onComplete, onSkip }: DocumentDropzoneProps) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.set("file", file)
      form.set("businessId", businessId)
      await fetch("/api/documents/upload", { method: "POST", body: form })
      setUploaded(true)
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

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void uploadFile(file)
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm space-y-3 max-w-[85%]">
      <p className="text-sm text-gray-700 leading-relaxed">
        Quer que eu aprenda mais sobre o seu negócio? Solte aqui qualquer documento — tabela de preços, cardápio, portfólio.
      </p>

      {uploaded ? (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="w-4 h-4" />
          Documento enviado! Vou analisar logo.
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
            dragging ? "border-brand/60 bg-tint/30" : "border-gray-300 hover:border-brand/40"
          }`}
        >
          {uploading ? (
            <Loader2 className="w-6 h-6 mx-auto text-gray-300 animate-spin" />
          ) : (
            <>
              <Upload className="w-6 h-6 mx-auto mb-1.5 text-gray-300" />
              <p className="text-xs text-gray-500">PDF, Word, imagens ou texto</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
            className="hidden"
            onChange={handleInputChange}
          />
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSkip}
          className="flex-1 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Pular por agora
        </button>
        <button
          type="button"
          onClick={onComplete}
          className="flex-1 py-2 rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: "#25D366" }}
        >
          Concluir configuração
        </button>
      </div>
    </div>
  )
}
