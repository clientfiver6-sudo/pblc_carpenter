"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

interface ExportButtonProps {
  endpoint?: string;
  filename?: string;
  label?: string;
}

export function ExportButton({
  endpoint = "/api/export/customers",
  filename,
  label = "Exportar CSV",
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch(endpoint, { method: "GET" });

      if (!res.ok) {
        console.error("Export failed:", res.status, await res.text());
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      // Derive filename from Content-Disposition or use prop
      let downloadName = filename;
      if (!downloadName) {
        const cd = res.headers.get("Content-Disposition");
        const match = cd?.match(/filename="?([^"]+)"?/);
        downloadName = match?.[1] ?? "export.csv";
      }

      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("ExportButton error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      disabled={loading}
      className="gap-2 border-border bg-surface text-ink-2 hover:bg-surface-2 rounded-md h-9 px-4 text-sm font-semibold"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-ink-3" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      {label}
    </Button>
  );
}
