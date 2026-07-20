"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { WorkItemEntryTabs } from "./WorkItemEntryTabs"
import type { WorkItemFormData } from "./WorkItemForm"
import { createWorkItem } from "@/lib/work-items/actions"
import type { Customer, Service, Staff } from "@/types/database"

interface NewWorkItemButtonProps {
  customers: Customer[]
  services: Service[]
  staff: Staff[]
  label: string
  initialOpen?: boolean
}

export function NewWorkItemButton({ customers, services, staff, label, initialOpen = false }: NewWorkItemButtonProps) {
  const [open, setOpen] = useState(initialOpen)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  async function handleSubmit(data: WorkItemFormData) {
    setSubmitting(true)
    try {
      await createWorkItem({
        customer_id: data.customer_id,
        service_id: data.service_id,
        assigned_staff_id: data.assigned_staff_id,
        title: data.title,
        scheduled_date: data.scheduled_date,
        scheduled_time: data.scheduled_time,
        address: data.address,
        price_estimate: data.price_estimate,
        notes: data.notes,
      })
      setOpen(false)
      const dateStr = data.scheduled_date
        ? data.scheduled_date.toISOString().slice(0, 10)
        : null
      router.push(dateStr ? `/dashboard/calendar?date=${dateStr}` : "/dashboard/calendar")
    } catch {
      // error is surfaced inside the form
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="text-white font-semibold gap-2 hover:opacity-90"
        style={{ background: "var(--brand-grad)" }}
      >
        <Plus className="h-4 w-4" />
        Novo {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-surface border-border text-ink max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-ink">Novo {label}</DialogTitle>
          </DialogHeader>
          <WorkItemEntryTabs
            onSubmit={handleSubmit}
            customers={customers}
            services={services}
            staff={staff}
            isLoading={submitting}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
