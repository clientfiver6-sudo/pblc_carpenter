"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn, formatCurrency } from "@/lib/utils"
import type { Service } from "@/types/database"
import { Clock, Edit, Trash2 } from "lucide-react"

interface ServiceCardProps {
  service: Service
  onEdit?: () => void
  onDelete?: () => void
}

export function ServiceCard({ service, onEdit, onDelete }: ServiceCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  // price in DB is decimal BRL — multiply by 100 for formatCurrency
  const priceDisplay = service.price != null
    ? formatCurrency(Math.round(service.price * 100))
    : null

  const priceMaxDisplay = service.price_max != null
    ? formatCurrency(Math.round(service.price_max * 100))
    : null

  return (
    <Card className="bg-surface border border-border hover:shadow-2 hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200 ease-brand-out">
      <CardContent className="px-5 pb-5 pt-5">
        <div className="flex items-start justify-between gap-2 mt-4">
          {/* Name + active dot */}
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn(
                "h-2 w-2 rounded-full shrink-0",
                service.active ? "bg-brand" : "bg-ink-4"
              )}
            />
            <h3 className="font-bold text-sm text-ink leading-tight">
              {service.name}
            </h3>
          </div>

          {/* Edit button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-ink-3 hover:text-ink hover:bg-surface-2"
            onClick={onEdit}
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Description */}
        {service.description && (
          <p className="mt-2 text-xs text-ink-3 line-clamp-2">
            {service.description}
          </p>
        )}

        {/* Duration + Price */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-ink-3">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="font-mono text-xs">{service.duration_minutes} min</span>
          </div>

          <div className="text-right">
            {priceDisplay ? (
              priceMaxDisplay ? (
                <span className="font-mono text-xs text-ink-3">
                  {priceDisplay}{" "}
                  <span className="text-ink-4">–</span>{" "}
                  {priceMaxDisplay}
                </span>
              ) : (
                <span className="font-mono text-xs text-ink-3">
                  {priceDisplay}
                </span>
              )
            ) : (
              <span className="text-xs text-ink-4">Preço a combinar</span>
            )}
          </div>
        </div>

        {/* Category */}
        {service.category && (
          <div className="mt-2">
            <Badge
              variant="outline"
              className="border-border text-ink-3 text-xs font-normal"
            >
              {service.category}
            </Badge>
          </div>
        )}

        {/* Delete */}
        <Button
          variant="outline"
          size="sm"
          className="mt-4 w-full text-xs border border-border text-ink-3 hover:text-danger hover:border-danger/40 hover:bg-danger/5 gap-1.5"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Excluir serviço
        </Button>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="bg-surface border-border text-ink">
            <DialogHeader>
              <DialogTitle className="text-ink">Excluir serviço?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-ink-3 py-2">
              <span className="font-semibold text-ink">{service.name}</span> será removido permanentemente. Esta ação não pode ser desfeita.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)} className="border-border text-ink-2">
                Cancelar
              </Button>
              <Button
                className="bg-danger text-white font-semibold hover:bg-danger/90"
                onClick={() => { setConfirmOpen(false); onDelete?.() }}
              >
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
