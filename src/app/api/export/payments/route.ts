import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateCsv, formatCurrencyCsv, formatDateBr } from "@/lib/export/csv";
import type { PaymentWithRelations } from "@/types/database";

export async function GET(req: NextRequest): Promise<NextResponse> {
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

  // Parse optional date range query params
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Fetch payments with customer relation
  let query = supabase
    .from("payments")
    .select(
      `
      *,
      customer:customers(id, full_name)
      `
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (from) {
    query = query.gte("created_at", `${from}T00:00:00.000Z`);
  }
  if (to) {
    query = query.lte("created_at", `${to}T23:59:59.999Z`);
  }

  const { data: rawPayments, error } = await query;

  if (error) {
    console.error("export/payments: query error", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  const payments = (rawPayments as unknown as PaymentWithRelations[] | null) ?? [];

  // CSV headers
  const headers = ["Data", "Cliente", "Valor (R$)", "Status", "Método", "Descrição"];

  const STATUS_LABELS: Record<string, string> = {
    pending: "Pendente",
    paid: "Pago",
    failed: "Falhou",
    refunded: "Estornado",
    expired: "Expirado",
  };

  const METHOD_LABELS: Record<string, string> = {
    pix: "Pix",
    cash: "Dinheiro",
    card: "Cartão",
    transfer: "Transferência",
  };

  const rows = payments.map((p) => [
    formatDateBr(p.created_at),
    p.customer?.full_name ?? "",
    formatCurrencyCsv(p.amount),
    STATUS_LABELS[p.status] ?? p.status,
    METHOD_LABELS[p.method] ?? p.method,
    p.description ?? "",
  ]);

  const csv = generateCsv(headers, rows);

  const dateSuffix =
    from && to
      ? `_${from}_${to}`
      : `_${new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })}`;
  const filename = `pagamentos${dateSuffix}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
