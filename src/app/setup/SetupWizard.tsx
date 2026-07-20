"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { ChevronRight, Loader2, Check, Sparkles, PenLine, Info, Upload, FileText, X, MapPin, AlertCircle, MessageCircle } from "lucide-react"
import Link from "next/link"
import { BrandMark } from "@/components/BrandMark"
import { finalizeBusiness, generateStepContent, analyzeDocumentsForSetup } from "./actions"
import { WhatsAppConnect } from "@/components/settings/WhatsAppConnect"

// ── Constants ────────────────────────────────────────────────────────────────

const BUSINESS_TYPES = [
  { value: "ac_residential",         label: "Ar Condicionado",        icon: "❄️" },
  { value: "ac_commercial",          label: "Climatização Comercial",  icon: "🏢" },
  { value: "refrigeration",          label: "Refrigeração",            icon: "🧊" },
  { value: "electrician",            label: "Eletricista",             icon: "⚡" },
  { value: "plumber",                label: "Encanador",               icon: "🔩" },
  { value: "locksmith",              label: "Serralheiro",             icon: "🔑" },
  { value: "cleaning",               label: "Limpeza",                 icon: "🧹" },
  { value: "pest_control",           label: "Dedetização",             icon: "🐛" },
  { value: "other_service_business", label: "Outro serviço",           icon: "🔧" },
]

const PAYMENT_OPTIONS = [
  "PIX",
  "Cartão de crédito",
  "Cartão de débito",
  "Boleto",
  "Dinheiro",
  "Cheque",
]

const COMPANY_TYPES = ["MEI", "ME", "EPP", "Ltda", "S/A", "Outros"]

const PIX_KEY_TYPES = ["CPF", "CNPJ", "Telefone", "E-mail", "Chave aleatória"]

const PIX_KEY_PLACEHOLDERS: Record<string, string> = {
  "CPF": "000.000.000-00",
  "CNPJ": "00.000.000/0001-00",
  "Telefone": "(11) 99999-9999",
  "E-mail": "seu@email.com.br",
  "Chave aleatória": "Cole a chave aqui",
}

const STEPS = [
  "type",
  "name",
  "address",
  "legal",
  "documents",
  "services",
  "hours",
  "team",
  "clients",
  "payments",
  "whatsapp",
  "plan",
  "checkout",
] as const
type Step = (typeof STEPS)[number]

const AI_STEPS = new Set<Step>(["services", "hours", "team", "clients"])

// ── Working hours structured types ───────────────────────────────────────────

type DayKey = "seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom"
interface DayHours { open: boolean; start: string; end: string }
type HoursSchedule = Record<DayKey, DayHours>

const DAY_LABELS: { key: DayKey; label: string }[] = [
  { key: "seg", label: "Segunda" },
  { key: "ter", label: "Terça" },
  { key: "qua", label: "Quarta" },
  { key: "qui", label: "Quinta" },
  { key: "sex", label: "Sexta" },
  { key: "sab", label: "Sábado" },
  { key: "dom", label: "Domingo" },
]

const DEFAULT_HOURS_SCHEDULE: HoursSchedule = {
  seg: { open: true,  start: "08:00", end: "18:00" },
  ter: { open: true,  start: "08:00", end: "18:00" },
  qua: { open: true,  start: "08:00", end: "18:00" },
  qui: { open: true,  start: "08:00", end: "18:00" },
  sex: { open: true,  start: "08:00", end: "18:00" },
  sab: { open: true,  start: "08:00", end: "13:00" },
  dom: { open: false, start: "08:00", end: "18:00" },
}

function serializeHoursSchedule(s: HoursSchedule): string {
  return DAY_LABELS.map(({ key, label }) => {
    const d = s[key]
    if (!d.open) return `${label}: Fechado`
    const fmt = (t: string) => t.replace(":", "h").replace(/^0/, "")
    return `${label}: ${fmt(d.start)} às ${fmt(d.end)}`
  }).join("\n")
}

// ── Nominatim result type ────────────────────────────────────────────────────

interface NominatimResult {
  place_id: number
  display_name: string
  address: {
    road?: string
    pedestrian?: string
    house_number?: string
    suburb?: string
    neighbourhood?: string
    quarter?: string
    city?: string
    town?: string
    municipality?: string
    county?: string
    postcode?: string
    "ISO3166-2-lvl4"?: string
  }
}

// ── Data shape ────────────────────────────────────────────────────────────────

interface WizardData {
  type: string
  name: string
  address: string
  phone: string
  city: string
  state: string
  zipCode: string
  services: string
  hours: string
  team: string
  clients: string
  paymentMethods: string[]
  // legal
  companyType: string
  legalName: string
  cnpj: string
  cpfOwner: string
  stateRegistration: string
  municipalRegistration: string
  plan: "starter" | "pro" | "medical"
  // checkout
  pixKeyType: string
  pixKey: string
  promoCode: string
}


// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  businessId: string
  userName: string
  currentName: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripFormatting(v: string) {
  return v.replace(/\D/g, "")
}

function isValidBrazilianPhone(v: string) {
  const digits = stripFormatting(v)
  return digits.length >= 10 && digits.length <= 11
}

function isValidCNPJ(v: string) {
  const digits = stripFormatting(v)
  return digits.length === 14
}

