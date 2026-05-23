"use client";

import { Download } from "lucide-react";

type Celda = string | number | null | undefined;
type Fila = Celda[];

function escaparCsv(v: Celda): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[,"\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function DescargarCSVButton({
  filename,
  headers,
  rows,
  label = "CSV",
}: {
  filename: string;
  headers: string[];
  rows: Fila[];
  label?: string;
}) {
  const vacio = rows.length === 0;

  function handleClick() {
    const allRows = [headers, ...rows];
    const csv = allRows.map((r) => r.map(escaparCsv).join(",")).join("\r\n");
    // BOM para que Excel detecte UTF-8 y muestre acentos correctamente.
    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={vacio}
      title={vacio ? "Sin datos para exportar" : `Descargar ${filename}`}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zelanda-beige-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zelanda-verde-700 transition hover:border-zelanda-verde-400 hover:bg-zelanda-beige-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
