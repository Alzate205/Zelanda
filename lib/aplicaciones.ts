// Cálculos puros del registro de aplicaciones de insumos por lote.

/** Costo de una aplicación: costo congelado al cierre del despacho; si no
 *  existe (cierres anteriores a la migración), el costo actual del catálogo. */
export function costoAplicacion(
  cantidad: number,
  costoSnapshot: number | null,
  costoActual: number | null
): number {
  return cantidad * (costoSnapshot ?? costoActual ?? 0);
}

export type FilaCostoLote = {
  lote_id: string | null;
  lote_nombre: string | null;
  costo: number;
};

/** Agrega el costo de insumos por lote, de mayor a menor. Sin lote no entra. */
export function agruparCostoPorLote(
  filas: FilaCostoLote[]
): { lote_id: string; nombre: string; costo: number }[] {
  const m = new Map<string, { lote_id: string; nombre: string; costo: number }>();
  for (const f of filas) {
    if (f.lote_id === null) continue;
    const prev = m.get(f.lote_id) ?? {
      lote_id: f.lote_id,
      nombre: f.lote_nombre ?? `Lote ${f.lote_id}`,
      costo: 0,
    };
    prev.costo += f.costo;
    m.set(f.lote_id, prev);
  }
  return [...m.values()].sort((a, b) => b.costo - a.costo);
}
