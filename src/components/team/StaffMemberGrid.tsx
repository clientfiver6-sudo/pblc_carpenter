"use client"

import { StaffTaskCard } from "@/components/team/StaffTaskCard"
import type { StaffWithStats } from "@/types/database"
import { Users } from "lucide-react"

interface StaffMemberGridProps {
  staff: StaffWithStats[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function StaffMemberGrid({ staff, selectedId, onSelect }: StaffMemberGridProps) {
  if (staff.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
        <Users className="w-10 h-10 text-ink-4" />
        <p className="text-ink-3 text-sm font-medium">Nenhum colaborador ativo</p>
        <p className="text-ink-4 text-xs">
          Adicione colaboradores em Equipe e Serviços ou peça ao RetornAI para adicionar.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {staff.map(member => (
        <StaffTaskCard
          key={member.id}
          staff={member}
          selected={selectedId === member.id}
          onClick={() => onSelect(member.id)}
        />
      ))}
    </div>
  )
}
