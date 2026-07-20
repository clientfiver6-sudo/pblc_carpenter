"use client"
import { useState } from "react"
import { Upload, X } from "lucide-react"
import { DocumentDropzone } from "@/components/onboarding/DocumentDropzone"
import { useRouter } from "next/navigation"

export function DocumentsUploadButton({ businessId }: { businessId: string }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  function handleComplete() {
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        style={{ background: "var(--brand-grad)" }}
      >
        <Upload className="w-3.5 h-3.5" />
        Enviar documento
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-ink">Enviar documento</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-ink-4 hover:text-ink transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <DocumentDropzone
              businessId={businessId}
              onComplete={handleComplete}
              onSkip={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}
