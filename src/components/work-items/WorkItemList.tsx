"use client"

import { useState, useMemo, useTransition } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { WorkItemCard } from "@/components/work-items/WorkItemCard"
import { WorkItemDetail } from "@/components/work-items/WorkItemDetail"
import { ItemCheckbox } from "@/components/work-items/BulkStatusUpdate"
import { bulkUpdateStatus } from "@/lib/work-items/bulk-actions"
import { getBusinessConfig, type BusinessType } from "@/lib/config/business-types"
import type { WorkItemWithRelations, WorkItemStatus } from "@/types/database"
import { CheckSquare, Square, CheckCircle2, XCircle, Loader2, Search } from "lucide-react"
import { getEffectiveStatus } from "@/lib/work-items/effective-status"

type SortKey = "scheduled" | "created"

// Status groups for filter tabs
const ACTIVE_STATUSES: WorkItemStatus[] = ["new", "scheduled", "pending_confirmation", "confirmed"]
const IN_PROGRESS_STATUSES: WorkItemStatus[] = ["in_progress", "waiting_customer", "waiting_parts"]
const COMPLETED_STATUSES: WorkItemStatus[] = ["completed"]
const CANCELLED_STATUSES: WorkItemStatus[] = ["cancelled", "no_show"]

function filterByTab(
  items: WorkItemWithRelations[],
  tab: string
): WorkItemWithRelations[] {
  switch (tab) {
    case "active":
      return items.filter((i) => ACTIVE_STATUSES.includes(i.status))
    case "in_progress":
      return items.filter((i) => IN_PROGRESS_STATUSES.includes(i.status))
    case "completed":
      return items.filter((i) => COMPLETED_STATUSES.includes(i.status))
    case "cancelled":
      return items.filter((i) => CANCELLED_STATUSES.includes(i.status))
    default:
      return items.filter((i) => !CANCELLED_STATUSES.includes(i.status))
  }
}

