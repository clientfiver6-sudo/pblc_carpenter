"use client"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { WorkItemAIEntry } from "./WorkItemAIEntry"
import { WorkItemForm, type WorkItemFormData } from "./WorkItemForm"
import type { Customer, Service, Staff } from "@/types/database"

// Fields the AI can extract — scheduled_date is a string here, converted before passing to form
interface AIExtractedFields {
  customer_id?: string
  service_id?: string
  assigned_staff_id?: string
  scheduled_date?: string  // YYYY-MM-DD
  scheduled_time?: string  // HH:MM
  title?: string
  price_estimate?: number
  notes?: string
}

interface WorkItemEntryTabsProps {
  onSubmit: (data: WorkItemFormData) => void | Promise<void>
  customers: Customer[]
  services: Service[]
  staff: Staff[]
  openingHours?: Record<string, unknown>
  defaultValues?: Partial<WorkItemFormData>
  isLoading?: boolean
}

export function WorkItemEntryTabs({
  onSubmit,
  customers,
  services,
  staff,
  openingHours,
  defaultValues,
  isLoading = false,
}: WorkItemEntryTabsProps) {
  const [activeTab, setActiveTab] = useState<"manual" | "ai">("manual")
  const [aiDefaults, setAiDefaults] = useState<Partial<WorkItemFormData> | undefined>(defaultValues)

  function handleAIFill(fields: AIExtractedFields) {
    // Convert YYYY-MM-DD string to Date object for the form
    const converted: Partial<WorkItemFormData> = {
      ...(fields.customer_id ? { customer_id: fields.customer_id } : {}),
      ...(fields.service_id ? { service_id: fields.service_id } : {}),
      ...(fields.assigned_staff_id ? { assigned_staff_id: fields.assigned_staff_id } : {}),
      ...(fields.scheduled_date
        ? { scheduled_date: new Date(`${fields.scheduled_date}T12:00:00`) }
        : {}),
      ...(fields.scheduled_time ? { scheduled_time: fields.scheduled_time } : {}),
      ...(fields.title ? { title: fields.title } : {}),
      ...(fields.price_estimate != null ? { price_estimate: fields.price_estimate } : {}),
      ...(fields.notes ? { notes: fields.notes } : {}),
    }
    setAiDefaults(converted)
    setActiveTab("manual")
  }

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex bg-surface-2 rounded-md p-1 gap-1 mb-5">
        <button
          type="button"
          onClick={() => setActiveTab("manual")}
          className={cn(
            "flex-1 py-2 rounded text-sm text-center cursor-pointer transition-[color,background-color,box-shadow] duration-150 ease-brand-out",
            activeTab === "manual"
              ? "font-semibold bg-surface text-ink"
              : "text-ink-3 hover:text-ink-2"
          )}
          style={activeTab === "manual" ? { boxShadow: 'var(--shadow-1)' } : undefined}
        >
          Preencher manualmente
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ai")}
          className={cn(
            "flex-1 py-2 rounded text-sm text-center cursor-pointer transition-[color,background-color,box-shadow] duration-150 ease-brand-out",
            activeTab === "ai"
              ? "font-semibold bg-surface text-ink"
              : "text-ink-3 hover:text-ink-2"
          )}
          style={activeTab === "ai" ? { boxShadow: 'var(--shadow-1)' } : undefined}
        >
          <span className="text-brand">✦</span> Descrever com IA
        </button>
      </div>

      {activeTab === "ai" ? (
        <WorkItemAIEntry
          customers={customers.map(c => ({
            id: c.id,
            full_name: c.full_name,
            phone_number: c.phone_number ?? null,
          }))}
          services={services.map(s => ({
            id: s.id,
            name: s.name,
            price: s.price ?? null,
          }))}
          staff={staff.map(m => ({
            id: m.id,
            name: m.name,
            role: m.role ?? null,
          }))}
          openingHours={openingHours}
          onFill={handleAIFill}
        />
      ) : (
        <WorkItemForm
          onSubmit={onSubmit}
          customers={customers}
          services={services}
          staff={staff}
          defaultValues={aiDefaults}
          isLoading={isLoading}
        />
      )}
    </div>
  )
}
