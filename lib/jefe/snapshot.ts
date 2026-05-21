import "server-only";

import { prisma } from "@/lib/prisma";
import { calcularResumen } from "@/lib/fechas-tarea";
import type { SnapshotJefe, AlertaTareaJefe } from "@/lib/offline/tipos";

/**
 * Construye el snapshot del dashboard del jefe: vencidas, próximas,
 * novedades pendientes y contadores generales.
 *
 * Es compartido entre el Server Component `/jefe` y la API `/api/jefe/snapshot`
 * para evitar duplicar la lógica de Prisma.
 */
export async function construirSnapshotJefe(): Promise<SnapshotJefe> {
  const completadasLote = await prisma.asignaciones.groupBy({
    by: ["lote_id", "tipo_tarea_id"],
    where: { estado: "COMPLETADA", lote_id: { not: null } },
    _max: { fecha_completada: true },
  });

  const [lotes, tiposCultivo, frecuenciasOverride] = await Promise.all([
    prisma.lotes.findMany({
      where: { deleted_at: null },
      select: { id: true, nombre: true },
    }),
    prisma.tipos_tarea.findMany({
      where: { area: "CULTIVO", activo: true },
      select: { id: true, nombre: true, frecuencia_dias_default: true },
    }),
    prisma.frecuencias_lote.findMany({
      select: { lote_id: true, tipo_tarea_id: true, frecuencia_dias: true },
    }),
  ]);

  const mapaFreq = new Map<string, number>();
  for (const f of frecuenciasOverride) {
    mapaFreq.set(`${f.lote_id}_${f.tipo_tarea_id}`, f.frecuencia_dias);
  }

  const mapaUltimaLote = new Map<string, Date | null>();
  for (const c of completadasLote) {
    if (c.lote_id) {
      mapaUltimaLote.set(`${c.lote_id}_${c.tipo_tarea_id}`, c._max.fecha_completada);
    }
  }

  type FilaInterna = AlertaTareaJefe & { ord: number };
  const filas: FilaInterna[] = [];

  for (const l of lotes) {
    for (const t of tiposCultivo) {
      const key = `${l.id}_${t.id}`;
      const ultima = mapaUltimaLote.get(key) ?? null;
      const freq = mapaFreq.get(key) ?? t.frecuencia_dias_default;
      const resumen = calcularResumen(ultima, freq);

      if (
        resumen.estado === "vencida" ||
        resumen.estado === "sin_historial" ||
        resumen.estado === "proxima"
      ) {
        filas.push({
          lote_nombre: l.nombre,
          lote_id: String(l.id),
          tipo_nombre: t.nombre,
          tipo_id: String(t.id),
          dias_para_proxima: resumen.dias_para_proxima,
          estado: resumen.estado,
          ord: resumen.dias_para_proxima ?? -Infinity,
        });
      }
    }
  }

  const vencidas: AlertaTareaJefe[] = filas
    .filter((f) => f.estado === "vencida" || f.estado === "sin_historial")
    .sort((a, b) => a.ord - b.ord)
    .slice(0, 10)
    .map(({ ord: _ord, ...rest }) => rest);

  const proximas: AlertaTareaJefe[] = filas
    .filter((f) => f.estado === "proxima")
    .sort((a, b) => (a.dias_para_proxima ?? 0) - (b.dias_para_proxima ?? 0))
    .slice(0, 10)
    .map(({ ord: _ord, ...rest }) => rest);

  const [
    novedadesPendientesRaw,
    stockBajoRows,
    despachosAbiertos,
    stockAlmacenRows,
  ] = await Promise.all([
    prisma.novedades.findMany({
      where: { resuelta: false },
      orderBy: { fecha: "desc" },
      take: 5,
      include: {
        arboles: {
          select: { numero_placa: true, lotes: { select: { nombre: true } } },
        },
      },
    }),
    prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM v_insumos_stock
      WHERE activo = TRUE AND por_debajo_minimo = TRUE
    `,
    prisma.despachos.count({ where: { estado: "ABIERTO" } }),
    prisma.$queryRaw<{ stock_kg: string }[]>`
      SELECT stock_kg::text FROM v_stock_almacen
    `,
  ]);

  const novedades_pendientes = novedadesPendientesRaw.map((n) => ({
    id: String(n.id),
    tipo: String(n.tipo),
    arbol_numero: n.arboles.numero_placa,
    lote_nombre: n.arboles.lotes.nombre,
    fecha: n.fecha.toISOString(),
  }));

  return {
    vencidas,
    proximas,
    novedades_pendientes,
    contadores: {
      stock_bajo: stockBajoRows[0]?.count ?? 0,
      despachos_abiertos: despachosAbiertos,
      stock_almacen_kg: Number(stockAlmacenRows[0]?.stock_kg ?? 0),
    },
    ts: new Date().toISOString(),
  };
}
