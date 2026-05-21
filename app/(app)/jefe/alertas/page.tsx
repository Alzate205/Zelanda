import type { Metadata } from "next";
import Link from "next/link";
import {
  Bell,
  AlertTriangle,
  Clock,
  PackageOpen,
  AlertCircle,
  Hexagon,
  ChevronRight,
} from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularResumen, formatearDias } from "@/lib/fechas-tarea";
import { BadgeBase } from "@/components/shared/BadgeRol";
import { formatearFechaCorta } from "@/lib/utils";

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

type Severidad = "critica" | "importante" | "informativa";

type Alerta = {
  id: string;
  severidad: Severidad;
  icono: "task" | "stock" | "novedad" | "despacho" | "apiario";
  titulo: string;
  detalle: string;
  fecha: Date | null;
  url: string;
};

function tonoSeveridad(s: Severidad): "alerta" | "neutro" | "info" {
  if (s === "critica") return "alerta";
  if (s === "importante") return "neutro";
  return "info";
}

function IconoAlerta({ tipo }: { tipo: Alerta["icono"] }) {
  const clase = "h-4 w-4 shrink-0";
  switch (tipo) {
    case "task":
      return <Clock className={`${clase} text-estado-vencida`} />;
    case "stock":
      return <PackageOpen className={`${clase} text-estado-vencida`} />;
    case "novedad":
      return <AlertCircle className={`${clase} text-zelanda-ocre-600`} />;
    case "despacho":
      return <PackageOpen className={`${clase} text-zelanda-ocre-600`} />;
    case "apiario":
      return <Hexagon className={`${clase} text-zelanda-ocre-600`} />;
  }
}

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

  const alertas: Alerta[] = [];

  // --- Tareas de cultivo (vencidas + próximas) ---
  for (const l of lotes) {
    for (const t of tiposCultivo) {
      const key = `${l.id}_${t.id}`;
      const ultima = mapaUltimaLote.get(key) ?? null;
      const freq = mapaFreq.get(key) ?? t.frecuencia_dias_default;
      const resumen = calcularResumen(ultima, freq);
      if (resumen.estado === "vencida" || resumen.estado === "sin_historial") {
        alertas.push({
          id: `tarea-cultivo-${l.id}-${t.id}`,
          severidad: "importante",
          icono: "task",
          titulo: `${t.nombre} · Lote ${l.nombre}`,
          detalle:
            resumen.estado === "sin_historial"
              ? "Nunca hecho"
              : `Vencida ${formatearDias(resumen.dias_para_proxima)}`,
          fecha: resumen.proxima,
          url: `/jefe/asignaciones/nueva?lote_id=${l.id}&tipo_tarea_id=${t.id}`,
        });
      } else if (resumen.estado === "proxima") {
        alertas.push({
          id: `tarea-cultivo-prox-${l.id}-${t.id}`,
          severidad: "informativa",
          icono: "task",
          titulo: `${t.nombre} · Lote ${l.nombre}`,
          detalle: formatearDias(resumen.dias_para_proxima),
          fecha: resumen.proxima,
          url: `/jefe/asignaciones/nueva?lote_id=${l.id}&tipo_tarea_id=${t.id}`,
        });
      }
    }
  }

  // --- Tareas de apicultura ---
  for (const a of apiarios) {
    for (const t of tiposApicultura) {
      const key = `${a.id}_${t.id}`;
      const ultima = mapaUltimaApiario.get(key) ?? null;
      const resumen = calcularResumen(ultima, t.frecuencia_dias_default);
      if (resumen.estado === "vencida" || resumen.estado === "sin_historial") {
        alertas.push({
          id: `tarea-api-${a.id}-${t.id}`,
          severidad: "importante",
          icono: "apiario",
          titulo: `${t.nombre} · Apiario ${a.nombre}`,
          detalle:
            resumen.estado === "sin_historial"
              ? "Nunca hecho"
              : `Vencida ${formatearDias(resumen.dias_para_proxima)}`,
          fecha: resumen.proxima,
          url: `/jefe/asignaciones/nueva?apiario_id=${a.id}&tipo_tarea_id=${t.id}`,
        });
      } else if (resumen.estado === "proxima") {
        alertas.push({
          id: `tarea-api-prox-${a.id}-${t.id}`,
          severidad: "informativa",
          icono: "apiario",
          titulo: `${t.nombre} · Apiario ${a.nombre}`,
          detalle: formatearDias(resumen.dias_para_proxima),
          fecha: resumen.proxima,
          url: `/jefe/asignaciones/nueva?apiario_id=${a.id}&tipo_tarea_id=${t.id}`,
        });
      }
    }
  }

  // --- Novedades sin resolver ---
  for (const n of novedades) {
    const esCritica = NOVEDADES_CRITICAS.has(n.tipo);
    alertas.push({
      id: `novedad-${n.id}`,
      severidad: esCritica ? "critica" : "importante",
      icono: "novedad",
      titulo: `${ETIQUETA_NOVEDAD[n.tipo] ?? n.tipo} · Árbol ${n.arboles.numero_placa}`,
      detalle: `Lote ${n.arboles.lotes.nombre} · ${n.descripcion.slice(0, 80)}${n.descripcion.length > 80 ? "…" : ""}`,
      fecha: n.fecha,
      url: `/jefe/novedades/${n.id}`,
    });
  }

  // --- Apiarios con problemas (de su última visita) ---
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
    });
  }

  // --- Stock bajo ---
  for (const s of stockBajoRows) {
    alertas.push({
      id: `stock-${s.id}`,
      severidad: "critica",
      icono: "stock",
      titulo: `Stock bajo: ${s.nombre}`,
      detalle: `${Number(s.stock_disponible).toFixed(2)} ${s.unidad} disponibles · mínimo ${Number(s.stock_minimo).toFixed(2)} ${s.unidad}`,
      fecha: null,
      url: `/bodega/inventario/insumos/${s.id}/ingresar`,
    });
  }

  // --- Despachos abiertos antiguos ---
  for (const d of despachosAbiertos) {
    alertas.push({
      id: `despacho-${d.id}`,
      severidad: "importante",
      icono: "despacho",
      titulo: `Despacho abierto · ${d.persona.nombre_completo}`,
      detalle: `Sin cerrar desde ${formatearFechaCorta(d.fecha)}`,
      fecha: d.fecha,
      url: `/bodega/despachos/${d.id}`,
    });
  }

  // Ordenar dentro de cada categoría: fecha más vieja primero (más urgente)
  const orden = (a: Alerta, b: Alerta) => {
    if (a.fecha && b.fecha) return a.fecha.getTime() - b.fecha.getTime();
    if (a.fecha) return -1;
    if (b.fecha) return 1;
    return 0;
  };

  const criticas = alertas.filter((a) => a.severidad === "critica").sort(orden);
  const importantes = alertas.filter((a) => a.severidad === "importante").sort(orden);
  const informativas = alertas
    .filter((a) => a.severidad === "informativa")
    .sort((a, b) => {
      if (a.fecha && b.fecha) return a.fecha.getTime() - b.fecha.getTime();
      return 0;
    });

  const total = criticas.length + importantes.length + informativas.length;

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
        <p className="mt-1 text-sm text-zelanda-verde-700">
          {total === 0
            ? "Todo en orden. No hay alertas activas."
            : `${total} alerta${total === 1 ? "" : "s"} activa${total === 1 ? "" : "s"}.`}
        </p>
      </header>

      {total === 0 ? (
        <section className="rounded-xl border border-dashed border-zelanda-verde-300 bg-zelanda-verde-50/40 px-6 py-12 text-center">
          <p className="font-serif text-lg text-zelanda-verde-900">Sin alertas</p>
          <p className="mt-1 text-sm text-zelanda-verde-700">
            Cuando aparezcan tareas vencidas, novedades, stock bajo u otros eventos
            importantes, los vas a ver acá.
          </p>
        </section>
      ) : null}

      <BloqueAlertas
        titulo="Críticas"
        descripcion="Requieren atención inmediata"
        icono={<AlertTriangle className="h-5 w-5 text-estado-vencida" />}
        items={criticas}
      />

      <BloqueAlertas
        titulo="Importantes"
        descripcion="Tareas vencidas, novedades y despachos sin cerrar"
        icono={<AlertCircle className="h-5 w-5 text-zelanda-ocre-600" />}
        items={importantes}
      />

      <BloqueAlertas
        titulo="Próximas"
        descripcion="Vencen en menos de 7 días"
        icono={<Clock className="h-5 w-5 text-zelanda-verde-700" />}
        items={informativas}
      />
    </div>
  );
}

