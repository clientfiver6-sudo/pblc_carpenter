"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { User, Wrench } from "lucide-react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { createClient } from "@/lib/supabase/client";

interface GlobalSearchProps {
  businessId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CustomerResult {
  id: string;
  full_name: string;
  phone_number: string | null;
  status: string;
}

interface WorkItemResult {
  id: string;
  title: string;
  status: string;
  scheduled_start: string | null;
}


export function GlobalSearch({ businessId, open, onOpenChange }: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerResult[]>([]);
  const [workItems, setWorkItems] = useState<WorkItemResult[]>([]);
  const [loading, setLoading] = useState(false);

  // ⌘K / Ctrl+K global shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(true);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onOpenChange]);

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setQuery("");
      setCustomers([]);
      setWorkItems([]);
    }
  }, [open]);

  const search = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setCustomers([]);
        setWorkItems([]);
        return;
      }
      setLoading(true);
      const supabase = createClient();
      const like = `%${q}%`;

      const [custRes, wiRes] = await Promise.all([
        supabase
          .from("customers")
          .select("id,full_name,phone_number,status")
          .eq("business_id", businessId)
          .or(`full_name.ilike.${like},phone_number.ilike.${like}`)
          .limit(5),
        supabase
          .from("work_items")
          .select("id,title,status,scheduled_start")
          .eq("business_id", businessId)
          .ilike("title", like)
          .order("scheduled_start", { ascending: false })
          .limit(5),
      ]);

      setCustomers((custRes.data as CustomerResult[]) ?? []);
      setWorkItems((wiRes.data as WorkItemResult[]) ?? []);
      setLoading(false);
    },
    [businessId]
  );

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  function navigate(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  const hasResults = customers.length > 0 || workItems.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 bg-surface border-border shadow-lg max-w-[calc(100vw-24px)] sm:max-w-lg">
        <VisuallyHidden.Root>
          <DialogTitle>Busca global</DialogTitle>
        </VisuallyHidden.Root>
        <Command className="[&_[cmdk-group-heading]]:text-ink-3 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold bg-surface text-ink">
        <CommandInput
          placeholder="Buscar clientes, atendimentos..."
          value={query}
          onValueChange={setQuery}
          className="text-ink placeholder:text-ink-4 border-border h-12"
        />
        <CommandList className="bg-surface text-ink max-h-[60vh]">
          {!loading && query.trim() && !hasResults && (
            <CommandEmpty className="text-ink-4 py-8 text-sm text-center">
              Nenhum resultado para &quot;{query}&quot;
            </CommandEmpty>
          )}

          {customers.length > 0 && (
            <CommandGroup
              heading="Clientes"
              className="px-2 pt-2"
            >
              {customers.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`customer-${c.id}-${c.full_name}`}
                  onSelect={() => navigate(`/dashboard/customers/${c.id}`)}
                  className="text-ink data-[selected=true]:bg-tint data-[selected=true]:text-brand rounded-lg px-3 py-2.5 cursor-pointer"
                >
                  <User className="w-4 h-4 text-ink-3 shrink-0" />
                  <span className="flex-1 truncate">{c.full_name}</span>
                  {c.phone_number && (
                    <span className="text-xs text-ink-4 font-mono shrink-0">{c.phone_number}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {workItems.length > 0 && (
            <CommandGroup
              heading="Atendimentos"
              className="px-2 pt-2"
            >
              {workItems.map((wi) => (
                <CommandItem
                  key={wi.id}
                  value={`workitem-${wi.id}-${wi.title}`}
                  onSelect={() => navigate(`/dashboard/work-items`)}
                  className="text-ink data-[selected=true]:bg-tint data-[selected=true]:text-brand rounded-lg px-3 py-2.5 cursor-pointer"
                >
                  <Wrench className="w-4 h-4 text-ink-3 shrink-0" />
                  <span className="flex-1 truncate">{wi.title}</span>
                  <span className={`text-xs shrink-0 px-1.5 py-0.5 rounded-full font-medium ${
                    wi.status === "completed" ? "bg-moss/10 text-moss" :
                    wi.status === "cancelled" ? "bg-danger/10 text-danger" :
                    "bg-tint text-brand"
                  }`}>
                    {wi.status === "scheduled" ? "agendado" :
                     wi.status === "in_progress" ? "em andamento" :
                     wi.status === "completed" ? "concluído" :
                     wi.status === "cancelled" ? "cancelado" : wi.status}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