function formatCNPJ(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function formatCPF(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

interface ServiceRow { name: string; price: string }

function parseServicesToRows(text: string): ServiceRow[] {
  const rows = text.split("\n").map(line => {
    const trimmed = line.trim()
    if (!trimmed) return null
    const m = trimmed.match(/^(.+?)\s*[—\-–]\s*R\$\s*([\d.,]+)/)
    if (m) return { name: m[1]!.trim(), price: m[2]!.trim() }
    return { name: trimmed, price: "" }
  }).filter(Boolean) as ServiceRow[]
  return rows.length > 0 ? rows : [{ name: "", price: "" }]
}

function serializeServiceRows(rows: ServiceRow[]): string {
  return rows
    .filter(r => r.name.trim())
    .map(r => `${r.name.trim()}${r.price.trim() ? ` — R$ ${r.price.trim()}` : ""}`)
    .join("\n")
}

interface ClientRow { name: string; phone: string }

function parseClientsToRows(text: string): ClientRow[] {
  const rows = text.split("\n").map(line => {
    const trimmed = line.trim()
    if (!trimmed) return null
    const m = trimmed.match(/^(.+?)\s*[—\-–]\s*(.+)$/)
    if (m) return { name: m[1]!.trim(), phone: m[2]!.trim() }
    return { name: trimmed, phone: "" }
  }).filter(Boolean) as ClientRow[]
  return rows.length > 0 ? rows : [{ name: "", phone: "" }]
}

function serializeClientRows(rows: ClientRow[]): string {
  return rows
    .filter(r => r.name.trim())
    .map(r => `${r.name.trim()}${r.phone.trim() ? ` — ${r.phone.trim()}` : ""}`)
    .join("\n")
}

// ── Hours text → HoursSchedule parser (mirrors server-side parseHoursToJson) ──

const PT_TO_DAY_KEY: Record<string, DayKey> = {
  segunda: "seg", terca: "ter", quarta: "qua",
  quinta: "qui", sexta: "sex", sabado: "sab", domingo: "dom",
}
const DAY_KEY_ORDER: DayKey[] = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"]

function normalizePtDay(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ")
}

function parseHoursTextToSchedule(text: string): HoursSchedule {
  const result: HoursSchedule = { ...DEFAULT_HOURS_SCHEDULE }
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim()
    if (!line) continue
    const colon = line.indexOf(":")
    if (colon === -1) continue
    const dayRaw = normalizePtDay(line.slice(0, colon))
    const hoursRaw = line.slice(colon + 1).trim().toLowerCase()
    const keys: DayKey[] = []
    const rangeMatch = dayRaw.match(/^(.+?)\s+a\s+(.+)$/)
    if (rangeMatch) {
      const from = PT_TO_DAY_KEY[normalizePtDay(rangeMatch[1]!)]
      const to = PT_TO_DAY_KEY[normalizePtDay(rangeMatch[2]!)]
      if (from && to) {
        const fi = DAY_KEY_ORDER.indexOf(from)
        const ti = DAY_KEY_ORDER.indexOf(to)
        if (fi !== -1 && ti !== -1 && fi <= ti) {
          for (let i = fi; i <= ti; i++) keys.push(DAY_KEY_ORDER[i]!)
        }
      }
    } else {
      const k = PT_TO_DAY_KEY[dayRaw]
      if (k) keys.push(k)
    }
    if (keys.length === 0) continue
    if (/fech/.test(hoursRaw)) {
      for (const k of keys) result[k] = { open: false, start: "08:00", end: "18:00" }
      continue
    }
    const m = hoursRaw.match(/(\d+)h?(?::(\d+))?\s*(?:às|as|[-–—])\s*(\d+)h?(?::(\d+))?/)
    if (m) {
      const sh = parseInt(m[1]!, 10), sm = parseInt(m[2] ?? "0", 10)
      const eh = parseInt(m[3]!, 10), em = parseInt(m[4] ?? "0", 10)
      const start = `${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}`
      const end = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`
      for (const k of keys) result[k] = { open: true, start, end }
    }
  }
  return result
}

// ── Validation per step ───────────────────────────────────────────────────────

function validate(step: Step, data: WizardData): string | null {
  switch (step) {
    case "type":
      return data.type ? null : "Selecione o tipo do seu negócio."
    case "name":
      if (data.name.trim().length < 2) return "O nome precisa ter pelo menos 2 caracteres."
      if (data.name.trim().length > 80) return "O nome pode ter no máximo 80 caracteres."
      return null
    case "address":
      if (data.address.trim().length < 10) return "Por favor, informe o endereço completo (mínimo 10 caracteres)."
      if (!/\d/.test(data.address)) return "Inclua o número do endereço (ex: Rua das Flores, 123)."
      return null
    case "documents":
      return null
    case "services": {
      if (data.services.trim().length < 3) return "Informe pelo menos um serviço que você oferece."
      const rows = parseServicesToRows(data.services)
      if (rows.some(r => r.name.trim() && !r.price.trim())) return "Informe o preço de cada serviço antes de continuar."
      return null
    }
    case "hours":
      return null
    case "team":
      if (data.team.trim().length < 2) return "Informe sua equipe ou escreva 'Trabalho sozinho'."
      return null
    case "clients":
      return null
    case "payments":
      if (data.paymentMethods.length === 0) return "Selecione pelo menos uma forma de pagamento."
      return null
    case "legal":
      if (data.cnpj.trim() && !isValidCNPJ(data.cnpj)) return "CNPJ incompleto. Precisa ter 14 dígitos."
      return null
    case "whatsapp":
      return null
    case "plan":
      return null
    case "checkout":
      return null
  }
}

// ── Question messages ─────────────────────────────────────────────────────────

function questionFor(step: Step, firstName: string): string {
  switch (step) {
    case "type":
      return `Olá${firstName ? ", " + firstName : ""}! Sou o RetornAI. Para configurar tudo certo, qual é o tipo de serviço da sua empresa?`
    case "name":
      return "Qual é o nome da sua empresa?"
    case "address":
      return "Qual é o endereço completo do negócio? (Rua, número, bairro, cidade, estado)"
    case "documents":
      return "Quer importar documentos do negócio? Suba tabelas de preço, cardápio ou portfólio — a IA extrai e complementa seus dados."
    case "services":
      return "Quais serviços você oferece? Pode digitar diretamente ou descrever e deixar a IA formatar para você."
    case "hours":
      return "Quais são seus horários de atendimento?"
    case "team":
      return "Quantas pessoas trabalham com você? Descreva sua equipe ou deixe a IA sugerir."
    case "clients":
      return "Já tem clientes? Cadastre-os aqui para começar organizado. Pode pular se quiser."
    case "payments":
      return "Quais formas de pagamento você aceita?"
    case "legal":
      return "Dados da empresa. Preencha o que tiver disponível — pode pular o que não souber agora."
    case "whatsapp":
      return "Conecte o WhatsApp do negócio para receber e responder mensagens dos seus clientes direto no RetornAI."
    case "plan":
      return "Ótimo! Escolha seu plano."
    case "checkout":
      return "Quase lá! Configure como quer receber e finalize."
  }
}

// ── Module-level helper components ───────────────────────────────────────────

function AiMessage({ text }: { text: string }) {
  const lines = text.split("\n")
  return (
    <div className="flex items-start gap-3 mb-6">
      <BrandMark size={36} className="shrink-0 mt-0.5" />
      <div className="bg-surface border border-border rounded-2xl rounded-tl-none px-4 py-3.5 text-sm text-ink leading-relaxed max-w-sm shadow-sm">
        {lines.map((line, i) => (
          line === "" ? <br key={i} /> : <span key={i} className="block">{line}</span>
        ))}
      </div>
    </div>
  )
}

function ErrorBubble({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 mb-5 animate-in fade-in slide-in-from-top-1 duration-200">
      <BrandMark size={36} className="shrink-0 mt-0.5" />
      <div className="bg-danger/8 border border-danger/25 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-danger leading-relaxed max-w-sm">
        Hmm, preciso de uma resposta válida. {message}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function SetupWizard({ businessId, userName, currentName }: Props) {
  const firstName = userName ? userName.split(" ")[0] : ""

  const [step, setStep] = useState<Step>("type")
  const [data, setData] = useState<WizardData>({
    type: "",
    name: currentName || "",
    address: "",
    phone: "",
    city: "",
    state: "",
    zipCode: "",
    services: "",
    hours: "",
    team: "",
    clients: "",
    paymentMethods: [],
    companyType: "",
    legalName: "",
    cnpj: "",
    cpfOwner: "",
    stateRegistration: "",
    municipalRegistration: "",
    plan: "starter",
    pixKeyType: "",
    pixKey: "",
    promoCode: "",
  })
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState("")
  const [isPending, startTransition] = useTransition()


  // Document step state (Files can't serialize into WizardData)
  const [docFiles, setDocFiles] = useState<Array<{ file: File; description: string }>>([])
  const [docAnalyzing, setDocAnalyzing] = useState(false)
  const docInputRef = useRef<HTMLInputElement>(null)

  // AI mode state
  const [inputMode, setInputMode] = useState<"manual" | "ai">("ai")
  const [aiPrompt, setAiPrompt] = useState("")
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiVerified, setAiVerified] = useState(false)
  const [aiQuestion, setAiQuestion] = useState("")
  const [aiFollowUp, setAiFollowUp] = useState("")
  const [aiOutOfScope, setAiOutOfScope] = useState(false)
  const [aiResultReady, setAiResultReady] = useState(false)

  // Service rows state (manual mode structured input)
  const [serviceRows, setServiceRows] = useState<ServiceRow[]>([{ name: "", price: "" }])

  // Client rows state (manual mode structured input)
  const [clientRows, setClientRows] = useState<ClientRow[]>([{ name: "", phone: "" }])

  // Hours schedule state (structured per-day input)
  const [hoursSchedule, setHoursSchedule] = useState<HoursSchedule>(DEFAULT_HOURS_SCHEDULE)

  // WhatsApp step state
  const [whatsappConnected, setWhatsappConnected] = useState(false)
  const [whatsappMode, setWhatsappMode] = useState<"oauth" | "manual">("oauth")
  const [waToken, setWaToken] = useState("")
  const [waPhoneId, setWaPhoneId] = useState("")
  const [waPhoneNumber, setWaPhoneNumber] = useState("")
  const [waSaving, setWaSaving] = useState(false)
  const [waError, setWaError] = useState<string | null>(null)

  // Promo code state
  const [promoApplied, setPromoApplied] = useState(false)

  // Confirmation states
  const [nameConfirmed, setNameConfirmed] = useState(false)
  const [addrStreet, setAddrStreet] = useState("")
  const [addrNum, setAddrNum] = useState("")
  const [addrNeighborhood, setAddrNeighborhood] = useState("")
  const [addrZip, setAddrZip] = useState("")
  const [addrZipLoading, setAddrZipLoading] = useState(false)
  const [addrConfirmed, setAddrConfirmed] = useState(false)
  const [addrSuggestions, setAddrSuggestions] = useState<NominatimResult[]>([])
  const [addrSearchLoading, setAddrSearchLoading] = useState(false)
  const addrSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  const stepIndex = STEPS.indexOf(step)
  const progress = ((stepIndex + 1) / STEPS.length) * 100
  const isLastStep = step === "checkout"

  // Auto-focus main input on step change; reset AI mode; sync service rows
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 120)
    setInputMode("ai")
    setAiPrompt("")
    setAiVerified(false)
    setAiQuestion("")
    setAiFollowUp("")
    setAiOutOfScope(false)
    setAiResultReady(false)
    if (step === "services") {
      setServiceRows(data.services ? parseServicesToRows(data.services) : [{ name: "", price: "" }])
    }
    if (step === "clients") {
      setClientRows(data.clients ? parseClientsToRows(data.clients) : [{ name: "", phone: "" }])
    }
    if (step === "hours") {
      // Serialize current schedule into data.hours so it's always up to date
      setField("hours", serializeHoursSchedule(hoursSchedule))
    }
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // Clear validation error when user changes data
  useEffect(() => {
    setValidationError(null)
  }, [data])

  function setField<K extends keyof WizardData>(key: K, value: WizardData[K]) {
    setData((d) => ({ ...d, [key]: value }))
  }

  function setServiceText(text: string) {
    setField("services", text)
    setServiceRows(parseServicesToRows(text))
  }

  // ── Address autocomplete (Nominatim) + CEP auto-fill ────────────────────────

  function searchAddress(query: string) {
    setAddrStreet(query)
    setAddrSuggestions([])
    if (addrSearchTimer.current) clearTimeout(addrSearchTimer.current)
    if (query.trim().length < 4) return
    addrSearchTimer.current = setTimeout(async () => {
      setAddrSearchLoading(true)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=br&format=json&addressdetails=1&limit=6`,
          { headers: { "Accept-Language": "pt-BR" } }
        )
        const results = await res.json() as NominatimResult[]
        setAddrSuggestions(results)
      } catch { /* ignore */ } finally {
        setAddrSearchLoading(false)
      }
    }, 350)
  }

  function selectSuggestion(result: NominatimResult) {
    const a = result.address
    setAddrStreet(a.road ?? a.pedestrian ?? addrStreet)
    setAddrNum(a.house_number ?? "")
    setAddrNeighborhood(a.suburb ?? a.neighbourhood ?? a.quarter ?? "")
    setField("city", a.city ?? a.town ?? a.municipality ?? a.county ?? "")
    const stateCode = (a["ISO3166-2-lvl4"] ?? "").replace("BR-", "")
    if (stateCode) setField("state", stateCode)
    if (a.postcode) {
      const clean = a.postcode.replace(/\D/g, "")
      setAddrZip(clean.length > 5 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : clean)
      setField("zipCode", clean)
    }
    setAddrSuggestions([])
  }

  async function fetchCep(raw: string) {
    const clean = raw.replace(/\D/g, "").slice(0, 8)
    const formatted = clean.length > 5 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : clean
    setAddrZip(formatted)
    if (clean.length !== 8) return
    setAddrZipLoading(true)
    try {
      const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`)
      const j = await r.json() as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string }
      if (!j.erro) {
        if (j.logradouro && !addrStreet) setAddrStreet(j.logradouro)
        if (j.bairro && !addrNeighborhood) setAddrNeighborhood(j.bairro)
        if (j.localidade) setField("city", j.localidade)
        if (j.uf) setField("state", j.uf)
        setField("zipCode", clean)
      }
    } catch { /* ignore */ } finally {
      setAddrZipLoading(false)
    }
  }

  function confirmAddress() {
    const parts = [
      addrStreet.trim(),
      addrNum.trim(),
      addrNeighborhood.trim() || null,
      data.city.trim() || null,
      data.state.trim() ? data.state.trim().toUpperCase() : null,
    ].filter(Boolean).join(", ")
    const zipStr = data.zipCode
      ? ` — CEP ${data.zipCode.replace(/^(\d{5})(\d{3})$/, "$1-$2")}`
      : ""
    setField("address", parts + zipStr)
    setAddrConfirmed(true)
  }

  // ── AI generation ─────────────────────────────────────────────────────────

  async function handleAiGenerate() {
    const currentStep = step as "services" | "hours" | "team" | "clients"
    setAiGenerating(true)
    setValidationError(null)
    setAiQuestion("")
    setAiOutOfScope(false)
    // Build accumulated prompt so all follow-up answers persist across question rounds
    const combinedPrompt = aiFollowUp.trim()
      ? `${aiPrompt.trim()}\n${aiFollowUp.trim()}`
      : aiPrompt.trim() || undefined
    // Commit the accumulated context immediately so subsequent rounds keep all answers
    if (combinedPrompt) setAiPrompt(combinedPrompt)
    setAiFollowUp("")
    const result = await generateStepContent(currentStep, data.type, data.name, combinedPrompt)
    setAiGenerating(false)
    if (result.outOfScope) {
      setAiOutOfScope(true)
      return
    }
    if (result.question) {
      setAiQuestion(result.question)
      return
    }
    if (result.error) {
      setValidationError(result.error)
      return
    }
    if (result.content) {
      if (currentStep === "services") {
        setServiceText(result.content)
      } else if (currentStep === "hours") {
        setField("hours", result.content)
        setHoursSchedule(parseHoursTextToSchedule(result.content))
        setAiResultReady(true)
      } else if (currentStep === "clients") {
        setField("clients", result.content)
        setClientRows(parseClientsToRows(result.content))
      } else {
        setField(currentStep, result.content)
      }
    }
  }

  // ── Document handlers ─────────────────────────────────────────────────────

  function addDocs(files: FileList | null) {
    if (!files) return
    setDocFiles((prev) => [
      ...prev,
      ...Array.from(files).map((f) => ({ file: f, description: "" })),
    ])
  }

  function updateDocDesc(i: number, desc: string) {
    setDocFiles((prev) => prev.map((d, idx) => (idx === i ? { ...d, description: desc } : d)))
  }

  function removeDoc(i: number) {
    setDocFiles((prev) => prev.filter((_, idx) => idx !== i))
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  function goNext() {
    // Confirmation gates
    if (step === "name" && !nameConfirmed) { setValidationError("Confirme o nome antes de continuar."); return }
    if (step === "address" && !addrConfirmed) { setValidationError("Confirme o endereço antes de continuar."); return }

    // Documents step: analyze then advance
    if (step === "documents") {
      setValidationError(null)
      if (docFiles.length > 0) {
        setDocAnalyzing(true)
        const form = new FormData()
        form.set("businessId", businessId)
        docFiles.forEach((d, i) => {
          form.set(`file_${i}`, d.file)
          form.set(`desc_${i}`, d.description)
        })
        analyzeDocumentsForSetup(form).then((result) => {
          if (result.services) setServiceText(result.services)
          if (result.hours) setField("hours", result.hours)
          if (result.team) setField("team", result.team)
          if (result.name && !data.name.trim()) setField("name", result.name)
          setDocAnalyzing(false)
          setStep(STEPS[stepIndex + 1])
        }).catch(() => {
          setDocAnalyzing(false)
          setStep(STEPS[stepIndex + 1])
        })
        return
      }
      setStep(STEPS[stepIndex + 1])
      return
    }

    const err = validate(step, data)
    if (err) {
      setValidationError(err)
      return
    }
    setValidationError(null)
    if (isLastStep) {
      handleSubmit()
      return
    }
    setStep(STEPS[stepIndex + 1])
  }

  function goBack() {
    setValidationError(null)
    setStep(STEPS[stepIndex - 1])
  }

  function buildFinalizeData() {
    return {
      businessId,
      type: data.type,
      name: data.name,
      address: data.address,
      phone: data.phone,
      city: data.city || undefined,
      state: data.state || undefined,
      zipCode: data.zipCode || undefined,
      services: data.services,
      workingHours: data.hours,
      team: data.team,
      clients: data.clients || undefined,
      paymentMethods: data.paymentMethods,
      cnpj: stripFormatting(data.cnpj),
      plan: data.plan,
      companyType: data.companyType || undefined,
      legalName: data.legalName || undefined,
      cpfOwner: data.cpfOwner || undefined,
      stateRegistration: data.stateRegistration || undefined,
      municipalRegistration: data.municipalRegistration || undefined,
      pixKey: data.pixKey || undefined,
      pixKeyType: data.pixKeyType || undefined,
      promoCode: data.promoCode || undefined,
    }
  }

  function handleSubmit() {
    setSubmitError("")
    startTransition(async () => {
      const result = await finalizeBusiness(buildFinalizeData())
      if (result?.error) setSubmitError(result.error)
    })
  }


  // ── Shared styles ─────────────────────────────────────────────────────────

  const inputCls =
    "w-full px-4 py-3 rounded-xl border border-border bg-surface text-ink text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-colors resize-none"
  const primaryBtn =
    "w-full py-3 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
  const backBtnCls =
    "mt-2 w-full py-2 text-xs text-ink-4 hover:text-ink-3 transition-colors"

  // ── AI step toggle wrapper ────────────────────────────────────────────────

  function AiStepWrapper({
    manualContent,
    aiPlaceholder,
    fieldKey,
  }: {
    manualContent: React.ReactNode
    aiPlaceholder: string
    fieldKey: "services" | "hours" | "team" | "clients"
  }) {
    // For hours, data.hours is pre-populated from the default schedule on step entry,
    // so we use aiResultReady to track whether the AI actually generated content.
    const hasResult = fieldKey === "hours" ? aiResultReady : !!data[fieldKey]

    function resetAiResult() {
      if (fieldKey === "services") setServiceText("")
      else setField(fieldKey, "")
      setAiVerified(false)
      setAiQuestion("")
      setAiFollowUp("")
      if (fieldKey === "hours") setAiResultReady(false)
    }

    function switchToManual() {
      setInputMode("manual")
      // Sync AI-generated hours back to the structured schedule view
      if (fieldKey === "hours") setField("hours", serializeHoursSchedule(hoursSchedule))
    }

    return (
      <div className="space-y-3">
        {/* Mode toggle */}
        <div className="flex gap-1.5 p-1 bg-surface-2 rounded-xl">
          <button
            type="button"
            onClick={switchToManual}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-[color,background-color,border-color,box-shadow] duration-150 ease-brand-out ${
              inputMode === "manual"
                ? "bg-surface border border-border text-ink shadow-sm"
                : "text-ink-3 hover:text-ink-2"
            }`}
          >
            <PenLine className="w-3.5 h-3.5" />
            Digitar manualmente
          </button>
          <button
            type="button"
            onClick={() => { setInputMode("ai"); setAiVerified(false) }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-[color,background-color,border-color,box-shadow] duration-150 ease-brand-out ${
              inputMode === "ai"
                ? "bg-surface border border-brand/30 text-brand shadow-sm"
                : "text-ink-3 hover:text-ink-2"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Descrever com IA
          </button>
        </div>

        {inputMode === "manual" ? (
          manualContent
        ) : (
          <div className="space-y-2">
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder={aiPlaceholder}
              rows={3}
              className={inputCls}
            />

            {/* Clarifying question from AI */}
            {aiQuestion && !hasResult && (
              <div className="space-y-2">
                <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-surface-2 border border-border text-sm text-ink leading-relaxed">
                  <Sparkles className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
                  <span>{aiQuestion}</span>
                </div>
                <textarea
                  value={aiFollowUp}
                  onChange={(e) => setAiFollowUp(e.target.value)}
                  placeholder="Sua resposta..."
                  rows={2}
                  className={inputCls}
                  autoFocus
                />
              </div>
            )}

            {/* Out-of-scope warning */}
            {aiOutOfScope && !hasResult && (
              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-danger/8 border border-danger/25 text-sm text-danger leading-relaxed">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Isso está fora do assunto. Por favor, descreva apenas{" "}
                  {fieldKey === "services"
                    ? "os serviços que seu negócio oferece"
                    : fieldKey === "team"
                    ? "os membros da sua equipe"
                    : fieldKey === "clients"
                    ? "os clientes do seu negócio"
                    : "os horários de atendimento do seu negócio"}.
                </span>
              </div>
            )}

            {/* Generate button — shown when no result yet */}
            {!hasResult && (
              <button
                type="button"
                onClick={handleAiGenerate}
                disabled={aiGenerating || (!aiPrompt.trim() && !aiFollowUp.trim())}
                className="w-full py-2.5 rounded-xl border border-brand/30 bg-tint text-brand text-sm font-semibold flex items-center justify-center gap-2 hover:bg-tint/80 transition-colors disabled:opacity-50"
              >
                {aiGenerating ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando...</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5" /> {aiQuestion ? "Gerar com minha resposta" : "Descrever com IA"}</>
                )}
              </button>
            )}

            {/* Result preview + verify / redo / edit */}
            {hasResult && (
              <div className="rounded-xl bg-tint border border-brand/20 p-3 space-y-3">
                <pre className="text-xs text-ink leading-relaxed whitespace-pre-wrap font-sans">
                  {data[fieldKey]}
                </pre>
                {aiVerified ? (
                  <>
                    <div className="flex items-center gap-2 text-xs text-moss font-medium">
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      Verificado — pode continuar
                    </div>
                    <button
                      type="button"
                      onClick={resetAiResult}
                      disabled={aiGenerating}
                      className="w-full py-2 rounded-lg border border-brand/30 bg-surface text-brand text-sm font-semibold flex items-center justify-center gap-2 hover:bg-tint transition-colors disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Gerar novamente
                    </button>
                    <button type="button" onClick={switchToManual} className="flex items-center gap-1 text-xs text-ink-3 hover:text-ink transition-colors mx-auto">
                      <PenLine className="w-3 h-3" /> Editar manualmente
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAiVerified(true)}
                        className="flex-1 py-2 rounded-lg border-2 border-moss bg-moss/8 text-moss text-sm font-semibold flex items-center justify-center gap-2 hover:bg-moss/15 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" /> Verificar
                      </button>
                      <button
                        type="button"
                        onClick={resetAiResult}
                        disabled={aiGenerating}
                        className="flex-1 py-2 rounded-lg border border-border bg-surface text-ink-2 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-surface-2 transition-colors disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Gerar novamente
                      </button>
                    </div>
                    <button type="button" onClick={switchToManual} className="flex items-center gap-1 text-xs text-ink-3 hover:text-ink transition-colors mx-auto">
                      <PenLine className="w-3 h-3" /> Editar manualmente
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Step content ──────────────────────────────────────────────────────────

  function StepContent() {
    switch (step) {
      // ── 1. Business type ──────────────────────────────────────────────────
      case "type":
        return (
          <div className="grid grid-cols-3 gap-2">
            {BUSINESS_TYPES.map((bt) => (
              <button
                key={bt.value}
                onClick={() => setField("type", bt.value)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-[border-color,background-color] duration-150 ${
                  data.type === bt.value
                    ? "border-brand bg-tint"
                    : "border-border bg-surface hover:border-brand/40 hover:bg-surface-2"
                }`}
              >
                <span className="text-xl">{bt.icon}</span>
                <span className="text-[11px] font-medium text-ink leading-tight">{bt.label}</span>
              </button>
            ))}
          </div>
        )

      // ── 2. Business name ──────────────────────────────────────────────────
      case "name":
        return nameConfirmed ? (
          <div className="flex items-center gap-3 p-4 bg-tint border border-brand/20 rounded-xl">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide mb-0.5">Nome do negócio</p>
              <p className="text-base font-bold text-ink">{data.name}</p>
            </div>
            <button
              type="button"
              onClick={() => setNameConfirmed(false)}
              className="text-xs font-medium text-brand hover:text-brand-2 transition-colors shrink-0"
            >
              Alterar
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              value={data.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Ex: João Elétrica, Friozão AC..."
              maxLength={80}
              autoComplete="off"
              className={inputCls}
            />
            {data.name.trim().length >= 2 && (
              <button
                type="button"
                onClick={() => setNameConfirmed(true)}
                className="w-full py-3 rounded-xl border-2 border-brand/40 bg-tint text-brand text-sm font-semibold flex items-center justify-center gap-2 hover:bg-tint/80 transition-colors"
              >
                <Check className="w-4 h-4" /> Confirmar nome
              </button>
            )}
          </div>
        )

      // ── 3. Address ────────────────────────────────────────────────────────
      case "address":
        return addrConfirmed ? (
          <div className="flex items-start gap-3 p-4 bg-tint border border-brand/20 rounded-xl">
            <MapPin className="w-4 h-4 text-brand shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide mb-0.5">Endereço</p>
              <p className="text-sm font-semibold text-ink leading-snug">{data.address}</p>
            </div>
            <button
              type="button"
              onClick={() => setAddrConfirmed(false)}
              className="text-xs font-medium text-brand hover:text-brand-2 transition-colors shrink-0"
            >
              Alterar
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Rua — with autocomplete dropdown */}
            <div className="relative">
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                value={addrStreet}
                onChange={(e) => searchAddress(e.target.value)}
                onBlur={() => setTimeout(() => setAddrSuggestions([]), 150)}
                placeholder="Rua / Avenida"
                autoComplete="off"
                className={inputCls}
              />
              {addrSearchLoading && (
                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-4 animate-spin pointer-events-none" />
              )}
              {addrSuggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-lg overflow-hidden">
                  {addrSuggestions.map((s) => {
                    const parts = s.display_name.split(", ")
                    const main = parts.slice(0, 2).join(", ")
                    const sub = parts.slice(2, 5).join(", ")
                    return (
                      <button
                        key={s.place_id}
                        type="button"
                        onMouseDown={() => selectSuggestion(s)}
                        className="w-full text-left px-4 py-2.5 hover:bg-surface-2 transition-colors border-b border-border last:border-0"
                      >
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-ink leading-snug">{main}</p>
                            {sub && <p className="text-xs text-ink-3 mt-0.5">{sub}</p>}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Número */}
            <input
              value={addrNum}
              onChange={(e) => setAddrNum(e.target.value)}
              placeholder="Número"
              className={inputCls}
            />

            {/* Bairro */}
            <input
              value={addrNeighborhood}
              onChange={(e) => setAddrNeighborhood(e.target.value)}
              placeholder="Bairro"
              className={inputCls}
            />

            {/* Cidade */}
            <input
              value={data.city}
              onChange={(e) => setField("city", e.target.value)}
              placeholder="Cidade"
              className={inputCls}
            />

            {/* CEP — last; also triggers ViaCEP fill for any missing fields */}
            <div className="relative">
              <input
                value={addrZip}
                onChange={(e) => fetchCep(e.target.value)}
                placeholder="CEP — ex: 01310-100"
                inputMode="numeric"
                maxLength={9}
                className={inputCls}
              />
              {addrZipLoading && (
                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-4 animate-spin pointer-events-none" />
              )}
            </div>

            {addrStreet.trim() && addrNum.trim() && data.city.trim() && (
              <button
                type="button"
                onClick={confirmAddress}
                className="w-full py-3 rounded-xl border-2 border-brand/40 bg-tint text-brand text-sm font-semibold flex items-center justify-center gap-2 hover:bg-tint/80 transition-colors"
              >
                <Check className="w-4 h-4" /> Confirmar endereço
              </button>
            )}
          </div>
        )

      // ── 5. Documents ─────────────────────────────────────────────────────
      case "documents":
        return (
          <div className="space-y-3">
            <p className="text-xs text-ink-3 leading-relaxed">
              Tabela de preços, cardápio, portfólio — a IA extrai serviços, horários e equipe. Opcional.
            </p>

            {/* Drop zone */}
            <div
              onDrop={(e) => { e.preventDefault(); addDocs(e.dataTransfer.files) }}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => docInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-brand/40 hover:bg-tint/20 transition-colors"
            >
              <Upload className="w-6 h-6 mx-auto mb-2 text-ink-4" />
              <p className="text-sm font-medium text-ink">Clique ou solte arquivos aqui</p>
              <p className="text-xs text-ink-3 mt-0.5">PDF, Word, imagens ou texto</p>
              <input
                ref={docInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => addDocs(e.target.files)}
              />
            </div>

            {/* File list */}
            {docFiles.map((d, i) => (
              <div key={i} className="flex items-start gap-2.5 bg-surface border border-border rounded-lg px-3 py-2.5">
                <FileText className="w-4 h-4 text-ink-3 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-ink truncate">{d.file.name}</p>
                  <input
                    type="text"
                    placeholder="O que é esse documento? (opcional)"
                    value={d.description}
                    onChange={(e) => updateDocDesc(i, e.target.value)}
                    className="mt-1.5 w-full text-xs px-2.5 py-1.5 rounded-md border border-border bg-bg text-ink focus:outline-none focus:border-brand transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeDoc(i)}
                  className="text-ink-4 hover:text-danger transition-colors mt-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )

      // ── 6. Services ───────────────────────────────────────────────────────
      case "services":
        return AiStepWrapper({
          fieldKey: "services",
          aiPlaceholder: "Ex: Instalamos ACs de todas as marcas, fazemos manutenção preventiva e corretiva, higienização, instalação de mini split…",
          manualContent: (
            <div className="space-y-2">
              {serviceRows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={row.name}
                    onChange={(e) => {
                      const updated = serviceRows.map((r, idx) => idx === i ? { ...r, name: e.target.value } : r)
                      setServiceRows(updated)
                      setField("services", serializeServiceRows(updated))
                    }}
                    placeholder="Nome do serviço"
                    className={`${inputCls} flex-1`}
                  />
                  <div className="relative shrink-0 w-28">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink-4 pointer-events-none font-medium">R$</span>
                    <input
                      value={row.price}
                      onChange={(e) => {
                        const updated = serviceRows.map((r, idx) => idx === i ? { ...r, price: e.target.value } : r)
                        setServiceRows(updated)
                        setField("services", serializeServiceRows(updated))
                      }}
                      placeholder="0,00"
                      inputMode="decimal"
                      className={`${inputCls} pl-8 ${row.name.trim() && !row.price.trim() ? "border-danger/50 ring-1 ring-danger/20" : ""}`}
                    />
                  </div>
                  {serviceRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = serviceRows.filter((_, idx) => idx !== i)
                        setServiceRows(updated)
                        setField("services", serializeServiceRows(updated))
                      }}
                      className="text-ink-4 hover:text-danger transition-colors shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {serviceRows.some(r => r.name.trim() && !r.price.trim()) && (
                <p className="text-xs text-danger pl-1">Informe o preço de cada serviço.</p>
              )}
              <button
                type="button"
                onClick={() => setServiceRows([...serviceRows, { name: "", price: "" }])}
                className="flex items-center gap-1.5 text-xs text-brand hover:text-brand/80 font-medium transition-colors mt-1"
              >
                <span className="text-base leading-none">+</span> Adicionar serviço
              </button>
            </div>
          ),
        })

      // ── 6. Working hours ──────────────────────────────────────────────────
      case "hours":
        return AiStepWrapper({
          fieldKey: "hours",
          aiPlaceholder: "Ex: Segunda a sexta das 8h às 18h, sábado das 8h ao meio-dia, domingo fechado…",
          manualContent: (
            <div className="space-y-1.5">
              {DAY_LABELS.map(({ key, label }) => {
                const day = hoursSchedule[key]
                const invalidTime = day.open && day.end <= day.start
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                      day.open ? "border-border bg-surface" : "border-border/50 bg-surface-2"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...hoursSchedule, [key]: { ...day, open: !day.open } }
                        setHoursSchedule(updated)
                        setField("hours", serializeHoursSchedule(updated))
                      }}
                      className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-colors ${
                        day.open ? "bg-brand border-brand text-white" : "border-border bg-surface"
                      }`}
                    >
                      {day.open && <Check className="w-3 h-3" />}
                    </button>

                    <span className={`w-16 text-sm shrink-0 font-medium ${day.open ? "text-ink" : "text-ink-4"}`}>
                      {label}
                    </span>

                    {day.open ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input
                          type="time"
                          value={day.start}
                          onChange={(e) => {
                            const updated = { ...hoursSchedule, [key]: { ...day, start: e.target.value } }
                            setHoursSchedule(updated)
                            setField("hours", serializeHoursSchedule(updated))
                          }}
                          className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-border bg-bg text-sm text-ink focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
                        />
                        <span className="text-xs text-ink-4 shrink-0">às</span>
                        <input
                          type="time"
                          value={day.end}
                          onChange={(e) => {
                            const updated = { ...hoursSchedule, [key]: { ...day, end: e.target.value } }
                            setHoursSchedule(updated)
                            setField("hours", serializeHoursSchedule(updated))
                          }}
                          className={`flex-1 min-w-0 px-2 py-1.5 rounded-lg border text-sm text-ink focus:outline-none focus:ring-1 transition-colors ${
                            invalidTime
                              ? "border-danger/50 bg-danger/5 focus:border-danger focus:ring-danger/20"
                              : "border-border bg-bg focus:border-brand focus:ring-brand/30"
                          }`}
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-ink-4 flex-1">Fechado</span>
                    )}
                  </div>
                )
              })}
              {DAY_LABELS.some(({ key }) => hoursSchedule[key].open && hoursSchedule[key].end <= hoursSchedule[key].start) && (
                <p className="text-xs text-danger px-1 mt-1">
                  Horário de encerramento deve ser após a abertura.
                </p>
              )}
            </div>
          ),
        })

      // ── 7. Team ───────────────────────────────────────────────────────────
      case "team":
        return AiStepWrapper({
          fieldKey: "team",
          aiPlaceholder: "Ex: Somos 3 pessoas — eu faço instalação, o João faz manutenção e a Ana cuida do atendimento ao cliente…",
          manualContent: (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={data.team}
              onChange={(e) => setField("team", e.target.value)}
              placeholder={"João — Técnico\nMaria — Atendimento\n\nou: Trabalho sozinho"}
              rows={4}
              className={inputCls}
            />
          ),
        })

      // ── 8. Existing clients ───────────────────────────────────────────────
      case "clients":
        return AiStepWrapper({
          fieldKey: "clients",
          aiPlaceholder: "Ex: João da padaria (11) 99999-8888, Maria da farmácia (11) 77777-6666, cliente desde 2023…",
          manualContent: (
            <div className="space-y-2">
              {clientRows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={row.name}
                    onChange={(e) => {
                      const updated = clientRows.map((r, idx) => idx === i ? { ...r, name: e.target.value } : r)
                      setClientRows(updated)
                      setField("clients", serializeClientRows(updated))
                    }}
                    placeholder="Nome do cliente"
                    className={`${inputCls} flex-1`}
                  />
                  <input
                    value={row.phone}
                    onChange={(e) => {
                      const updated = clientRows.map((r, idx) => idx === i ? { ...r, phone: e.target.value } : r)
                      setClientRows(updated)
                      setField("clients", serializeClientRows(updated))
                    }}
                    placeholder="Telefone (opcional)"
                    className={`${inputCls} w-44 shrink-0`}
                  />
                  {clientRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = clientRows.filter((_, idx) => idx !== i)
                        setClientRows(updated)
                        setField("clients", serializeClientRows(updated))
                      }}
                      className="text-ink-4 hover:text-danger transition-colors shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setClientRows([...clientRows, { name: "", phone: "" }])}
                className="flex items-center gap-1.5 text-xs text-brand hover:text-brand/80 font-medium transition-colors mt-1"
              >
                <span className="text-base leading-none">+</span> Adicionar cliente
              </button>
            </div>
          ),
        })

      // ── 9. Payment methods ────────────────────────────────────────────────
      case "payments":
        return (
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_OPTIONS.map((opt) => {
              const selected = data.paymentMethods.includes(opt)
              return (
                <button
                  key={opt}
                  onClick={() =>
                    setField(
                      "paymentMethods",
                      selected
                        ? data.paymentMethods.filter((m) => m !== opt)
                        : [...data.paymentMethods, opt]
                    )
                  }
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium text-left transition-[border-color,background-color] duration-150 ${
                    selected
                      ? "border-brand bg-tint text-ink"
                      : "border-border bg-surface hover:border-brand/40 text-ink-2"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                      selected ? "border-brand bg-brand" : "border-border"
                    }`}
                  >
                    {selected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                  </span>
                  {opt}
                </button>
              )
            })}
          </div>
        )

      // ── 9. Legal ──────────────────────────────────────────────────────────
      case "legal": {
        const cnpjDigits = stripFormatting(data.cnpj)
        const cnpjVerified = cnpjDigits.length === 14
        return (
          <div className="space-y-4">
            {/* Company type */}
            <div>
              <p className="text-xs font-medium text-ink-3 mb-2">Tipo de empresa</p>
              <div className="grid grid-cols-3 gap-2">
                {COMPANY_TYPES.map((ct) => (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => setField("companyType", data.companyType === ct ? "" : ct)}
                    className={`py-2 px-3 rounded-xl border text-sm font-medium text-center transition-[border-color,background-color] duration-150 ${
                      data.companyType === ct
                        ? "border-brand bg-tint text-ink"
                        : "border-border bg-surface hover:border-brand/40 text-ink-2"
                    }`}
                  >
                    {ct}
                  </button>
                ))}
              </div>
            </div>

            {/* Legal name */}
            <div>
              <p className="text-xs font-medium text-ink-3 mb-1.5">Razão social <span className="text-ink-4">(opcional)</span></p>
              <input
                value={data.legalName}
                onChange={(e) => setField("legalName", e.target.value)}
                placeholder="Nome jurídico da empresa"
                className={inputCls}
              />
            </div>

            {/* CNPJ */}
            <div>
              <p className="text-xs font-medium text-ink-3 mb-1.5">CNPJ <span className="text-ink-4">(opcional)</span></p>
              <div className="relative">
                <input
                  value={data.cnpj}
                  onChange={(e) => setField("cnpj", formatCNPJ(e.target.value))}
                  placeholder="00.000.000/0001-00"
                  inputMode="numeric"
                  className={`${inputCls} ${cnpjVerified ? "pr-32" : ""}`}
                />
                {cnpjVerified && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-success flex items-center gap-1 animate-in fade-in duration-200">
                    <Check className="w-3.5 h-3.5" />verificado
                  </span>
                )}
              </div>
            </div>

            {/* CPF — only for MEI */}
            {data.companyType === "MEI" && (
              <div>
                <p className="text-xs font-medium text-ink-3 mb-1.5">CPF do responsável <span className="text-ink-4">(opcional)</span></p>
                <input
                  value={data.cpfOwner}
                  onChange={(e) => setField("cpfOwner", formatCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  className={inputCls}
                />
              </div>
            )}

            {/* State + Municipal registration */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs font-medium text-ink-3 mb-1.5">Insc. Estadual <span className="text-ink-4">(opcional)</span></p>
                <input
                  value={data.stateRegistration}
                  onChange={(e) => setField("stateRegistration", e.target.value)}
                  placeholder="000.000.000.000"
                  className={inputCls}
                />
              </div>
              <div>
                <p className="text-xs font-medium text-ink-3 mb-1.5">Insc. Municipal <span className="text-ink-4">(opcional)</span></p>
                <input
                  value={data.municipalRegistration}
                  onChange={(e) => setField("municipalRegistration", e.target.value)}
                  placeholder="00000-0"
                  className={inputCls}
                />
              </div>
            </div>

            <p className="text-xs text-ink-4 pl-1">Campos opcionais — você pode preencher ou atualizar depois no painel.</p>
          </div>
        )
      }

      // ── WhatsApp ──────────────────────────────────────────────────────────
      case "whatsapp":
        return (
          <div className="space-y-4">
            {whatsappConnected ? (
              <div className="flex items-center gap-3 rounded-xl border border-moss/30 bg-moss/5 px-4 py-3">
                <MessageCircle className="w-5 h-5 text-moss shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-ink">WhatsApp conectado</p>
                  {data.phone && <p className="text-xs text-ink-3">{data.phone}</p>}
                </div>
              </div>
            ) : (
              <>
                {/* Mode toggle */}
                <div className="flex gap-1.5 p-1 bg-surface-2 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setWhatsappMode("oauth")}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-[color,background-color,border-color,box-shadow] duration-150 ease-brand-out ${
                      whatsappMode === "oauth"
                        ? "bg-surface border border-border text-ink shadow-sm"
                        : "text-ink-3 hover:text-ink-2"
                    }`}
                  >
                    Conectar com Meta
                  </button>
                  <button
                    type="button"
                    onClick={() => setWhatsappMode("manual")}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-[color,background-color,border-color,box-shadow] duration-150 ease-brand-out ${
                      whatsappMode === "manual"
                        ? "bg-surface border border-brand/30 text-brand shadow-sm"
                        : "text-ink-3 hover:text-ink-2"
                    }`}
                  >
                    Inserir manualmente
                  </button>
                </div>

                {whatsappMode === "oauth" ? (
                  <>
                    <WhatsAppConnect
                      initialConnected={false}
                      onConnected={(phone) => {
                        setWhatsappConnected(true)
                        if (phone) setField("phone", phone)
                      }}
                    />
                    <p className="text-xs text-ink-4 leading-relaxed">
                      Você será redirecionado para o Meta para autorizar o acesso. Isso leva menos de 1 minuto e não interfere no seu WhatsApp pessoal.
                    </p>
                  </>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-ink-3 leading-relaxed">
                      Cole as credenciais do Meta Developer Console → WhatsApp → API Setup.
                    </p>
                    <input
                      value={waToken}
                      onChange={(e) => setWaToken(e.target.value)}
                      placeholder="Access Token"
                      className={inputCls}
                    />
                    <input
                      value={waPhoneId}
                      onChange={(e) => setWaPhoneId(e.target.value)}
                      placeholder="Phone Number ID"
                      className={inputCls}
                    />
                    <input
                      value={waPhoneNumber}
                      onChange={(e) => setWaPhoneNumber(e.target.value)}
                      placeholder="Número de exibição (ex: +1 555 555 5555)"
                      className={inputCls}
                    />
                    {waError && (
                      <p className="text-xs text-danger">{waError}</p>
                    )}
                    <button
                      type="button"
                      disabled={waSaving || !waToken.trim() || !waPhoneId.trim() || !waPhoneNumber.trim()}
                      onClick={async () => {
                        setWaSaving(true)
                        setWaError(null)
                        try {
                          const res = await fetch("/api/whatsapp/connect-manual", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ token: waToken.trim(), phoneId: waPhoneId.trim(), phoneNumber: waPhoneNumber.trim() }),
                          })
                          const body = await res.json() as { error?: string; phone?: string }
                          if (!res.ok) throw new Error(body.error ?? "Erro ao salvar")
                          setWhatsappConnected(true)
                          setField("phone", body.phone ?? waPhoneNumber.trim())
                        } catch (err) {
                          setWaError(err instanceof Error ? err.message : "Erro desconhecido")
                        } finally {
                          setWaSaving(false)
                        }
                      }}
                      className="w-full py-3 rounded-xl border-2 border-brand/40 bg-tint text-brand text-sm font-semibold flex items-center justify-center gap-2 hover:bg-tint/80 transition-colors disabled:opacity-40"
                    >
                      {waSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : <><Check className="w-4 h-4" /> Salvar credenciais</>}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )

      // ── 10. Plan ──────────────────────────────────────────────────────────
      case "plan":
        return (
          <div className="space-y-3">
            {([
              { id: "starter", label: "Starter", price: "R$149,90", desc: "Clientes, agenda, pagamentos, conversas, automações" },
              { id: "pro",     label: "Pro",     price: "R$199,90", desc: "Tudo do Starter + analytics avançado, insights de IA, assistente RetornAI" },
              { id: "medical", label: "Medical", price: "R$249,90", desc: "Tudo do Pro + prontuários SOAP, anamnese, prescrições, pedidos de exames, convênios" },
            ] as const).map(({ id, label, price, desc }) => (
              <button
                key={id}
                onClick={() => setField("plan", id)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-[border-color,background-color] duration-150 ${
                  data.plan === id ? "border-brand bg-tint" : "border-border bg-surface hover:border-brand/30"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-ink">{label}</span>
                  <span className="font-bold text-ink">
                    {price}
                    <span className="text-xs font-normal text-ink-3">/mês</span>
                  </span>
                </div>
                <p className="text-xs text-ink-3 leading-relaxed">{desc}</p>
              </button>
            ))}
          </div>
        )

      // ── 11. Checkout ──────────────────────────────────────────────────────
      case "checkout": {
        const planLabel = data.plan === "medical" ? "Medical" : data.plan === "pro" ? "Pro" : "Starter"
        const planPrice = data.plan === "medical" ? "R$249,90/mês" : data.plan === "pro" ? "R$199,90/mês" : "R$149,90/mês"
        return (
          <div className="space-y-5">
            {/* Plan recap */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-surface-2">
              <div>
                <p className="text-xs text-ink-4 mb-0.5">Plano selecionado</p>
                <p className="font-bold text-ink">{planLabel} — {planPrice}</p>
              </div>
              <button
                type="button"
                onClick={goBack}
                className="text-xs text-brand hover:underline font-medium"
              >
                ← Mudar
              </button>
            </div>

            {/* PIX key */}
            <div>
              <p className="text-xs font-medium text-ink-3 mb-2">
                Receber via PIX <span className="text-ink-4">(opcional)</span>
              </p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {PIX_KEY_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setField("pixKeyType", data.pixKeyType === t ? "" : t)
                      setField("pixKey", "")
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-[border-color,background-color] duration-150 ${
                      data.pixKeyType === t
                        ? "border-brand bg-tint text-ink"
                        : "border-border bg-surface text-ink-3 hover:border-brand/40"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {data.pixKeyType && (
                <input
                  value={data.pixKey}
                  onChange={(e) => setField("pixKey", e.target.value)}
                  placeholder={PIX_KEY_PLACEHOLDERS[data.pixKeyType] ?? "Informe a chave"}
                  className={inputCls}
                />
              )}
            </div>

            {/* Promo code */}
            <div>
              <p className="text-xs font-medium text-ink-3 mb-2">
                Código promocional <span className="text-ink-4">(opcional)</span>
              </p>
              {promoApplied ? (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-success/30 bg-success/5 text-sm text-success font-medium">
                  <Check className="w-4 h-4" />
                  Cupom aplicado: <span className="font-bold">{data.promoCode.toUpperCase()}</span>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={data.promoCode}
                    onChange={(e) => setField("promoCode", e.target.value.toUpperCase())}
                    placeholder="Ex: BETA2026"
                    className={`${inputCls} flex-1 uppercase tracking-wider`}
                  />
                  <button
                    type="button"
                    onClick={() => { if (data.promoCode.trim()) setPromoApplied(true) }}
                    disabled={!data.promoCode.trim()}
                    className="shrink-0 h-[46px] px-4 rounded-xl border border-brand/40 bg-tint text-brand text-sm font-semibold transition-colors hover:bg-tint/80 disabled:opacity-40"
                  >
                    Aplicar
                  </button>
                </div>
              )}
            </div>

            {/* Payment status */}
            {promoApplied ? (
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl border border-success/30 bg-success/5">
                <Check className="w-4 h-4 text-success shrink-0" />
                <p className="text-xs font-medium text-success">
                  Código aplicado — acesso liberado sem cobrança.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-surface-2">
                <Info className="w-4 h-4 text-ink-3 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-ink mb-1">Acesso gratuito durante o período de teste</p>
                  <p className="text-xs text-ink-3 leading-relaxed">
                    Você não será cobrado agora. Configure o pagamento depois em <span className="font-medium text-ink">Plano &amp; Assinatura</span>.
                  </p>
                </div>
              </div>
            )}
          </div>
        )
      }
    }
  }

  // ── Continue button label ─────────────────────────────────────────────────

  function continueLabel() {
    if (isLastStep) {
      if (isPending) return <><Loader2 className="w-4 h-4 animate-spin" /> Processando...</>
      if (promoApplied) return <>Ativar conta <Check className="w-4 h-4" /></>
      const price = data.plan === "medical" ? "R$249,90/mês" : data.plan === "pro" ? "R$199,90/mês" : "R$149,90/mês"
      return <>Pagar {price} via Mercado Pago <ChevronRight className="w-4 h-4" /></>
    }
    if (step === "documents") {
      if (docAnalyzing) return <><Loader2 className="w-4 h-4 animate-spin" /> Analisando...</>
      if (docFiles.length > 0) return <>Analisar e Continuar <ChevronRight className="w-4 h-4" /></>
      return <>Pular <ChevronRight className="w-4 h-4" /></>
    }
    if (step === "legal" && !data.cnpj && !data.legalName && !data.companyType) {
      return <>Pular <ChevronRight className="w-4 h-4" /></>
    }
    if (step === "whatsapp" && !whatsappConnected) {
      return <>Pular <ChevronRight className="w-4 h-4" /></>
    }
    return <>Continuar <ChevronRight className="w-4 h-4" /></>
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Sticky header */}
      <div className="border-b border-border bg-surface/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <BrandMark size={28} />
          <span className="font-bold text-base text-ink tracking-tight">
            retorn<span className="text-brand">.ai</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`rounded-full transition-[width,height,background-color,transform] duration-200 ease-brand-out ${
                i < stepIndex
                  ? "w-1.5 h-1.5 bg-brand"
                  : i === stepIndex
                  ? "w-2 h-2 bg-brand scale-110"
                  : "w-1.5 h-1.5 bg-border"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-surface-2">
        <div
          className="h-0.5 transition-all duration-500 ease-out"
          style={{ width: `${progress}%`, background: "var(--brand-grad)" }}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-start justify-center px-4 py-12">
        <div
          key={step}
          className="w-full max-w-md animate-in fade-in slide-in-from-bottom-3 duration-300"
        >
          <AiMessage text={questionFor(step, firstName)} />

          {validationError && <ErrorBubble message={validationError} />}

          {StepContent()}

          {submitError && (
            <p className="mt-3 text-xs text-danger text-center">{submitError}</p>
          )}

          <button
            type="button"
            onClick={goNext}
            disabled={
              isPending || docAnalyzing || aiGenerating ||
              (AI_STEPS.has(step) && inputMode === "ai" && !aiVerified) ||
              (step === "name" && !nameConfirmed) ||
              (step === "address" && !addrConfirmed)
            }
            className={`mt-6 ${primaryBtn}`}
            style={{ background: "var(--brand-grad)" }}
          >
            {continueLabel()}
          </button>

          {stepIndex > 0 ? (
            <button type="button" onClick={goBack} className={backBtnCls}>
              ← Voltar
            </button>
          ) : (
            <Link href="/dashboard" className={backBtnCls}>
              ← Dashboard
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
