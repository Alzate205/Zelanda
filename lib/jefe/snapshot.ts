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

  const mapaFreq = new globalThis.Map<string, number>();
  for (const f of frecuenciasOverride) {
    mapaFreq.set(`${f.lote_id}_${f.tipo_tarea_id}`, f.frecuencia_dias);
  }

  const mapaUltimaLote = new globalThis.Map<string, Date | null>();
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
    .map((f) => ({
      lote_nombre: f.lote_nombre,
      lote_id: f.lote_id,
      tipo_nombre: f.tipo_nombre,
      tipo_id: f.tipo_id,
      dias_para_proxima: f.dias_para_proxima,
      estado: f.estado,
    }));

  const proximas: AlertaTareaJefe[] = filas
    .filter((f) => f.estado === "proxima")
    .sort((a, b) => (a.dias_para_proxima ?? 0) - (b.dias_para_proxima ?? 0))
    .slice(0, 10)
    .map((f) => ({
      lote_nombre: f.lote_nombre,
      lote_id: f.lote_id,
      tipo_nombre: f.tipo_nombre,
      tipo_id: f.tipo_id,
      dias_para_proxima: f.dias_para_proxima,
      estado: f.estado,
    }));

  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const inicioMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
  const inicioDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

  const [
    novedadesPendientesRaw,
    stockBajoRows,
    despachosAbiertos,
    stockAlmacenRows,
    personasRaw,
    lotesTotales,
    tareasActivas,
    tareasCerradasHoy,
    cosechaMes,
    cosechaMesAnterior,
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
    prisma.personas.findMany({
      where: { activo: true },
      orderBy: { nombre_completo: "asc" },
      select: { id: true, nombre_completo: true },
    }),
    prisma.lotes.findMany({
      where: { deleted_at: null },
      select: { id: true, total_arboles: true },
    }),
    prisma.asignaciones.count({
      where: { estado: { in: ["PENDIENTE", "EN_CURSO"] } },
    }),
    prisma.asignaciones.count({
      where: { estado: "COMPLETADA", fecha_completada: { gte: inicioDia } },
    }),
    prisma.cosechas.aggregate({
      where: { fecha: { gte: inicioMes } },
      _sum: { peso_kg: true },
    }),
    prisma.cosechas.aggregate({
      where: { fecha: { gte: inicioMesAnterior, lt: inicioMes } },
      _sum: { peso_kg: true },
    }),
  ]);

  const totalLotes = lotesTotales.length;
  const totalArboles = lotesTotales.reduce((a, l) => a + l.total_arboles, 0);

  const lotesPorEstado = new globalThis.Map<string, "aldia" | "proxima" | "vencida">();
  for (const l of lotes) {
    lotesPorEstado.set(String(l.id), "aldia");
  }
  for (const f of filas) {
    const actual = lotesPorEstado.get(f.lote_id) ?? "aldia";
    if (f.estado === "vencida" || f.estado === "sin_historial") {
      lotesPorEstado.set(f.lote_id, "vencida");
    } else if (f.estado === "proxima" && actual !== "vencida") {
      lotesPorEstado.set(f.lote_id, "proxima");
    }
  }
  let lotesAldia = 0;
  let lotesProxima = 0;
  let lotesVencida = 0;
  for (const v of lotesPorEstado.values()) {
    if (v === "vencida") lotesVencida++;
    else if (v === "proxima") lotesProxima++;
    else lotesAldia++;
  }

  const novedades_pendientes = novedadesPendientesRaw.map((n) => ({
    id: String(n.id),
    tipo: String(n.tipo),
    arbol_numero: n.arboles.numero_placa,
    lote_nombre: n.arboles.lotes.nombre,
    fecha: n.fecha.toISOString(),
  }));

  const personas = personasRaw.map((p) => ({
    id: String(p.id),
    nombre: p.nombre_completo,
  }));

  return {
    vencidas,
    proximas,
    novedades_pendientes,
    contadores: {
      stock_bajo: stockBajoRows[0]?.count ?? 0,
      despachos_abiertos: despachosAbiertos,
      stock_almacen_kg: Number(stockAlmacenRows[0]?.stock_kg ?? 0),
      total_lotes: totalLotes,
      total_arboles: totalArboles,
      lotes_aldia: lotesAldia,
      lotes_proxima: lotesProxima,
      lotes_vencida: lotesVencida,
      tareas_activas: tareasActivas,
      tareas_cerradas_hoy: tareasCerradasHoy,
      cosecha_mes_kg: Number(cosechaMes._sum.peso_kg ?? 0),
      cosecha_mes_anterior_kg: Number(cosechaMesAnterior._sum.peso_kg ?? 0),
    },
    personas,
    ts: new Date().toISOString(),
  };
}
