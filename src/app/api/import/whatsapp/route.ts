import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit } from "@/lib/rate-limit";
import { TAG, delimit, DELIMITER_PREAMBLE } from "@/lib/ai/delimiter";

const anthropic = new Anthropic();

const MSG_REGEX = /^(\d{2}\/\d{2}\/\d{4}), (\d{1,2}:\d{2}) - ([^:]+): (.+)$/;
const PHONE_REGEX = /\+?[\d\s\-\(\)]{10,}/;

interface ParsedMessage {
  sender: string;
  message: string;
}

interface ClaudeAnalysis {
  customers: { name: string; phone: string | null }[];
  faqs: { question: string; answer: string }[];
  tone: string;
  services: string[];
  pricing: string[];
}

function parseWhatsApp(text: string): ParsedMessage[] {
  const messages: ParsedMessage[] = [];
  for (const line of text.split("\n")) {
    const match = line.match(MSG_REGEX);
    if (match) {
      messages.push({ sender: match[3].trim(), message: match[4].trim() });
    }
  }
  return messages;
}

function identifyBusinessSender(messages: ParsedMessage[]): string {
  const counts: Record<string, number> = {};
  for (const { sender } of messages) {
    counts[sender] = (counts[sender] ?? 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

function extractPhone(sender: string): string | null {
  const match = sender.match(PHONE_REGEX);
  return match ? match[0].trim() : null;
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

  const { allowed } = await checkRateLimit(`import-whatsapp:${businessId}`, 3, 3_600_000)
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

  if (!file.name.endsWith(".txt")) {
    return NextResponse.json(
      { error: "Envie um arquivo .txt exportado do WhatsApp" },
      { status: 400 }
    );
  }

  // 3. Parse WhatsApp export
  const text = await file.text();
  const messages = parseWhatsApp(text);

  if (messages.length === 0) {
    return NextResponse.json(
      { error: "Nenhuma mensagem encontrada no arquivo" },
      { status: 400 }
    );
  }

  const businessSender = identifyBusinessSender(messages);
  const customerSenders = [
    ...new Set(
      messages
        .map((m) => m.sender)
        .filter((s) => s !== businessSender)
    ),
  ];

  // Build conversation text (cap at 20000 chars)
  const conversationText = messages
    .map((m) => `${m.sender}: ${m.message}`)
    .join("\n")
    .slice(0, 20000);

  // 4. Claude analysis
  let analysis: ClaudeAnalysis;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system:
        `${DELIMITER_PREAMBLE}\n\nVocê analisa conversas do WhatsApp de negócios brasileiros. Responda APENAS com JSON válido, sem texto adicional.`,
      messages: [
        {
          role: "user",
          content: `Analise esta conversa de WhatsApp de um negócio brasileiro.

Nome do negócio (remetente do negócio): ${businessSender}

Clientes identificados (remetentes que NÃO são o negócio): ${customerSenders.join(", ")}

${delimit(TAG.conversationHistory, conversationText)}

Retorne JSON com este formato exato:
{
  "customers": [{ "name": "string", "phone": "string ou null" }],
  "faqs": [{ "question": "string", "answer": "string" }],
  "tone": "string (2 frases descrevendo o tom: formal/informal, uso de emoji, comprimento típico das respostas)",
  "services": ["string"],
  "pricing": ["string (ex: 'Corte R$ 50')"]
}

Instruções:
- Clientes são remetentes que NÃO são o negócio. Inclua apenas clientes onde você tem contexto suficiente para determinar nome ou telefone.
- FAQs: identifique as 5-10 perguntas mais comuns que os clientes fazem e a resposta real do negócio. Máximo 10 FAQs.
- Phones: extraia números de telefone dos nomes dos remetentes quando disponível.`,
        },
      ],
    });

    const raw =
      response.content[0].type === "text" ? response.content[0].text : "";
    analysis = JSON.parse(raw) as ClaudeAnalysis;
  } catch (err) {
    console.error("Claude analysis failed:", err);
    return NextResponse.json(
      { error: "Erro ao analisar conversa" },
      { status: 500 }
    );
  }

  const { customers, faqs, tone, services, pricing } = analysis;

  // 5. Upsert customers
  let customersImported = 0;
  for (const customer of customers) {
    const name = customer.name?.trim() ?? "";
    // Try to get phone from Claude's result, then fall back to parsing sender name
    const phone =
      customer.phone?.trim() ||
      extractPhone(
        customerSenders.find((s) => s.toLowerCase().includes(name.toLowerCase())) ?? ""
      ) ||
      null;

    if (!name && !phone) continue;

    try {
      if (phone) {
        const { data: rawExisting } = await supabase
          .from("customers")
          .select("id")
          .eq("business_id", businessId)
          .eq("phone_number", phone)
          .maybeSingle();
        const existing = rawExisting as { id: string } | null;

        if (existing) {
          // Skip — don't overwrite existing customer data
          continue;
        }
      }

      const { error: insertError } = await supabase.from("customers").insert({
        business_id: businessId,
        full_name: name || null,
        phone_number: phone,
        status: "active",
        lead_status: "new",
        total_spent: 0,
        visit_count: 0,
        metadata: {},
      } as never);

      if (insertError) {
        console.error("Customer insert error:", insertError.message);
      } else {
        customersImported++;
      }
    } catch (err) {
      console.error("Customer upsert error:", err);
    }
  }

  // 6. Update businesses.settings with whatsappImport
  try {
    const { data: rawBusiness } = await supabase
      .from("businesses")
      .select("settings")
      .eq("id", businessId)
      .single();
    const currentSettings =
      (rawBusiness as { settings: Record<string, unknown> } | null)?.settings ??
      {};

    const newSettings = {
      ...currentSettings,
      whatsappImport: {
        tone,
        faqs,
        services,
        pricing,
        importedAt: new Date().toISOString(),
      },
    };

    await supabase
      .from("businesses")
      .update({ settings: newSettings } as never)
      .eq("id", businessId);
  } catch (err) {
    console.error("Settings update error:", err);
  }

  // 7. Create business skill with FAQ content
  let skillCreated = false;
  try {
    const faqLines = faqs
      .map((f) => `P: ${f.question}\nR: ${f.answer}`)
      .join("\n\n");

    const faqContent = `Tom de comunicação: ${tone}\n\nPerguntas e respostas frequentes:\n\n${faqLines}`;

    const { error: skillError } = await supabase
      .from("business_skills")
      .insert({
        business_id: businessId,
        name: "FAQ Extraído do WhatsApp",
        content: faqContent,
        active: true,
        order_index: 0,
      } as never);

    if (skillError) {
      console.error("Skill insert error:", skillError.message);
    } else {
      skillCreated = true;
    }
  } catch (err) {
    console.error("Skill creation error:", err);
  }

  // 8. Return result
  return NextResponse.json({
    customersImported,
    faqsFound: faqs.length,
    servicesFound: services,
    tone,
    skillCreated,
  });
}
