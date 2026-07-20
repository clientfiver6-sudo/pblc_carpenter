"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format, addDays } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty, CommandGroup } from "@/components/ui/command"
import { cn, formatCurrency } from "@/lib/utils"
import { Calendar, ChevronDown, MapPin } from "lucide-react"
import type { Customer, Service, Staff } from "@/types/database"

// ─── Schema ──────────────────────────────────────────────────────────────────

export const workItemFormSchema = z.object({
  customer_id: z.string().min(1, "Selecione um cliente"),
  service_id: z.string().optional(),
  assigned_staff_id: z.string().optional(),
  type: z.enum(["appointment", "job", "repair", "quote", "order", "consultation", "service_call"]).default("service_call"),
  title: z.string().min(1, "Título obrigatório").max(200),
  scheduled_date: z.date().optional(),
  scheduled_time: z.string().optional(),
  address: z.string().optional(),
  price_estimate: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
})

export type WorkItemFormData = z.infer<typeof workItemFormSchema>

// ─── Component ───────────────────────────────────────────────────────────────

interface WorkItemFormProps {
  onSubmit: (data: WorkItemFormData) => void | Promise<void>
  defaultValues?: Partial<WorkItemFormData>
  customers: Customer[]
  services: Service[]
  staff: Staff[]
  isLoading?: boolean
}

