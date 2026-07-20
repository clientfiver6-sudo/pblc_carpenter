import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import ExcelJS from "exceljs";
import { checkRateLimit } from "@/lib/rate-limit";

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/\r$/, ""))
    .filter((l) => l.trim() !== "");

  if (lines.length === 0) return { headers: [], rows: [] };

  // Detect delimiter
  const delimiter = lines[0].includes(";") ? ";" : ",";

  const splitLine = (line: string): string[] =>
    line.split(delimiter).map((v) => v.trim().replace(/^"|"$/g, ""));

  const headers = splitLine(lines[0]).map((h) => h.toLowerCase().trim());
  const rows = lines.slice(1).map(splitLine);

  return { headers, rows };
}

function mapAppointmentHeaders(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const n = h.toLowerCase().trim();
    if (["nome", "name", "cliente", "paciente", "customer"].includes(n)) map["name"] = i;
    else if (["telefone", "phone", "cel", "celular", "whatsapp", "fone"].includes(n)) map["phone"] = i;
    else if (["serviço", "servico", "service", "procedimento", "tipo", "tratamento"].includes(n)) map["service"] = i;
    else if (["data", "date", "dt", "quando", "dia", "agendamento"].includes(n)) map["date"] = i;
    else if (["valor", "price", "preço", "preco", "total", "custo"].includes(n)) map["price"] = i;
    else if (["status", "situação", "situacao"].includes(n)) map["status"] = i;
  });
  return map;
}

function parseBrazilianDate(dateStr: string): Date {
  // Try native parse first
  const native = new Date(dateStr);
  if (!isNaN(native.getTime())) return native;

  // Try DD/MM/YYYY
  const parts = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (parts) {
    const day = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10);
    const year = parseInt(parts[3], 10);
    const d = new Date(year, month - 1, day);
    if (!isNaN(d.getTime())) return d;
  }

  return new Date();
}

function parsePriceInCents(priceStr: string): number {
  const cleaned = priceStr.replace(/R\$\s*/g, "").replace(/\s/g, "").replace(/,/g, ".");
  return Math.round((parseFloat(cleaned) || 0) * 100);
}

function mapStatus(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (["concluido", "concluído", "done", "completed"].includes(s)) return "completed";
  if (["cancelado", "cancelled", "canceled"].includes(s)) return "cancelled";
  return "scheduled";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Auth + business lookup
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

  const { allowed } = await checkRateLimit(`import-appointments:${businessId}`, 5, 3_600_000)
  if (!allowed) return NextResponse.json({ error: "Muitas importações. Tente novamente em 1 hora." }, { status: 429 })

  // 2. Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // 3. Parse file (XLSX or CSV)
  const fileName = file.name.toLowerCase();
  let headers: string[];
  let rows: string[][];

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(Buffer.from(buffer) as any);
    const sheet = workbook.worksheets[0];
    const data: unknown[][] = [];
    sheet.eachRow((row) => { data.push((row.values as unknown[]).slice(1)); });
    if (data.length === 0) {
      return NextResponse.json({ error: "Planilha vazia" }, { status: 400 });
    }
    headers = data[0].map(h => String(h ?? "").toLowerCase().trim());
    rows = data.slice(1).map(row =>
      headers.map((_, i) => String((row as unknown[])[i] ?? "").trim())
    );
  } else {
    const text = await file.text();
    const parsed = parseCSV(text);
    headers = parsed.headers;
    rows = parsed.rows;
  }

  if (headers.length === 0) {
    return NextResponse.json(
      { error: "Arquivo vazio ou ilegível" },
      { status: 400 }
    );
  }

  const fieldMap = mapAppointmentHeaders(headers);

  let imported = 0;
  let customersCreated = 0;
  const errors: string[] = [];

  // 4. Process each row
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const lineNum = rowIndex + 2; // 1-based + header row

    const name =
      fieldMap["name"] !== undefined
        ? (row[fieldMap["name"]] ?? "").trim()
        : "";
    const phone =
      fieldMap["phone"] !== undefined
        ? (row[fieldMap["phone"]] ?? "").trim()
        : "";
    const serviceName =
      fieldMap["service"] !== undefined
        ? (row[fieldMap["service"]] ?? "").trim()
        : "";
    const dateStr =
      fieldMap["date"] !== undefined
        ? (row[fieldMap["date"]] ?? "").trim()
        : "";
    const priceStr =
      fieldMap["price"] !== undefined
        ? (row[fieldMap["price"]] ?? "").trim()
        : "";
    const statusRaw =
      fieldMap["status"] !== undefined
        ? (row[fieldMap["status"]] ?? "").trim()
        : "";

    // Skip rows with no name AND no phone
    if (!name && !phone) continue;

    try {
      // Find or create customer
      let customerId: string | null = null;

      if (phone) {
        const { data: rawExisting } = await supabase
          .from("customers")
          .select("id")
          .eq("business_id", businessId)
          .eq("phone_number", phone)
          .maybeSingle();
        const existing = rawExisting as { id: string } | null;

        if (existing) {
          customerId = existing.id;
        }
      }

      if (!customerId) {
        const { data: rawNew, error: insertCustomerError } = await supabase
          .from("customers")
          .insert({
            business_id: businessId,
            full_name: name || "Cliente importado",
            phone_number: phone || null,
            status: "active",
            lead_status: "new",
            total_spent: 0,
            visit_count: 0,
            metadata: {},
          } as never)
          .select("id")
          .single();

        if (insertCustomerError || !rawNew) {
          errors.push(
            `Linha ${lineNum}: ${insertCustomerError?.message ?? "Erro ao criar cliente"}`
          );
          continue;
        }

        customerId = (rawNew as { id: string }).id;
        customersCreated++;
      }

      // Parse date
      const parsedDate = parseBrazilianDate(dateStr);

      // Parse price (convert to cents)
      const priceInCents = parsePriceInCents(priceStr);

      // Map status
      const mappedStatus = mapStatus(statusRaw);

      // Insert work item
      const { error: workItemError } = await supabase
        .from("work_items")
        .insert({
          business_id: businessId,
          customer_id: customerId,
          title: serviceName || "Atendimento",
          status: mappedStatus,
          scheduled_date: parsedDate.toISOString(),
          price: priceInCents,
          metadata: { importSource: "csv_import" },
        } as never);

      if (workItemError) {
        errors.push(`Linha ${lineNum}: ${workItemError.message}`);
      } else {
        imported++;
      }
    } catch (err) {
      errors.push(
        `Linha ${lineNum}: ${err instanceof Error ? err.message : "Erro desconhecido"}`
      );
    }
  }

  return NextResponse.json({ imported, customersCreated, errors });
}
