import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import ExcelJS from "exceljs";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit } from "@/lib/rate-limit";

interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

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

const anthropic = new Anthropic();

async function extractCustomersFromImage(
  buffer: ArrayBuffer,
  mimeType: "image/jpeg" | "image/png"
): Promise<{ name: string; phone: string | null }[]> {
  const base64 = Buffer.from(buffer).toString("base64");
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: "Você extrai listas de clientes de imagens. Responda APENAS com JSON válido, sem texto adicional.",
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: mimeType, data: base64 },
        },
        {
          type: "text",
          text: 'Extraia todos os nomes e telefones visíveis nesta imagem. Retorne JSON: { "customers": [{ "name": "string", "phone": "string ou null" }] }. Se não houver telefone para um cliente, use null.',
        },
      ],
    }],
  });
  const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
  const parsed = JSON.parse(raw) as { customers?: { name: string; phone: string | null }[] };
  return parsed.customers ?? [];
}

function mapHeaders(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    if (h === "nome" || h === "name") map["full_name"] = i;
    else if (h === "telefone" || h === "phone") map["phone"] = i;
    else if (h === "email") map["email"] = i;
    else if (h === "etiquetas" || h === "tags") map["tags"] = i;
  });
  return map;
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

  const { allowed } = await checkRateLimit(`import-customers:${businessId}`, 5, 3_600_000)
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

  // 3. Parse file (image, XLSX, or CSV)
  const fileName = file.name.toLowerCase();
  const isImage = fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || fileName.endsWith(".png");

  if (isImage) {
    const mimeType = fileName.endsWith(".png") ? "image/png" : "image/jpeg";
    const buffer = await file.arrayBuffer();
    let customers: { name: string; phone: string | null }[] = [];
    try {
      customers = await extractCustomersFromImage(buffer, mimeType);
    } catch (err) {
      console.error("Image OCR error:", err);
      return NextResponse.json({ error: "Erro ao processar imagem" }, { status: 500 });
    }
    const result: ImportResult = { imported: 0, updated: 0, skipped: 0, errors: [] };
    for (const customer of customers) {
      const fullName = customer.name?.trim() ?? "";
      if (!fullName) { result.skipped++; continue; }
      const phone = customer.phone?.trim() || null;
      try {
        if (phone) {
          const { data: rawExisting } = await supabase
            .from("customers").select("id").eq("business_id", businessId).eq("phone_number", phone).maybeSingle();
          const existing = rawExisting as { id: string } | null;
          if (existing) {
            await supabase.from("customers").update({ full_name: fullName } as never).eq("id", existing.id);
            result.updated++;
            continue;
          }
        }
        const { error: insertError } = await supabase.from("customers").insert({
          business_id: businessId, full_name: fullName, phone_number: phone,
          status: "active", lead_status: "new", total_spent: 0, visit_count: 0, metadata: {},
        } as never);
        if (insertError) result.errors.push(insertError.message);
        else result.imported++;
      } catch (err) {
        result.errors.push(err instanceof Error ? err.message : "Erro desconhecido");
      }
    }
    return NextResponse.json(result);
  }

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
    // CSV path
    const text = await file.text();
    const parsed = parseCSV(text);
    headers = parsed.headers;
    rows = parsed.rows;
  }

  // 4. Validate headers
  if (headers.length === 0) {
    return NextResponse.json(
      { error: "CSV file is empty or unreadable" },
      { status: 400 }
    );
  }

  const fieldMap = mapHeaders(headers);

  const result: ImportResult = { imported: 0, updated: 0, skipped: 0, errors: [] };

  // 5. Process each data row
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const lineNum = rowIndex + 2; // +2: 1-based + header row

    const fullName =
      fieldMap["full_name"] !== undefined
        ? (row[fieldMap["full_name"]] ?? "").trim()
        : "";

    if (!fullName) {
      result.skipped++;
      continue;
    }

    const phone =
      fieldMap["phone"] !== undefined
        ? (row[fieldMap["phone"]] ?? "").trim() || null
        : null;

    const email =
      fieldMap["email"] !== undefined
        ? (row[fieldMap["email"]] ?? "").trim() || null
        : null;

    const tagsRaw =
      fieldMap["tags"] !== undefined
        ? (row[fieldMap["tags"]] ?? "").trim()
        : "";
    const tags = tagsRaw
      ? tagsRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    try {
      if (phone) {
        // Try upsert by phone + business_id
        const { data: rawExisting } = await supabase
          .from("customers")
          .select("id")
          .eq("business_id", businessId)
          .eq("phone_number", phone)
          .maybeSingle();
        const existing = rawExisting as { id: string } | null;

        if (existing) {
          // Update existing customer
          const { error: updateError } = await supabase
            .from("customers")
            .update({ full_name: fullName, email, tags } as never)
            .eq("id", existing.id);

          if (updateError) {
            result.errors.push(`Linha ${lineNum}: ${updateError.message}`);
          } else {
            result.updated++;
          }
          continue;
        }
      }

      // Insert new customer
      const { error: insertError } = await supabase.from("customers").insert({
        business_id: businessId,
        full_name: fullName,
        phone_number: phone,
        email,
        tags,
        status: "active",
        lead_status: "new",
        total_spent: 0,
        visit_count: 0,
        metadata: {},
      } as never);

      if (insertError) {
        result.errors.push(`Linha ${lineNum}: ${insertError.message}`);
      } else {
        result.imported++;
      }
    } catch (err) {
      result.errors.push(
        `Linha ${lineNum}: ${err instanceof Error ? err.message : "Erro desconhecido"}`
      );
    }
  }

  // 6. Return result
  return NextResponse.json(result);
}
