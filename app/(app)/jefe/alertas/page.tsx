import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularResumen, formatearDias } from "@/lib/fechas-tarea";
import { formatearFechaCorta } from "@/lib/utils";
import {
  AlertasFiltrables,
  type Alerta,
  type Severidad,
  type IconoAlertaTipo,
} from "./_alertas-cliente";

export const metadata: Metadata = { title: "Alertas" };
export const dynamic = "force-dynamic";

const ETIQUETA_NOVEDAD: Record<string, string> = {
  PLAGA: "Plaga",
  DANO_FISICO: "Daño físico",
  ENFERMEDAD: "Enfermedad",
  OBSERVACION: "Observación",
  OTRO: "Otro",
};

const NOVEDADES_CRITICAS = new Set(["PLAGA", "DANO_FISICO", "ENFERMEDAD"]);

type AlertaConFecha = Alerta & { fecha: Date | null };

export default async function PaginaAlertas() {
  await requerirUsuario("JEFE");

  const ahora = new Date();
  const hace24h = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);

  const [
    lotes,
    apiarios,
    tiposCultivo,
    tiposApicultura,
    completadasLote,
    completadasApiario,
    frecuenciasOverride,
    novedades,
    stockBajoRows,
    despachosAbiertos,
    visitasApiarioCriticas,
  ] = await Promise.all([
    prisma.lotes.findMany({
      where: { deleted_at: null },
      select: { id: true, nombre: true },
    }),
    prisma.apiarios.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
    }),
    prisma.tipos_tarea.findMany({
      where: { area: "CULTIVO", activo: true },
      select: { id: true, nombre: true, frecuencia_dias_default: true },
    }),
    prisma.tipos_tarea.findMany({
      where: { area: "APICULTURA", activo: true },
      select: { id: true, nombre: true, frecuencia_dias_default: true },
    }),
    prisma.asignaciones.groupBy({
      by: ["lote_id", "tipo_tarea_id"],
      where: { estado: "COMPLETADA", lote_id: { not: null } },
      _max: { fecha_completada: true },
    }),
    prisma.asignaciones.groupBy({
      by: ["apiario_id", "tipo_tarea_id"],
      where: { estado: "COMPLETADA", apiario_id: { not: null } },
      _max: { fecha_completada: true },
    }),
    prisma.frecuencias_lote.findMany({
      select: { lote_id: true, tipo_tarea_id: true, frecuencia_dias: true },
    }),
    prisma.novedades.findMany({
      where: { resuelta: false },
      orderBy: { fecha: "desc" },
      take: 30,
      include: {
        arboles: {
          select: { numero_placa: true, lote_id: true, lotes: { select: { nombre: true } } },
        },
      },
    }),
    prisma.$queryRaw<{ id: bigint; nombre: string; unidad: string; stock_disponible: string; stock_minimo: string }[]>`
      SELECT id, nombre, unidad, stock_disponible::text, stock_minimo::text
      FROM v_insumos_stock
      WHERE activo = TRUE AND por_debajo_minimo = TRUE
      ORDER BY stock_disponible::numeric ASC
      LIMIT 20
    `,
    prisma.despachos.findMany({
      where: { estado: "ABIERTO", fecha: { lt: hace24h } },
      orderBy: { fecha: "asc" },
      take: 20,
      include: { persona: { select: { nombre_completo: true } } },
    }),
    prisma.$queryRaw<
      Array<{
        apiario_id: bigint;
        apiario_nombre: string;
        fecha_registro: Date;
        estado_apiario: string;
        observaciones: string | null;
      }>
    >`
      WITH ultimas AS (
        SELECT DISTINCT ON (a.apiario_id)
          a.apiario_id,
          ap.nombre AS apiario_nombre,
          r.fecha_registro,
          r.estado_apiario::text AS estado_apiario,
          r.observaciones
        FROM registros_avance r
        JOIN asignaciones a ON a.id = r.asignacion_id
        JOIN apiarios ap ON ap.id = a.apiario_id
        WHERE r.estado_apiario IS NOT NULL
          AND a.apiario_id IS NOT NULL
        ORDER BY a.apiario_id, r.fecha_registro DESC
      )
      SELECT * FROM ultimas
      WHERE estado_apiario IN ('CRITICO', 'CON_PROBLEMAS')
    `,
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
  const mapaUltimaApiario = new Map<string, Date | null>();
  for (const c of completadasApiario) {
    if (c.apiario_id) {
      mapaUltimaApiario.set(`${c.apiario_id}_${c.tipo_tarea_id}`, c._max.fecha_completada);
    }
  }

  const alertas: AlertaConFecha[] = [];

  for (const l of lotes) {
    for (const t of tiposCultivo) {
      const key = `${l.id}_${t.id}`;
      const ultima = mapaUltimaLote.get(key) ?? null;
      const freq = mapaFreq.get(key) ?? t.frecuencia_dias_default;
      const resumen = calcularResumen(ultima, freq);
      const base: Pick<
        AlertaConFecha,
        "icono" | "titulo" | "url" | "clave_grupo"
      > = {
        icono: "task",
        titulo: `${t.nombre} · Lote ${l.nombre}`,
        url: `/jefe/asignaciones/nueva?lote_id=${l.id}&tipo_tarea_id=${t.id}`,
        clave_grupo: t.nombre,
      };
      if (resumen.estado === "vencida" || resumen.estado === "sin_historial") {
        alertas.push({
          ...base,
          id: `tarea-cultivo-${l.id}-${t.id}`,
          severidad: "importante",
          detalle:
            resumen.estado === "sin_historial"
              ? `Lote ${l.nombre} · Nunca hecho`
              : `Lote ${l.nombre} · Vencida ${formatearDias(resumen.dias_para_proxima)}`,
          fecha: resumen.proxima,
        });
      } else if (resumen.estado === "proxima") {
        alertas.push({
          ...base,
          id: `tarea-cultivo-prox-${l.id}-${t.id}`,
          severidad: "informativa",
          detalle: `Lote ${l.nombre} · ${formatearDias(resumen.dias_para_proxima)}`,
          fecha: resumen.proxima,
        });
      }
    }
  }

  for (const a of apiarios) {
    for (const t of tiposApicultura) {
      const key = `${a.id}_${t.id}`;
      const ultima = mapaUltimaApiario.get(key) ?? null;
      const resumen = calcularResumen(ultima, t.frecuencia_dias_default);
      const base: Pick<
        AlertaConFecha,
        "icono" | "titulo" | "url" | "clave_grupo"
      > = {
        icono: "apiario",
        titulo: `${t.nombre} · Apiario ${a.nombre}`,
        url: `/jefe/asignaciones/nueva?apiario_id=${a.id}&tipo_tarea_id=${t.id}`,
        clave_grupo: t.nombre,
      };
      if (resumen.estado === "vencida" || resumen.estado === "sin_historial") {
        alertas.push({
          ...base,
          id: `tarea-api-${a.id}-${t.id}`,
          severidad: "importante",
          detalle:
            resumen.estado === "sin_historial"
              ? `Apiario ${a.nombre} · Nunca hecho`
              : `Apiario ${a.nombre} · Vencida ${formatearDias(resumen.dias_para_proxima)}`,
          fecha: resumen.proxima,
        });
      } else if (resumen.estado === "proxima") {
        alertas.push({
          ...base,
          id: `tarea-api-prox-${a.id}-${t.id}`,
          severidad: "informativa",
          detalle: `Apiario ${a.nombre} · ${formatearDias(resumen.dias_para_proxima)}`,
          fecha: resumen.proxima,
        });
      }
    }
  }

  for (const n of novedades) {
    const esCritica = NOVEDADES_CRITICAS.has(n.tipo);
    const etiqueta = ETIQUETA_NOVEDAD[n.tipo] ?? n.tipo;
    alertas.push({
      id: `novedad-${n.id}`,
      severidad: esCritica ? "critica" : "importante",
      icono: "novedad",
      titulo: `${etiqueta} · Árbol ${n.arboles.numero_placa}`,
      detalle: `Lote ${n.arboles.lotes.nombre} · ${n.descripcion.slice(0, 80)}${n.descripcion.length > 80 ? "…" : ""}`,
      fecha: n.fecha,
      url: `/jefe/novedades/${n.id}`,
      clave_grupo: etiqueta,
    });
  }

  for (const v of visitasApiarioCriticas) {
    const esCritico = v.estado_apiario === "CRITICO";
    alertas.push({
      id: `apiario-estado-${v.apiario_id}`,
      severidad: esCritico ? "critica" : "importante",
      icono: "apiario",
      titulo: `Apiario ${v.apiario_nombre}`,
      detalle:
        (esCritico ? "Estado crítico" : "Con problemas") +
        (v.observaciones ? ` · ${v.observaciones.slice(0, 80)}${v.observaciones.length > 80 ? "…" : ""}` : ""),
      fecha: v.fecha_registro,
      url: `/jefe/apiarios/${v.apiario_id}`,
      clave_grupo: null,
    });
  }

  for (const s of stockBajoRows) {
    alertas.push({
      id: `stock-${s.id}`,
      severidad: "critica",
      icono: "stock",
      titulo: `Stock bajo: ${s.nombre}`,
      detalle: `${Number(s.stock_disponible).toFixed(2)} ${s.unidad} disponibles · mínimo ${Number(s.stock_minimo).toFixed(2)} ${s.unidad}`,
      fecha: null,
      url: `/bodega/inventario/insumos/${s.id}/ingresar`,
      clave_grupo: null,
    });
  }

  for (const d of despachosAbiertos) {
    alertas.push({
      id: `despacho-${d.id}`,
      severidad: "importante",
      icono: "despacho",
      titulo: `Despacho abierto · ${d.persona.nombre_completo}`,
      detalle: `Sin cerrar desde ${formatearFechaCorta(d.fecha)}`,
      fecha: d.fecha,
      url: `/bodega/despachos/${d.id}`,
      clave_grupo: null,
    });
  }

  const orden = (a: AlertaConFecha, b: AlertaConFecha) => {
    if (a.fecha && b.fecha) return a.fecha.getTime() - b.fecha.getTime();
    if (a.fecha) return -1;
    if (b.fecha) return 1;
    return 0;
  };

  const limpiar = (a: AlertaConFecha): Alerta => ({
    id: a.id,
    severidad: a.severidad,
    icono: a.icono,
    titulo: a.titulo,
    detalle: a.detalle,
    url: a.url,
    clave_grupo: a.clave_grupo,
  });

  const criticas = alertas
    .filter((a) => a.severidad === "critica")
    .sort(orden)
    .map(limpiar);
  const importantes = alertas
    .filter((a) => a.severidad === "importante")
    .sort(orden)
    .map(limpiar);
  const informativas = alertas
    .filter((a) => a.severidad === "informativa")
    .sort(orden)
    .map(limpiar);

  return (
    <div className="space-y-6 pb-12">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Vista general
        </p>
        <h1 className="mt-1 flex items-center gap-2 font-serif text-2xl text-zelanda-verde-900">
          <Bell className="h-6 w-6 text-zelanda-ocre-600" />
          Alertas
        </h1>
      </header>

      <AlertasFiltrables
        criticas={criticas}
        importantes={importantes}
        informativas={informativas}
      />
    </div>
  );
}

export type { Alerta, Severidad, IconoAlertaTipo };
