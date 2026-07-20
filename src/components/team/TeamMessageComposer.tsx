"use client"

import { useState, useTransition } from "react"
import { sendTeamMessage } from "@/lib/team/actions"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send } from "lucide-react"

interface TeamMessageComposerProps {
  staffId: string
  onSent: () => void
}

export function TeamMessageComposer({ staffId, onSent }: TeamMessageComposerProps) {
  const [text, setText] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleSend() {
    const trimmed = text.trim()
    if (!trimmed) return
    startTransition(async () => {
      await sendTeamMessage(staffId, trimmed)
      setText("")
      onSent()
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex gap-2 items-end pt-3 border-t border-border">
      <Textarea
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Mensagem para o colaborador…"
        className="resize-none min-h-[60px] max-h-[120px] text-sm"
        disabled={isPending}
        rows={2}
      />
      <Button
        size="icon"
        disabled={isPending || !text.trim()}
        onClick={handleSend}
        className="shrink-0 h-9 w-9 text-white"
        style={{ background: "var(--brand-grad)" }}
      >
        <Send className="w-3.5 h-3.5" />
      </Button>
    </div>
  )
}
