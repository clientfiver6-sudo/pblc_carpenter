"use client";

import { useState, useRef, useCallback, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Upload,
  ChevronRight,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Download,
} from "lucide-react";

// ── CSV parsing helpers (client-side, mirrors API logic) ──────────────────

function splitLine(line: string, delimiter: string): string[] {
  return line.split(delimiter).map((v) => v.trim().replace(/^"|"$/g, ""));
}

interface ParsedCSV {
  headers: string[];
  rows: string[][];
  delimiter: string;
}

function parseCSVClient(text: string): ParsedCSV {
  const lines = text
    .replace(/^﻿/, "") // strip BOM
    .split("\n")
    .map((l) => l.replace(/\r$/, ""))
    .filter((l) => l.trim() !== "");

  if (lines.length === 0) return { headers: [], rows: [], delimiter: "," };

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = splitLine(lines[0], delimiter).map((h) => h.toLowerCase().trim());
  const rows = lines.slice(1).map((l) => splitLine(l, delimiter));

  return { headers, rows, delimiter };
}

function mapHeaderIndex(headers: string[]): {
  nameIdx: number;
  phoneIdx: number;
  emailIdx: number;
  tagsIdx: number;
} {
  let nameIdx = -1;
  let phoneIdx = -1;
  let emailIdx = -1;
  let tagsIdx = -1;

  headers.forEach((h, i) => {
    if (h === "nome" || h === "name") nameIdx = i;
    else if (h === "telefone" || h === "phone") phoneIdx = i;
    else if (h === "email") emailIdx = i;
    else if (h === "etiquetas" || h === "tags") tagsIdx = i;
  });

  return { nameIdx, phoneIdx, emailIdx, tagsIdx };
}

interface PreviewRow {
  name: string;
  phone: string;
  email: string;
  tags: string;
}

// ── Template download ────────────────────────────────────────────────────

