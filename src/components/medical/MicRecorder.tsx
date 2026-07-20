"use client"

import { useState, useRef, useCallback } from "react"
import { Mic, Square, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface SOAPResult {
  audioUrl: string
  transcript: string
  soap: { subjective: string; objective: string; assessment: string; plan_text: string }
}

interface MicRecorderProps {
  customerId: string
  workItemId?: string
  onResult: (result: SOAPResult) => void
  onError?: (msg: string) => void
}

type State = "idle" | "recording" | "processing"

export function MicRecorder({ customerId, workItemId, onResult, onError }: MicRecorderProps) {
  const [state, setState] = useState<State>("idle")
  const [seconds, setSeconds] = useState(0)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" })
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setState("processing")
        const blob = new Blob(chunksRef.current, { type: "audio/webm" })
        const fd = new FormData()
        fd.append("audio", blob, "recording.webm")
        fd.append("customerId", customerId)
        if (workItemId) fd.append("workItemId", workItemId)
        try {
          const res = await fetch("/api/medical/transcribe", { method: "POST", body: fd })
          const json = await res.json() as SOAPResult & { error?: string }
          if (!res.ok) throw new Error(json.error ?? "Falha na transcrição")
          onResult(json)
        } catch (err) {
          onError?.((err as Error).message)
        } finally {
          setState("idle")
          setSeconds(0)
        }
      }
      mr.start(1000)
      mediaRef.current = mr
      setState("recording")
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } catch {
      onError?.("Microfone não disponível. Verifique as permissões do navegador.")
    }
  }, [customerId, workItemId, onResult, onError])

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    mediaRef.current?.stop()
  }, [])

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`

  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-surface-2">
      {state === "idle" && (
        <Button type="button" onClick={startRecording} className="gap-2 h-9 px-4 text-sm font-semibold" style={{ background: "var(--brand-grad)", color: "#fff" }}>
          <Mic className="w-4 h-4" />
          Gravar consulta
        </Button>
      )}

      {state === "recording" && (
        <>
          <div className="flex items-center gap-2 flex-1">
            <span className="w-2.5 h-2.5 rounded-full bg-danger animate-pulse shrink-0" />
            <span className="text-sm font-mono text-danger font-semibold">{fmt(seconds)}</span>
            <span className="text-xs text-ink-3">Gravando...</span>
          </div>
          <Button type="button" variant="destructive" onClick={stopRecording} className="gap-2 h-9 px-4 text-sm">
            <Square className="w-3.5 h-3.5 fill-current" />
            Parar
          </Button>
        </>
      )}

      {state === "processing" && (
        <div className="flex items-center gap-2.5 text-sm text-ink-3">
          <Loader2 className="w-4 h-4 animate-spin text-brand" />
          <span>Transcrevendo e gerando nota SOAP...</span>
        </div>
      )}

      <span className={cn("text-xs text-ink-4 ml-auto", state !== "idle" && "hidden")}>
        Grava áudio → gera SOAP automaticamente
      </span>
    </div>
  )
}