function BloqueAlertas({
  titulo,
  descripcion,
  icono,
  items,
}: {
  titulo: string;
  descripcion: string;
  icono: React.ReactNode;
  items: Alerta[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        {icono}
        <h2 className="font-serif text-lg text-zelanda-verde-900">
          {titulo}
          <span className="ml-2 text-sm font-normal text-zelanda-verde-700">
            ({items.length})
          </span>
        </h2>
      </div>
      <p className="text-xs text-zelanda-verde-700">{descripcion}</p>
      <ul className="space-y-2">
        {items.map((a) => (
          <li key={a.id}>
            <Link
              href={a.url}
              className="flex items-center gap-3 rounded-xl border border-zelanda-beige-200 bg-white p-3 shadow-suave transition hover:bg-zelanda-beige-50"
            >
              <IconoAlerta tipo={a.icono} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zelanda-verde-900">
                  {a.titulo}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-zelanda-verde-700">
                  {a.detalle}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <BadgeBase tono={tonoSeveridad(a.severidad)}>
                  {a.severidad === "critica"
                    ? "Crítica"
                    : a.severidad === "importante"
                      ? "Importante"
                      : "Próxima"}
                </BadgeBase>
                <ChevronRight className="h-4 w-4 text-zelanda-verde-700/40" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
