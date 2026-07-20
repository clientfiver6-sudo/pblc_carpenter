"use client";

import { useState, useTransition, useDeferredValue, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CustomerCard } from "@/components/customers/CustomerCard";
import { createClient } from "@/lib/supabase/client";
import type { Customer, CustomerStatus } from "@/types/database";
import type { BusinessType } from "@/lib/config/business-types";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface CustomerListProps {
  initialCustomers: Customer[];
  businessType: BusinessType;
  total: number;
}

type SortOption = "last_visit" | "total_spent" | "name" | "newest";

const SORT_LABELS: Record<SortOption, string> = {
  last_visit: "Último atendimento",
  total_spent: "Total gasto",
  name: "Nome",
  newest: "Mais recente",
};

const STATUS_FILTER_OPTIONS: { value: CustomerStatus | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Inativo" },
];

const PAGE_SIZE = 20;

export function CustomerList({
  initialCustomers,
  businessType,
  total,
}: CustomerListProps) {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | "all">("all");
  const [sort, setSort] = useState<SortOption>("last_visit");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialCustomers.length < total);
  const [isSearching, startSearch] = useTransition();
  const [isLoadingMore, startLoadMore] = useTransition();
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const deferredSearch = useDeferredValue(searchInput);

  // Business id from first customer (all belong to same business)
  const businessId = initialCustomers[0]?.business_id ?? "";

  const fetchCustomers = useCallback(
    async (
      query: string,
      status: CustomerStatus | "all",
      sortBy: SortOption,
      pageNum: number,
      append = false
    ) => {
      const supabase = createClient();
      let req = supabase
        .from("customers")
        .select("*")
        .eq("business_id", businessId);

      if (query.trim()) {
        req = req.ilike("full_name", `%${query.trim()}%`);
      }
      if (status === "active") {
        const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
        req = req.gte("last_visit_at", oneYearAgo);
      } else if (status === "inactive") {
        const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
        req = req.or(`last_visit_at.lt.${oneYearAgo},last_visit_at.is.null`);
      }

      switch (sortBy) {
        case "last_visit":
          req = req.order("last_visit_at", { ascending: false, nullsFirst: false });
          break;
        case "total_spent":
          req = req.order("total_spent", { ascending: false });
          break;
        case "name":
          req = req.order("full_name", { ascending: true });
          break;
        case "newest":
          req = req.order("created_at", { ascending: false });
          break;
      }

      const from = (pageNum - 1) * PAGE_SIZE;
      req = req.range(from, from + PAGE_SIZE - 1);

      const { data } = await req;
      const results = data ?? [];

      if (append) {
        setCustomers((prev) => [...prev, ...results]);
      } else {
        setCustomers(results);
      }
      setHasMore(results.length === PAGE_SIZE);
    },
    [businessId]
  );

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      startSearch(async () => {
        await fetchCustomers(value, statusFilter, sort, 1, false);
      });
    }, 300);
  }

  function handleStatusFilter(value: CustomerStatus | "all") {
    setStatusFilter(value);
    setPage(1);
    startSearch(async () => {
      await fetchCustomers(searchInput, value, sort, 1, false);
    });
  }

  function handleSort(value: SortOption) {
    setSort(value);
    setPage(1);
    startSearch(async () => {
      await fetchCustomers(searchInput, statusFilter, value, 1, false);
    });
  }

  function handleLoadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    startLoadMore(async () => {
      await fetchCustomers(
        searchInput,
        statusFilter,
        sort,
        nextPage,
        true
      );
    });
  }

  function clearSearch() {
    setSearchInput("");
    setPage(1);
    startSearch(async () => {
      await fetchCustomers("", statusFilter, sort, 1, false);
    });
  }

  const isLoading = isSearching;

  return (
    <div className="space-y-4">
      {/* Search + sort row */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3" />
          <Input
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Buscar por nome..."
            className="pl-9 pr-9 bg-surface border-border text-ink placeholder:text-ink-4 focus-visible:ring-brand focus-visible:ring-1"
          />
          {searchInput && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink-2"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sort select */}
        <select
          value={sort}
          onChange={(e) => handleSort(e.target.value as SortOption)}
          className="h-10 rounded-md border border-border bg-surface text-ink-3 text-sm px-3 pr-8 focus:outline-none focus:border-brand cursor-pointer appearance-none"
        >
          {(Object.keys(SORT_LABELS) as SortOption[]).map((s) => (
            <option key={s} value={s}>
              {SORT_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleStatusFilter(opt.value)}
            className={cn(
              "text-xs px-3 py-1 rounded-full border transition-colors",
              statusFilter === opt.value
                ? "bg-ink text-white border-ink font-semibold"
                : "border-border text-ink-2 hover:bg-surface-2"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-16 w-full rounded-lg bg-surface-2"
            />
          ))
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-ink-4">
            <Search className="w-8 h-8 mb-2 opacity-40" />
            {deferredSearch ? (
              <p className="text-sm text-ink-3">
                Nenhum resultado para {'"'}{deferredSearch}{'"'}
              </p>
            ) : (
              <p className="text-sm text-ink-3">Nenhum cliente encontrado</p>
            )}
          </div>
        ) : (
          customers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              businessType={businessType}
              onClick={() =>
                router.push(`/dashboard/customers/${customer.id}`)
              }
            />
          ))
        )}
      </div>

      {/* Load more */}
      {hasMore && !isLoading && customers.length > 0 && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="border-border bg-surface text-ink-2 hover:bg-surface-2 rounded-md h-9 px-4 text-sm font-semibold"
          >
            {isLoadingMore ? "Carregando..." : "Carregar mais"}
          </Button>
        </div>
      )}
    </div>
  );
}
