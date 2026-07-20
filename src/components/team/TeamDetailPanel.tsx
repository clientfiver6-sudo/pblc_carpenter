"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TaskAssignmentTab } from "@/components/team/TaskAssignmentTab"
import { TeamMessageThread } from "@/components/team/TeamMessageThread"
import type { StaffWithStats, WorkItemWithRelations } from "@/types/database"
import { X } from "lucide-react"

interface TeamDetailPanelProps {
  staff: StaffWithStats
  unassignedItems: WorkItemWithRelations[]
  userId: string
  onClose: () => void
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map(w => w[0])
    .join("")
    .toUpperCase()
}

export function TeamDetailPanel({ staff, unassignedItems, userId, onClose }: TeamDetailPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
          style={{ background: staff.color }}
        >
          {getInitials(staff.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-ink font-semibold text-sm truncate">{staff.name}</p>
          {staff.role && <p className="text-ink-4 text-xs truncate">{staff.role}</p>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-ink-4">Em aberto</p>
            <p className="text-sm font-semibold text-ink">{staff.assigned_items.length} tarefas</p>
          </div>
          <button
            onClick={onClose}
            className="text-ink-3 hover:text-ink transition-colors p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tasks" className="flex-1 flex flex-col min-h-0">
        <TabsList className="shrink-0 mx-5 mt-3 mb-0 w-auto justify-start bg-surface-2 border border-border p-0.5 rounded-lg h-9">
          <TabsTrigger value="tasks" className="text-xs h-7 px-3 rounded-md data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-sm">
            Tarefas
          </TabsTrigger>
          <TabsTrigger value="messages" className="text-xs h-7 px-3 rounded-md data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-sm">
            Mensagens
            {staff.unread_messages > 0 && (
              <span className="ml-1.5 text-[9px] font-bold px-1 py-0.5 rounded-full bg-brand text-white min-w-[14px] text-center">
                {staff.unread_messages}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="flex-1 overflow-y-auto px-5 py-4 mt-0">
          <TaskAssignmentTab staff={staff} unassignedItems={unassignedItems} />
        </TabsContent>

        <TabsContent value="messages" className="flex-1 flex flex-col min-h-0 px-5 py-4 mt-0">
          <TeamMessageThread staffId={staff.id} staffName={staff.name} userId={userId} />
        </TabsContent>

      </Tabs>
    </div>
  )
}
