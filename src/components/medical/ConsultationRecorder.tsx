"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Mic, Square, Loader2, Save, RotateCcw, AlertCircle } from "lucide-react"

type State = "idle" | "recording" | "processing" | "done"

interface SOAPDraft {
  transcript: string
  subjective: string
  objective: string
  assessment: string
  plan_text: string
  audio_url?: string
}

interface ConsultationRecorderProps {
  customerId: string
  onSaved: () => void
}

const SOAP_LABELS: Record<keyof Omit<SOAPDraft, "transcript" | "audio_url">, string> = {
  subjective: "S — Subjetivo (queixas e história)",
  objective: "O — Objetivo (exame físico, sinais vitais)",
  assessment: "A — Avaliação (diagnóstico / hipótese)",
  plan_text: "P — Plano (conduta e tratamento)",
}

const MAX_BYTES = 50 * 1024 * 1024

function formatTime(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0")
  const sec = (s % 60).toString().padStart(2, "0")
  return `${m}:${sec}`
}

export function ConsultationRecorder({ customerId, onSaved }: ConsultationRecorderProps) {
  const [state, setState] = useState<State>("idle")
  const [draft, setDraft] = useState<SOAPDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [saving, setSaving] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Check MediaRecorder support
  const supported = typeof window !== "undefined" && !!window.MediaRecorder

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/ogg")
          ? "audio/ogg"
          : ""

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" })
        if (blob.size > MAX_BYTES) {
          setError("Gravação muito grande (máx 50 MB). Grave em partes menores.")
          setState("idle")
          return
        }
        await processAudio(blob, recorder.mimeType)
      }

      recorder.start(1000)
      recorderRef.current = recorder
      setElapsed(0)
      setState("recording")
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    } catch {
      setError("Não foi possível acessar o microfone.")
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    recorderRef.current?.stop()
    setState("processing")
  }, [])

  async function processAudio(blob: Blob, mimeType: string) {
    try {
      const fd = new FormData()
      const ext = mimeType.includes("ogg") ? "ogg" : "webm"
      fd.append("audio", blob, `recording.${ext}`)
      const res = await fetch("/api/medical/transcribe", { method: "POST", body: fd })
      const json = await res.json() as SOAPDraft & { error?: string }
      if (json.error) throw new Error(json.error)
      setDraft(json)
      setState("done")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao processar gravação.")
      setState("idle")
    }
  }

  async function handleSave() {
    if (!draft) return
    setSaving(true)
    try {
      const res = await fetch("/api/medical/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId, ...draft }),
      })
      if (!res.ok) throw new Error("Erro ao salvar")
      setState("idle")
      setDraft(null)
      onSaved()
    } catch {
      setError("Erro ao salvar nota.")
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setState("idle")
    setDraft(null)
    setError(null)
    setElapsed(0)
  }

  if (!supported) {
    return (
      <div className="rounded-xl border border-border bg-surface-2 p-4 flex items-start gap-3 text-sm text-ink-3">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-warning" />
        <span>Gravação de áudio não suportada neste navegador. Use Chrome ou Firefox.</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="rounded-xl border border-border bg-surface p-4 flex items-center gap-3">
        {state === "idle" && (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: "var(--brand-grad)" }}
          >
            <Mic className="w-4 h-4" />
            Iniciar Consulta
          </button>
        )}

        {state === "recording" && (
          <>
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-danger text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Square className="w-4 h-4" />
              Parar
            </button>
            <div className="flex items-center gap-2 text-sm text-danger font-mono">
              <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
              {formatTime(elapsed)}
            </div>
          </>
        )}

        {state === "processing" && (
          <div className="flex items-center gap-2 text-sm text-ink-3">
            <Loader2 className="w-4 h-4 animate-spin" />
            Transcrevendo e gerando SOAP...
          </div>
        )}

        {state === "done" && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-60 transition-opacity hover:opacity-90"
              style={{ background: "var(--brand-grad)" }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Nota
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-ink-3 hover:text-ink transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Descartar
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Transcript + SOAP edit */}
      {draft && (
        <div className="space-y-3">
          {draft.transcript && (
            <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
              <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Transcrição</p>
              <p className="text-sm text-ink-3 whitespace-pre-wrap leading-relaxed">{draft.transcript}</p>
            </div>
          )}

          {(Object.keys(SOAP_LABELS) as Array<keyof typeof SOAP_LABELS>).map((key) => (
            <div key={key} className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">{SOAP_LABELS[key]}</label>
              <textarea
                rows={3}
                value={draft[key]}
                onChange={(e) => setDraft(d => d ? { ...d, [key]: e.target.value } : d)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/40 resize-y"
                placeholder={`${SOAP_LABELS[key]}...`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
