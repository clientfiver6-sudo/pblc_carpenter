"use client"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PrintButton() {
  return (
    <Button
      onClick={() => window.print()}
      variant="outline"
      size="sm"
      className="border border-border bg-surface text-ink-2 hover:bg-surface-2 rounded-md h-9 px-4 text-sm font-semibold gap-2 no-print"
    >
      <Printer className="w-4 h-4" />
      Imprimir
    </Button>
  )
}
