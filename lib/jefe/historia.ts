import 'server-only';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';

export type HistoriaMes = {
  mes: string; // 'YYYY-MM'
  cosecha_por_lote: { lote_id: string; kg: number }[];
  total_kg: number;
  tareas_completadas: number;
  novedades: number;
};

export type RangoHistoria = { desde: string; hasta: string };

function claveMes(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const obtenerHistoriaMesUncached = async (mes: string): Promise<HistoriaMes> => {
  const [anio, mesNum] = mes.split('-').map(Number);
  const inicio = new Date(anio, mesNum - 1, 1);
  const fin = new Date(anio, mesNum, 1);

  const [cosechaRaw, totalRaw, tareas, novedades] = await Promise.all([
    prisma.cosechas.groupBy({
      by: ['lote_id'],
      where: { fecha: { gte: inicio, lt: fin } },
      _sum: { peso_kg: true },
    }),
    prisma.cosechas.aggregate({
      where: { fecha: { gte: inicio, lt: fin } },
      _sum: { peso_kg: true },
    }),
    prisma.asignaciones.count({
      where: { estado: 'COMPLETADA', fecha_completada: { gte: inicio, lt: fin } },
    }),
    prisma.novedades.count({
      where: { fecha: { gte: inicio, lt: fin } },
    }),
  ]);

  return {
    mes,
    cosecha_por_lote: cosechaRaw.map((c) => ({
      lote_id: String(c.lote_id),
      kg: Number(c._sum.peso_kg ?? 0),
    })),
    total_kg: Number(totalRaw._sum.peso_kg ?? 0),
    tareas_completadas: tareas,
    novedades,
  };
};

// Meses cerrados no cambian: cache de 24 h. El mes en curso, 5 min.
const historiaMesPasado = unstable_cache(obtenerHistoriaMesUncached, ['historia-mes'], {
  revalidate: 86400,
});
const historiaMesActual = unstable_cache(obtenerHistoriaMesUncached, ['historia-mes-actual'], {
  revalidate: 300,
});

export async function obtenerHistoriaMes(mes: string): Promise<HistoriaMes> {
  const esActual = mes === claveMes(new Date());
  return esActual ? historiaMesActual(mes) : historiaMesPasado(mes);
}

const obtenerRangoUncached = async (): Promise<RangoHistoria> => {
  const [primeraCosecha, primeraNovedad] = await Promise.all([
    prisma.cosechas.aggregate({ _min: { fecha: true } }),
    prisma.novedades.aggregate({ _min: { fecha: true } }),
  ]);
  const fechas = [primeraCosecha._min.fecha, primeraNovedad._min.fecha].filter(
    (f): f is Date => f !== null
  );
  const hoy = new Date();
  const desde = fechas.length > 0 ? new Date(Math.min(...fechas.map((f) => f.getTime()))) : hoy;
  return { desde: claveMes(desde), hasta: claveMes(hoy) };
};

export const obtenerRangoHistoria = unstable_cache(obtenerRangoUncached, ['historia-rango'], {
  revalidate: 3600,
});
