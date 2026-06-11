import 'server-only';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { predecirCosecha, type PrediccionCosecha } from '@/lib/prediccion-cosecha';

export type PrediccionLote = PrediccionCosecha & { lote_id: string };

const obtenerPrediccionesUncached = async (): Promise<PrediccionLote[]> => {
  const filas = await prisma.$queryRaw<{ lote_id: bigint; anio: number; kg: string }[]>`
    SELECT lote_id, EXTRACT(YEAR FROM fecha)::int AS anio, SUM(peso_kg)::text AS kg
    FROM cosechas GROUP BY lote_id, anio ORDER BY lote_id, anio
  `;
  const porLote = new Map<string, { anio: number; kg: number }[]>();
  for (const f of filas) {
    const id = String(f.lote_id);
    const lista = porLote.get(id) ?? [];
    lista.push({ anio: f.anio, kg: Number(f.kg) });
    porLote.set(id, lista);
  }
  const resultado: PrediccionLote[] = [];
  for (const [lote_id, serie] of porLote) {
    const p = predecirCosecha(serie);
    if (p) resultado.push({ lote_id, ...p });
  }
  return resultado;
};

/** Predicciones por lote, cacheadas 6 h (cambian lento). */
export const obtenerPredicciones = unstable_cache(
  obtenerPrediccionesUncached,
  ['prediccion-cosecha'],
  { revalidate: 21600 }
);