function downloadTemplate() {
  const template =
    "Nome;Telefone;Email;Etiquetas\nJoão Silva;11987654321;joao@email.com;vip\n";
  const blob = new Blob(["﻿" + template], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo_importacao.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Types ────────────────────────────────────────────────────────────────

type Step = "upload" | "preview" | "result";

interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// ── Component ────────────────────────────────────────────────────────────

export function ImportDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, startImporting] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetState() {
    setStep("upload");
    setFile(null);
    setPreviewRows([]);
    setTotalRows(0);
    setResult(null);
    setError(null);
    setIsDragging(false);
  }

  function handleOpenChange(val: boolean) {
    setOpen(val);
    if (!val) {
      setTimeout(resetState, 300);
    }
  }

  function processFile(f: File) {
    if (!f.name.endsWith(".csv")) {
      setError("Apenas arquivos .csv são aceitos.");
      return;
    }
    setFile(f);
    setError(null);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  async function handleGoToPreview() {
    if (!file) {
      setError("Selecione um arquivo CSV.");
      return;
    }
    setError(null);

    try {
      const text = await file.text();
      const { headers, rows } = parseCSVClient(text);
      const { nameIdx, phoneIdx, emailIdx, tagsIdx } = mapHeaderIndex(headers);

      const validRows = rows.filter(
        (r) => nameIdx >= 0 && (r[nameIdx] ?? "").trim() !== ""
      );

      const preview: PreviewRow[] = validRows.slice(0, 5).map((r) => ({
        name: nameIdx >= 0 ? (r[nameIdx] ?? "") : "",
        phone: phoneIdx >= 0 ? (r[phoneIdx] ?? "") : "",
        email: emailIdx >= 0 ? (r[emailIdx] ?? "") : "",
        tags: tagsIdx >= 0 ? (r[tagsIdx] ?? "") : "",
      }));

      setPreviewRows(preview);
      setTotalRows(validRows.length);
      setStep("preview");
    } catch {
      setError("Erro ao ler o arquivo. Verifique se é um CSV válido.");
    }
  }

  function handleImport() {
    if (!file) return;
    setError(null);

    startImporting(async () => {
      try {
        const fd = new FormData();
        fd.append("file", file);

        const res = await fetch("/api/import/customers", {
          method: "POST",
          body: fd,
        });

        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          throw new Error(body.error ?? `Erro ${res.status}`);
        }

        const data = (await res.json()) as ImportResult;
        setResult(data);
        setStep("result");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erro ao importar clientes."
        );
      }
    });
  }

  const stepLabels: { key: Step; label: string }[] = [
    { key: "upload", label: "1. Arquivo" },
    { key: "preview", label: "2. Pré-visualizar" },
    { key: "result", label: "3. Resultado" },
  ];

  const stepOrder: Step[] = ["upload", "preview", "result"];
  const currentStepIndex = stepOrder.indexOf(step);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-2 border-border bg-surface text-ink-2 hover:bg-surface-2 rounded-md h-auto px-4 py-2 text-left flex-col items-start"
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Upload className="w-4 h-4 shrink-0" />
          Importar Clientes Com IA
        </span>
        <span className="text-[11px] text-ink-3 font-normal pl-5">Foto, CSV ou Excel — a IA extrai tudo</span>
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="bg-surface border-border text-ink max-w-lg rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-ink">
              <Upload className="w-5 h-5 text-brand" />
              Importar Clientes Com IA
            </DialogTitle>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 text-xs text-ink-3">
            {stepLabels.map(({ key, label }, i) => (
              <div key={key} className="flex items-center gap-2">
                {i > 0 && <ChevronRight className="w-3 h-3" />}
                <span
                  className={cn(
                    "px-2 py-0.5 rounded",
                    step === key
                      ? "text-brand bg-tint font-medium"
                      : currentStepIndex > i
                      ? "text-ink-4 line-through"
                      : "text-ink-3"
                  )}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* ── Step 1: Upload ── */}
          {step === "upload" && (
            <div className="space-y-4">
              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "bg-surface-2 border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer transition-colors",
                  isDragging
                    ? "border-brand bg-tint"
                    : file
                    ? "border-brand/50 bg-tint"
                    : "hover:border-border-2"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileInput}
                  className="hidden"
                />
                {file ? (
                  <div className="space-y-2">
                    <FileText className="w-8 h-8 text-brand mx-auto" />
                    <p className="text-sm font-medium text-ink">
                      {file.name}
                    </p>
                    <p className="text-xs text-ink-3">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                    <p className="text-xs text-ink-2">
                      Clique para trocar o arquivo
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-8 h-8 text-ink-4 mx-auto" />
                    <p className="text-sm text-ink-2">
                      Arraste um arquivo CSV aqui ou{" "}
                      <span className="text-brand">clique para selecionar</span>
                    </p>
                    <p className="text-xs text-ink-3">
                      Suporta delimitadores por vírgula ou ponto-e-vírgula
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <p className="text-xs text-danger flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </p>
              )}

              <p className="text-xs text-ink-3">
                Colunas reconhecidas:{" "}
                <span className="font-mono text-ink-2">
                  Nome / Telefone / Email / Etiquetas
                </span>
              </p>
            </div>
          )}

          {/* ── Step 2: Preview ── */}
          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-ink-2">
                  <span className="text-ink font-semibold">
                    {totalRows}
                  </span>{" "}
                  registro{totalRows !== 1 ? "s" : ""} encontrado
                  {totalRows !== 1 ? "s" : ""}
                </p>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="flex items-center gap-1 text-xs text-ink-2 hover:text-brand transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar modelo
                </button>
              </div>

              {/* Preview table */}
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-surface-2">
                        {["Nome", "Telefone", "Email", "Tags"].map((col) => (
                          <th
                            key={col}
                            className="text-left px-3 py-2 text-ink-3 font-semibold"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-4 text-center text-ink-3"
                          >
                            Nenhum dado com nome encontrado
                          </td>
                        </tr>
                      ) : (
                        previewRows.map((row, i) => (
                          <tr
                            key={i}
                            className={cn(
                              "border-b border-border last:border-0",
                              i % 2 === 0 ? "bg-surface" : "bg-surface-2"
                            )}
                          >
                            <td className="px-3 py-2 text-ink max-w-[120px] truncate">
                              {row.name || "—"}
                            </td>
                            <td className="px-3 py-2 text-ink-2 font-mono">
                              {row.phone || "—"}
                            </td>
                            <td className="px-3 py-2 text-ink-2 max-w-[120px] truncate">
                              {row.email || "—"}
                            </td>
                            <td className="px-3 py-2 text-ink-2">
                              {row.tags || "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {totalRows > 5 && (
                  <div className="px-3 py-2 bg-surface-2 border-t border-border text-xs text-ink-3">
                    Mostrando 5 de {totalRows} registros
                  </div>
                )}
              </div>

              {error && (
                <p className="text-xs text-danger flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </p>
              )}
            </div>
          )}

          {/* ── Step 3: Result ── */}
          {step === "result" && (
            <div className="space-y-4">
              {isImporting ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <Loader2 className="w-8 h-8 text-brand animate-spin" />
                  <p className="text-sm text-ink-2">Importando clientes...</p>
                </div>
              ) : result ? (
                <div className="rounded-lg border border-border bg-surface-2 p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-8 h-8 text-moss shrink-0" />
                    <div>
                      <p className="font-semibold text-ink">
                        Importação concluída
                      </p>
                      <p className="text-xs text-ink-2 mt-0.5">
                        Arquivo processado com sucesso
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div className="rounded-md bg-surface border border-border p-3 text-center">
                      <p className="text-xl font-bold font-mono text-brand">
                        {result.imported}
                      </p>
                      <p className="text-xs text-ink-3 mt-0.5">Importados</p>
                    </div>
                    <div className="rounded-md bg-surface border border-border p-3 text-center">
                      <p className="text-xl font-bold font-mono text-ink">
                        {result.updated}
                      </p>
                      <p className="text-xs text-ink-3 mt-0.5">Atualizados</p>
                    </div>
                    <div className="rounded-md bg-surface border border-border p-3 text-center">
                      <p className="text-xl font-bold font-mono text-ink-3">
                        {result.skipped}
                      </p>
                      <p className="text-xs text-ink-3 mt-0.5">Ignorados</p>
                    </div>
                  </div>

                  {result.errors.length > 0 && (
                    <div className="rounded-md bg-danger/5 border border-danger/20 p-3 space-y-1 max-h-32 overflow-y-auto">
                      <p className="text-xs font-medium text-danger mb-2">
                        {result.errors.length} erro
                        {result.errors.length !== 1 ? "s" : ""}:
                      </p>
                      {result.errors.map((e, i) => (
                        <p key={i} className="text-xs text-danger/80">
                          {e}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ) : error ? (
                <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-danger shrink-0" />
                    <p className="text-sm font-medium text-danger">
                      Erro na importação
                    </p>
                  </div>
                  <p className="text-xs text-danger/80 ml-7">{error}</p>
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter className="flex items-center gap-2">
            {/* Back / Cancel / Close */}
            {step === "upload" && (
              <Button
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                className="border border-border bg-surface text-ink-2 hover:bg-surface-2 rounded-md h-9 px-4 text-sm font-semibold"
              >
                Cancelar
              </Button>
            )}
            {step === "preview" && (
              <Button
                variant="ghost"
                onClick={() => setStep("upload")}
                className="border border-border bg-surface text-ink-2 hover:bg-surface-2 rounded-md h-9 px-4 text-sm font-semibold gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Voltar
              </Button>
            )}
            {step === "result" && (
              <Button
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                className="border border-border bg-surface text-ink-2 hover:bg-surface-2 rounded-md h-9 px-4 text-sm font-semibold"
              >
                Fechar
              </Button>
            )}

            {/* Forward / Import */}
            {step === "upload" && (
              <Button
                onClick={handleGoToPreview}
                disabled={!file}
                className="text-white font-semibold gap-2 disabled:opacity-50"
                style={{ background: "var(--brand-grad)" }}
              >
                Próximo
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
            {step === "preview" && (
              <Button
                onClick={handleImport}
                disabled={isImporting || totalRows === 0}
                className="text-white font-semibold gap-2 disabled:opacity-50"
                style={{ background: "var(--brand-grad)" }}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Importar {totalRows} registro{totalRows !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
