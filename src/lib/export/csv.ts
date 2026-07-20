/**
 * CSV generation utility for Brazilian locale.
 * - BOM prefix for UTF-8 Excel compatibility
 * - Semicolon (;) delimiter — standard in Brazil
 * - Fields containing semicolons, quotes, or newlines are double-quoted
 */

const BOM = "﻿";
const DELIMITER = ";";

function escapeField(value: string): string {
  // Wrap in quotes if value contains delimiter, double-quote, or newline
  if (value.includes(DELIMITER) || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function generateCsv(headers: string[], rows: string[][]): string {
  const lines: string[] = [];

  // Header row
  lines.push(headers.map(escapeField).join(DELIMITER));

  // Data rows
  for (const row of rows) {
    lines.push(row.map(escapeField).join(DELIMITER));
  }

  return BOM + lines.join("\r\n");
}

/**
 * Format cents as Brazilian currency string for CSV (e.g. 150000 => "1500,00")
 */
export function formatCurrencyCsv(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * Format ISO date string as Brazilian date (DD/MM/YYYY)
 */
export function formatDateBr(isoString: string | null | undefined): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