function sortItems(
  items: WorkItemWithRelations[],
  sort: SortKey
): WorkItemWithRelations[] {
  return [...items].sort((a, b) => {
    if (sort === "scheduled") {
      const aTime = a.scheduled_start ? new Date(a.scheduled_start).getTime() : Infinity
      const bTime = b.scheduled_start ? new Date(b.scheduled_start).getTime() : Infinity
      return aTime - bTime
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full bg-surface-2" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2 bg-surface-2" />
          <Skeleton className="h-3 w-1/3 bg-surface-2" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full bg-surface-2" />
      </div>
      <Skeleton className="h-3 w-2/3 bg-surface-2" />
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  tab,
  workItemLabel,
}: {
  tab: string
  workItemLabel: string
}) {
  const messages: Record<string, string> = {
    all: `Nenhum ${workItemLabel.toLowerCase()} encontrado. Crie um novo para começar.`,
    active: `Nenhum ${workItemLabel.toLowerCase()} ativo no momento.`,
    in_progress: `Nenhum ${workItemLabel.toLowerCase()} em andamento.`,
    completed: `Nenhum ${workItemLabel.toLowerCase()} concluído ainda.`,
    cancelled: `Nenhum ${workItemLabel.toLowerCase()} cancelado.`,
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-12 w-12 rounded-full bg-surface-2 flex items-center justify-center mb-4">
      </div>
      <p className="text-ink-3 text-sm max-w-xs">
        {messages[tab] ?? messages.all}
      </p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface WorkItemListProps {
  items: WorkItemWithRelations[]
  businessType: BusinessType
  businessId?: string
  loading?: boolean
}

export function WorkItemList({ items, businessType, businessId, loading = false }: WorkItemListProps) {
  const [activeTab, setActiveTab] = useState("all")
  const [sort, setSort] = useState<SortKey>("scheduled")
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [bulkError, setBulkError] = useState<string | null>(null)

  const config = getBusinessConfig(businessType)

  const displayedItems = useMemo(() => {
    const now = new Date()
    const enriched = items.map((i) => ({ ...i, status: getEffectiveStatus(i, now) }))
    const tabFiltered = sortItems(filterByTab(enriched, activeTab), sort)
    if (!search.trim()) return tabFiltered
    const q = search.toLowerCase()
    return tabFiltered.filter((i) =>
      i.customer?.full_name?.toLowerCase().includes(q) ||
      i.service?.name?.toLowerCase().includes(q) ||
      i.title?.toLowerCase().includes(q)
    )
  }, [items, activeTab, sort, search])

  const allDisplayedIds = useMemo(() => displayedItems.map((i) => i.id), [displayedItems])
  const allSelected = allDisplayedIds.length > 0 && allDisplayedIds.every((id) => selectedItemIds.has(id))
  const someSelected = selectedItemIds.size > 0

  const handleCardClick = (id: string) => {
    setSelectedId(id)
    setDetailOpen(true)
  }

  function toggleOne(id: string) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedItemIds(new Set())
    } else {
      setSelectedItemIds(new Set(allDisplayedIds))
    }
  }

  function handleBulkUpdate(status: WorkItemStatus) {
    if (!businessId) return
    setBulkError(null)
    const ids = Array.from(selectedItemIds)
    startTransition(async () => {
      try {
        await bulkUpdateStatus(ids, status, businessId)
        setSelectedItemIds(new Set())
      } catch (err) {
        setBulkError(err instanceof Error ? err.message : "Erro ao atualizar.")
      }
    })
  }

  return (
    <>
      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-4 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cliente, serviço ou título..."
          className="w-full pl-9 pr-4 h-10 rounded-lg border border-border bg-surface text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-4 hover:text-ink-2 text-xs"
          >
            ✕
          </button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(t) => { setActiveTab(t); setSelectedItemIds(new Set()) }} className="w-full">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <TabsList className="bg-surface border border-border p-1 h-auto flex-wrap">
            <TabsTrigger
              value="all"
              className="text-xs data-[state=active]:bg-ink data-[state=active]:text-white text-ink-2 hover:bg-surface-2"
            >
              Todos
            </TabsTrigger>
            <TabsTrigger
              value="active"
              className="text-xs data-[state=active]:bg-ink data-[state=active]:text-white text-ink-2 hover:bg-surface-2"
            >
              Ativos
            </TabsTrigger>
            <TabsTrigger
              value="in_progress"
              className="text-xs data-[state=active]:bg-ink data-[state=active]:text-white text-ink-2 hover:bg-surface-2"
            >
              Em Andamento
            </TabsTrigger>
            <TabsTrigger
              value="completed"
              className="text-xs data-[state=active]:bg-ink data-[state=active]:text-white text-ink-2 hover:bg-surface-2"
            >
              Concluídos
            </TabsTrigger>
          </TabsList>

          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-40 border-border bg-surface text-ink-2 text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-surface border-border">
              <SelectItem value="scheduled" className="text-ink text-xs">
                Mais próximos
              </SelectItem>
              <SelectItem value="created" className="text-ink text-xs">
                Mais recentes
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Select-all row (only shown when businessId provided) */}
        {businessId && displayedItems.length > 0 && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <button
              type="button"
              onClick={toggleAll}
              className={cn(
                "flex items-center gap-1.5 text-xs transition-colors",
                allSelected ? "text-brand" : "text-ink-3 hover:text-ink-2"
              )}
            >
              {allSelected ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              {allSelected ? "Desselecionar todos" : "Selecionar todos"}
            </button>
          </div>
        )}

        {/* Content */}
        {(["all", "active", "in_progress", "completed"] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-0">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : displayedItems.length === 0 ? (
              <EmptyState tab={tab} workItemLabel={config.workItemLabel} />
            ) : (
              <div className="space-y-3">
                {displayedItems.map((item) => (
                  <div key={item.id} className="flex items-start gap-2">
                    {/* Checkbox — only when businessId provided */}
                    {businessId && (
                      <div className="mt-4">
                        <ItemCheckbox
                          id={item.id}
                          selected={selectedItemIds.has(item.id)}
                          onToggle={toggleOne}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <WorkItemCard
                        item={item}
                        businessType={businessType}
                        onClick={() => handleCardClick(item.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Detail sheet */}
      <WorkItemDetail
        workItemId={selectedId}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />

      {/* Floating bulk action bar */}
      {someSelected && businessId && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-3 bg-ink text-white rounded-xl shadow-3 px-5 py-3">
            <span className="text-sm text-white/80 font-mono whitespace-nowrap">
              {selectedItemIds.size} selecionado{selectedItemIds.size !== 1 ? "s" : ""}
            </span>
            <div className="w-px h-5 bg-white/20" />
            <Button
              size="sm"
              onClick={() => handleBulkUpdate("completed")}
              disabled={isPending}
              className="gap-1.5 bg-tint text-brand border border-brand/30 hover:bg-tint/80 h-8 text-white hover:text-ink-4"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Concluir todos
            </Button>
            <Button
              size="sm"
              onClick={() => handleBulkUpdate("cancelled")}
              disabled={isPending}
              className="gap-1.5 bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 h-8 text-white hover:text-ink-4"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              Cancelar todos
            </Button>
            {bulkError && <span className="text-xs text-danger">{bulkError}</span>}
          </div>
        </div>
      )}
    </>
  )
}
