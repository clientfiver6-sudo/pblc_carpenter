import { EVOLUTION_API_URL, EVOLUTION_API_KEY } from "@/lib/env"

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  // If it already looks like a full international number (11+ digits), leave it as is.
  // Otherwise, default to Brazil (prepend 55).
  if (digits.length >= 11) return digits
  return `55${digits}`
}

async function evoFetch(method: string, path: string, body?: unknown): Promise<unknown> {
  const url = `${EVOLUTION_API_URL}${path}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15_000)

  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: {
        apikey: EVOLUTION_API_KEY,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Evolution API timeout after 15s (${method} ${path})`)
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable)")
    console.error("evoFetch error", { method, path, status: res.status, body: text })
    throw new Error(`Evolution API ${res.status}: ${text}`)
  }
  return res.json().catch(() => null)
}

export async function sendTextMessage(options: {
  to: string
  text: string
  instanceName: string
}): Promise<string> {
  const { to, text, instanceName } = options
  const response = (await evoFetch("POST", `/message/sendText/${instanceName}`, {
    number: normalizePhone(to),
    text,
  })) as { key: { remoteJid: string; fromMe: boolean; id: string } }
  return response.key.id
}

export async function sendImageMessage(options: {
  to: string
  mediaUrl: string
  caption?: string
  instanceName: string
}): Promise<string> {
  const { to, mediaUrl, caption, instanceName } = options
  const response = (await evoFetch("POST", `/message/sendMedia/${instanceName}`, {
    number: normalizePhone(to),
    mediatype: "image",
    media: mediaUrl,
    caption,
  })) as { key: { remoteJid: string; fromMe: boolean; id: string } }
  return response.key.id
}

export async function markAsRead(options: {
  messageId: string
  phone: string
  fromMe?: boolean
  instanceName: string
}): Promise<void> {
  const { messageId, phone, fromMe, instanceName } = options
  try {
    await evoFetch("POST", `/chat/markMessageAsRead/${instanceName}`, {
      readMessages: [
        {
          id: messageId,
          fromMe: fromMe ?? false,
          remote: normalizePhone(phone) + "@s.whatsapp.net",
        },
      ],
    })
  } catch (err) {
    console.error("markAsRead: failed (best-effort, ignoring)", { messageId, instanceName, error: err })
  }
}

export async function createInstance(
  instanceName: string,
  webhookUrl: string
): Promise<{ qrcode?: { base64: string } }> {
  return (await evoFetch("POST", "/instance/create", {
    instanceName,
    qrcode: true,
    integration: "WHATSAPP-BAILEYS",
    webhook: {
      url: webhookUrl,
      byEvents: false,
      base64: true,
      events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"],
    },
  })) as { qrcode?: { base64: string } }
}

export async function getQRCode(instanceName: string): Promise<string | null> {
  const response = await evoFetch("GET", `/instance/connect/${instanceName}`)
  return (response as { base64?: string } | null)?.base64 ?? null
}

export interface InstanceInfo {
  state: "open" | "connecting" | "close" | null
  phone: string | null
  profileName: string | null
}

export async function getInstanceState(instanceName: string): Promise<"open" | "connecting" | "close" | null> {
  const info = await getInstanceInfo(instanceName)
  return info.state
}

export async function getInstanceInfo(instanceName: string): Promise<InstanceInfo> {
  const response = (await evoFetch(
    "GET",
    `/instance/fetchInstances?instanceName=${instanceName}`
  )) as Array<{ instance: { instanceName: string; state: string; owner?: string; profileName?: string } }>
  const inst = response[0]?.instance
  if (!inst) return { state: null, phone: null, profileName: null }
  const rawOwner = inst.owner ?? ""
  const phone = rawOwner.replace("@s.whatsapp.net", "").replace("@c.us", "") || null
  return {
    state: (inst.state as "open" | "connecting" | "close") ?? null,
    phone,
    profileName: inst.profileName ?? null,
  }
}

export async function deleteInstance(instanceName: string): Promise<void> {
  await evoFetch("DELETE", `/instance/delete/${instanceName}`)
}

// ─── History fetch ────────────────────────────────────────────────────────────

export interface EvolutionChat {
  id: string       // JID: "5511999990000@s.whatsapp.net"
  name: string     // Contact name (from phone book or WhatsApp profile)
  lastMessage?: {
    pushName?: string
    messageTimestamp?: number
  }
}

export interface EvolutionMessage {
  key: { id: string; remoteJid: string; fromMe: boolean }
  message?: {
    conversation?: string
    extendedTextMessage?: { text?: string }
  }
  messageType?: string
  messageTimestamp: number
  pushName?: string
}

export async function fetchChats(instanceName: string): Promise<EvolutionChat[]> {
  try {
    const result = await evoFetch("GET", `/chat/findChats/${instanceName}`)
    if (Array.isArray(result)) return result as EvolutionChat[]
    return []
  } catch (err) {
    console.error("[fetchChats] failed", { instanceName, err })
    return []
  }
}

export async function fetchMessages(
  instanceName: string,
  remoteJid: string,
  limit = 50
): Promise<EvolutionMessage[]> {
  try {
    const result = await evoFetch("POST", `/chat/findMessages/${instanceName}`, {
      where: { key: { remoteJid } },
      limit,
    })
    if (Array.isArray(result)) return result as EvolutionMessage[]
    const obj = result as { messages?: unknown[] } | null
    if (Array.isArray(obj?.messages)) return obj!.messages as EvolutionMessage[]
    return []
  } catch (err) {
    console.error("[fetchMessages] failed", { instanceName, remoteJid, err })
    return []
  }
}
