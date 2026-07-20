import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateCsv, formatCurrencyCsv, formatDateBr } from "@/lib/export/csv";
import type { Customer } from "@/types/database";

export async function GET(): Promise<NextResponse> {
  // Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: rawBu } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .single();
  const bu = rawBu as { business_id: string } | null;

  if (!bu) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const businessId = bu.business_id;

  // Fetch all customers (no pagination — full export)
  const { data: rawCustomers, error } = await supabase
    .from("customers")
    .select("*")
    .eq("business_id", businessId)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("export/customers: query error", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  const customers = (rawCustomers as Customer[] | null) ?? [];

  // CSV headers
  const headers = [
    "Nome",
    "Telefone",
    "Email",
    "Status",
    "Visitas",
    "Total Gasto (R$)",
    "Última Visita",
    "Criado em",
    "Tags",
  ];

  const STATUS_LABELS: Record<string, string> = {
    active: "Ativo",
    inactive: "Inativo",
    blocked: "Bloqueado",
  };

  const rows = customers.map((c) => [
    c.full_name,
    c.phone_number ?? "",
    c.email ?? "",
    STATUS_LABELS[c.status] ?? c.status,
    String(c.visit_count),
    formatCurrencyCsv(c.total_spent),
    formatDateBr(c.last_visit_at),
    formatDateBr(c.created_at),
    (c.tags ?? []).join(", "),
  ]);

  const csv = generateCsv(headers, rows);

  const filename = `clientes_${new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
