"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Home, Briefcase, CalendarDays, Users, MessageSquare,
  Zap, CreditCard, BarChart3, Settings, Plus
} from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"

interface CommandPaletteProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function CommandPalette({ open: controlledOpen, onOpenChange }: CommandPaletteProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const router = useRouter()

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = (value: boolean) => {
    if (isControlled) {
      onOpenChange?.(value)
    } else {
      setInternalOpen(value)
    }
  }

function go(href: string) {
    router.push(href)
    setOpen(false)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar páginas e ações..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        <CommandGroup heading="Navegação">
          <CommandItem onSelect={() => go("/dashboard")}>
            <Home className="mr-2 h-4 w-4" />
            Início
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/work-items")}>
            <Briefcase className="mr-2 h-4 w-4" />
            Agendamentos
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/calendar")}>
            <CalendarDays className="mr-2 h-4 w-4" />
            Calendário
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/customers")}>
            <Users className="mr-2 h-4 w-4" />
            Clientes
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/conversations")}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Conversas
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/automations")}>
            <Zap className="mr-2 h-4 w-4" />
            Automações
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/payments")}>
            <CreditCard className="mr-2 h-4 w-4" />
            Pagamentos
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/analytics")}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Análises
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/settings")}>
            <Settings className="mr-2 h-4 w-4" />
            Configurações
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Criar">
          <CommandItem onSelect={() => go("/dashboard/work-items/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Agendamento
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/customers/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Cliente
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/automations/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Automação
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
