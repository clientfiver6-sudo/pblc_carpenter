import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

/**
 * ISO instant for the start of "today" in America/São_Paulo, the timezone the
 * whole app uses as its day boundary. Works identically on server (UTC) and
 * client (any browser tz) and is DST-safe, so daily limits/counters agree.
 */
export function saoPauloDayStartISO(now: Date = new Date()): string {
  // SP wall-clock time, reinterpreted in the runtime's local tz
  const sp = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const diffMs = now.getTime() - sp.getTime();
  sp.setHours(0, 0, 0, 0);
  return new Date(sp.getTime() + diffMs).toISOString();
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function formatDate(date: string | Date, pattern = "dd/MM/yyyy"): string {
  return format(new Date(date), pattern, { locale: ptBR });
}

export function formatDateTime(date: string | Date): string {
  // Always display in São Paulo timezone (UTC-3, no DST in Brazil since 2019)
  const s = new Date(date).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  })
  // "02/06/2025, 11:00" → "02/06/2025 às 11:00"
  return s.replace(",", " às")
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function parsePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11 || /^(.)\1+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let check = (sum * 10) % 11;
  if (check === 10 || check === 11) check = 0;
  if (check !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  check = (sum * 10) % 11;
  if (check === 10 || check === 11) check = 0;
  return check === parseInt(digits[10]);
}