export function WorkItemForm({
  onSubmit,
  defaultValues,
  customers,
  services,
  staff,
  isLoading = false,
}: WorkItemFormProps) {
  const [customerOpen, setCustomerOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [showAddress, setShowAddress] = useState(false)
  const [titleAutoFilled, setTitleAutoFilled] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = useForm<WorkItemFormData>({
    resolver: zodResolver(workItemFormSchema),
    defaultValues: {
      type: "appointment",
      ...defaultValues,
    },
  })

  useEffect(() => {
    if (defaultValues && Object.keys(defaultValues).length > 0) {
      reset({ ...getValues(), ...defaultValues })
      if (defaultValues.address) setShowAddress(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues])

  const selectedCustomerId = watch("customer_id")
  const selectedServiceId = watch("service_id")
  const selectedDate = watch("scheduled_date")
  const selectedTime = watch("scheduled_time")

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId)
  const selectedService = services.find((s) => s.id === selectedServiceId)

  function handleServiceChange(serviceId: string) {
    setValue("service_id", serviceId)
    const svc = services.find((s) => s.id === serviceId)
    if (svc && selectedCustomer) {
      setValue("title", `${svc.name} - ${selectedCustomer.full_name}`)
      setTitleAutoFilled(true)
    }
    if (svc?.price != null) {
      setValue("price_estimate", svc.price)
    }
  }

  function handleCustomerSelect(customerId: string) {
    setValue("customer_id", customerId)
    setCustomerOpen(false)
    const cust = customers.find((c) => c.id === customerId)
    if (cust && selectedService) {
      setValue("title", `${selectedService.name} - ${cust.full_name}`)
      setTitleAutoFilled(true)
    }
  }

  function setQuickDate(daysFromToday: number) {
    setValue("scheduled_date", addDays(new Date(), daysFromToday))
    setCalendarOpen(false)
  }

  const inputClass = "w-full border border-border rounded-lg h-10 px-3 text-sm text-ink bg-surface placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
  const labelClass = "text-sm font-medium text-ink-2"

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

      {/* ── Row 1: Customer ── */}
      <div className="space-y-1.5">
        <Label className={labelClass}>Cliente</Label>
        <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "w-full justify-between text-left font-normal border-border bg-surface hover:bg-surface-2 text-ink h-10 rounded-lg",
                !selectedCustomerId && "text-ink-4"
              )}
            >
              <span className="truncate">
                {selectedCustomer ? selectedCustomer.full_name : "Selecionar cliente..."}
              </span>
              <ChevronDown className="h-4 w-4 text-ink-3 shrink-0 ml-2" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0 bg-surface border-border shadow-2" align="start">
            <Command className="bg-surface">
              <CommandInput
                placeholder="Buscar cliente..."
                className="border-b border-border text-ink placeholder:text-ink-3"
              />
              <CommandList>
                <CommandEmpty className="py-4 text-center text-sm text-ink-3">
                  Nenhum cliente encontrado.
                </CommandEmpty>
                <CommandGroup>
                  {customers.map((customer) => (
                    <CommandItem
                      key={customer.id}
                      value={customer.full_name}
                      onSelect={() => handleCustomerSelect(customer.id)}
                      className={cn(
                        "text-sm text-ink cursor-pointer hover:bg-surface-2",
                        customer.id === selectedCustomerId && "bg-tint text-brand"
                      )}
                    >
                      <span className="truncate flex-1">{customer.full_name}</span>
                      {customer.phone_number && (
                        <span className="ml-2 text-ink-4 text-xs font-mono shrink-0">
                          {customer.phone_number}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {errors.customer_id && (
          <p className="text-danger text-xs">{errors.customer_id.message}</p>
        )}
      </div>

      {/* ── Row 2: Service + Staff ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className={labelClass}>Serviço</Label>
          <Select value={selectedServiceId} onValueChange={handleServiceChange}>
            <SelectTrigger className="border-border bg-surface text-ink h-10 rounded-lg w-full">
              <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent className="bg-surface border-border shadow-2">
              {services.map((service) => (
                <SelectItem key={service.id} value={service.id} className="text-ink">
                  <span>{service.name}</span>
                  {service.price != null && (
                    <span className="ml-2 text-ink-3 text-xs">{formatCurrency(Math.round(service.price * 100))}</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className={labelClass}>Responsável</Label>
          <Select
            value={watch("assigned_staff_id")}
            onValueChange={(v) => setValue("assigned_staff_id", v)}
          >
            <SelectTrigger className="border-border bg-surface text-ink h-10 rounded-lg w-full">
              <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent className="bg-surface border-border shadow-2">
              {staff.map((member) => (
                <SelectItem key={member.id} value={member.id} className="text-ink">
                  {member.name}
                  {member.role && (
                    <span className="ml-2 text-ink-4 text-xs">{member.role}</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Row 3: Title ── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className={labelClass}>Título</Label>
          {titleAutoFilled && (
            <span className="text-xs text-brand bg-tint px-2 py-0.5 rounded-full">auto-preenchido</span>
          )}
        </div>
        <Input
          {...register("title", { onChange: () => setTitleAutoFilled(false) })}
          placeholder="Ex: Consulta - João Silva"
          className={inputClass}
        />
        {errors.title && (
          <p className="text-danger text-xs">{errors.title.message}</p>
        )}
      </div>

      {/* ── Row 4: Date + Time ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className={labelClass}>Data</Label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setQuickDate(0)}
                className="text-xs text-brand bg-tint hover:bg-tint/80 px-2 py-0.5 rounded-full transition-colors"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => setQuickDate(1)}
                className="text-xs text-ink-3 hover:text-brand hover:bg-tint px-2 py-0.5 rounded-full transition-colors"
              >
                Amanhã
              </button>
            </div>
          </div>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal border-border bg-surface hover:bg-surface-2 text-ink h-10 rounded-lg",
                  !selectedDate && "text-ink-4"
                )}
              >
                <Calendar className="mr-2 h-4 w-4 text-ink-3 shrink-0" />
                {selectedDate
                  ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR })
                  : "Selecionar data..."}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-surface border-border shadow-2">
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  setValue("scheduled_date", date)
                  setCalendarOpen(false)
                }}
                locale={ptBR}
                className="text-ink"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <Label className={labelClass}>Horário</Label>
          <input
            type="time"
            value={selectedTime ?? ""}
            onChange={(e) => setValue("scheduled_time", e.target.value)}
            className={cn(inputClass, "font-mono cursor-pointer")}
          />
        </div>
      </div>

      {/* ── Row 5: Address (collapsible) ── */}
      {showAddress ? (
        <div className="space-y-1.5">
          <Label className={labelClass}>Endereço</Label>
          <Input
            {...register("address")}
            placeholder="Rua, número, bairro, cidade"
            className={inputClass}
            autoFocus
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddress(true)}
          className="flex items-center gap-1.5 text-sm text-ink-3 hover:text-brand transition-colors"
        >
          <MapPin className="h-3.5 w-3.5" />
          Adicionar endereço
        </button>
      )}

      {/* ── Row 6: Price + Notes ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className={labelClass}>Valor estimado</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 text-sm font-mono pointer-events-none">
              R$
            </span>
            <Input
              type="number"
              step="0.01"
              min="0"
              {...register("price_estimate", { valueAsNumber: true })}
              placeholder="0,00"
              className={cn(inputClass, "pl-9 font-mono")}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className={labelClass}>Observações</Label>
          <Textarea
            {...register("notes")}
            placeholder="Observações opcionais..."
            rows={1}
            className="w-full border border-border rounded-lg min-h-[40px] py-2 px-3 text-sm text-ink bg-surface placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 resize-none"
          />
        </div>
      </div>

      {/* ── Submit ── */}
      <div className="pt-1">
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-11 rounded-lg text-white font-semibold hover:opacity-90 transition-opacity"
          style={{ background: "var(--brand-grad)" }}
        >
          {isLoading ? "Salvando..." : "Criar chamado"}
        </Button>
      </div>
    </form>
  )
}
