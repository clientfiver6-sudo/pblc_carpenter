import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

export interface TopCustomerRow {
  id: string;
  full_name: string;
  total_spent: number; // cents
  visit_count: number;
  status: string;
}

interface TopCustomersTableProps {
  customers: TopCustomerRow[];
}

export function TopCustomersTable({ customers }: TopCustomersTableProps) {
  return (
    <Card className="bg-surface border border-border rounded-xl">
      <CardHeader className="pb-2 pt-5 px-5">
        <CardTitle className="text-ink text-sm font-semibold flex items-center gap-2">
          <Users className="w-4 h-4 text-brand" />
          Top 10 Clientes por Receita
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        {customers.length === 0 ? (
          <div className="h-32 flex items-center justify-center">
            <p className="text-ink-4 text-sm">Nenhum cliente encontrado</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {customers.map((c, idx) => (
              <Link
                key={c.id}
                href={`/dashboard/customers/${c.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2 transition-colors group"
              >
                {/* Rank */}
                <span className="font-mono text-ink-4 text-xs w-5 text-center shrink-0">
                  {idx + 1}
                </span>

                {/* Avatar-like initial */}
                <div className="w-7 h-7 rounded-full bg-tint border border-border flex items-center justify-center shrink-0 transition-colors">
                  <span className="text-[10px] font-mono text-brand-2 font-semibold uppercase">
                    {c.full_name.charAt(0)}
                  </span>
                </div>

                {/* Name + visits */}
                <div className="flex-1 min-w-0">
                  <p className="text-ink text-sm font-semibold truncate group-hover:text-brand transition-colors">
                    {c.full_name}
                  </p>
                  <p className="text-ink-4 text-xs font-mono">
                    {c.visit_count} {c.visit_count === 1 ? "visita" : "visitas"}
                  </p>
                </div>

                {/* Total spent */}
                <span className="font-mono text-sm font-bold text-ink shrink-0">
                  {c.total_spent > 0 ? formatCurrency(c.total_spent) : "--"}
                </span>

                {/* Status badge */}
                <Badge
                  variant="outline"
                  className={
                    c.status === "active"
                      ? "border-brand/30 text-brand text-[10px] px-1.5 py-0 font-mono"
                      : "border-border text-ink-4 text-[10px] px-1.5 py-0 font-mono"
                  }
                >
                  {c.status === "active" ? "ativo" : c.status === "inactive" ? "inativo" : c.status}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
