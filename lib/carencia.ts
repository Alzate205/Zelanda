// Cálculo puro del periodo de carencia (días sin cosechar tras una
// aplicación química). Todas las fechas se comparan por día de Bogotá.

export type AplicacionConCarencia = {
  lote_id: string;
  insumo: string;
  fecha_aplicacion: Date;
  carencia_dias: number;
};

export type CarenciaLote = {
  lote_id: string;
  insumo: string;
  /** Último día de la carencia (inclusive), YYYY-MM-DD. */
  hasta: string;
};

function diaBogota(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d);
}

function sumarDias(dia: string, dias: number): string {
  const [a, m, dd] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, dd + dias)).toISOString().slice(0, 10);
}

/** Por lote, la carencia activa que más lejos llega. `hoy` en YYYY-MM-DD (Bogotá). */
export function carenciasPorLote(
  aplicaciones: AplicacionConCarencia[],
  hoy: string
): CarenciaLote[] {
  const porLote = new Map<string, CarenciaLote>();
  for (const a of aplicaciones) {
    if (a.carencia_dias <= 0) continue;
    const hasta = sumarDias(diaBogota(a.fecha_aplicacion), a.carencia_dias);
    if (hasta < hoy) continue;
    const previa = porLote.get(a.lote_id);
    if (!previa || hasta > previa.hasta) {
      porLote.set(a.lote_id, { lote_id: a.lote_id, insumo: a.insumo, hasta });
    }
  }
  return [...porLote.values()];
}

/** '2026-06-24' → '24/06' para mostrar en banners y push. */
export function fmtCarenciaHasta(hasta: string): string {
  const [, m, d] = hasta.split('-');
  return `${d}/${m}`;
}
