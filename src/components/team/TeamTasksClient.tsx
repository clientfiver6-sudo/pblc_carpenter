"use client"

import { useState } from "react"
import { StaffMemberGrid } from "@/components/team/StaffMemberGrid"
import { TeamDetailPanel } from "@/components/team/TeamDetailPanel"
import type { StaffWithStats, WorkItemWithRelations } from "@/types/database"
import { AlertCircle } from "lucide-react"

interface TeamTasksClientProps {
  staff: StaffWithStats[]
  unassignedItems: WorkItemWithRelations[]
  userId: string
}

export function TeamTasksClient({ staff, unassignedItems, userId }: TeamTasksClientProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedStaff = staff.find(s => s.id === selectedId) ?? null

  function handleSelect(id: string) {
    setSelectedId(prev => prev === id ? null : id)
  }

  function handleClose() {
    setSelectedId(null)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 md:px-8 py-4 border-b border-border shrink-0">
        <div>
          <h2 className="text-xl font-bold text-ink tracking-tight">Instruções de Time</h2>
          <p className="text-ink-4 text-xs mt-0.5">Distribua tarefas entre os colaboradores · {staff.length} ativo{staff.length !== 1 ? "s" : ""}</p>
        </div>
        {unassignedItems.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-warning/30 bg-warning/10 text-warning font-medium">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {unassignedItems.length} sem responsável
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: member grid */}
        <div className={`
          ${selectedStaff ? "hidden md:block" : "block"}
          w-full md:w-[360px] md:shrink-0
          border-r border-border overflow-y-auto
          px-4 py-4 space-y-0
        `}>
          <StaffMemberGrid
            staff={staff}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        </div>

        {/* Right: detail panel */}
        {selectedStaff ? (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <TeamDetailPanel
              staff={selectedStaff}
              unassignedItems={unassignedItems}
              userId={userId}
              onClose={handleClose}
            />
          </div>
        ) : (
          <div className="flex-1 hidden md:flex items-center justify-center flex-col gap-3 text-center px-8">
            <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center border border-border">
              <span className="text-2xl">👥</span>
            </div>
            <div>
              <p className="text-ink-3 text-sm font-medium">Selecione um colaborador</p>
              <p className="text-ink-4 text-xs mt-1">Ver tarefas e enviar mensagens para o colaborador.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
