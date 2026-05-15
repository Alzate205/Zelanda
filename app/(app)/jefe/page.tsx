import Link from "next/link";
import { AlertTriangle, Clock, AlertCircle, ChevronRight } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BadgeBase } from "@/components/shared/BadgeRol";
import { calcularResumen, formatearDias } from "@/lib/fechas-tarea";
import { formatearFechaCorta } from "@/lib/utils";

export const metadata = { title: "Panel del jefe" };

const ETIQUETA_NOVEDAD: Record<string, string> = {
  PLAGA: "Plaga",
  DANO_FISICO: "Daño físico",
  ENFERMEDAD: "Enfermedad",
  OBSERVACION: "Observación",
  OTRO: "Otro",
};

export default async function PaginaInicioJefe() {
  const usuario = await requerirUsuario("JEFE");

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

  type FilaAlerta = {
    loteNombre: string;
    loteId: string;
    tipoNombre: string;
    tipoId: string;
    dias_para_proxima: number | null;
    estado: "aldia" | "proxima" | "vencida" | "sin_historial";
  };

  const filas: FilaAlerta[] = [];
  for (const l of lotes) {
    for (const t of tiposCultivo) {
      const key = `${l.id}_${t.id}`;
      const ultima = mapaUltimaLote.get(key) ?? null;
      const freq = mapaFreq.get(key) ?? t.frecuencia_dias_default;
      const resumen = calcularResumen(ultima, freq);
      filas.push({
        loteNombre: l.nombre,
        loteId: String(l.id),
        tipoNombre: t.nombre,
        tipoId: String(t.id),
        dias_para_proxima: resumen.dias_para_proxima,
        estado: resumen.estado,
      });
    }
  }

  const vencidas = filas
    .filter((f) => f.estado === "vencida" || f.estado === "sin_historial")
    .sort((a, b) => (a.dias_para_proxima ?? -Infinity) - (b.dias_para_proxima ?? -Infinity))
    .slice(0, 10);

  const proximas = filas
    .filter((f) => f.estado === "proxima")
    .sort((a, b) => (a.dias_para_proxima ?? 0) - (b.dias_para_proxima ?? 0))
    .slice(0, 10);

  const novedadesPendientes = await prisma.novedades.findMany({
    where: { resuelta: false },
    orderBy: { fecha: "desc" },
    take: 5,
    include: {
      arboles: {
        select: { numero_placa: true, lotes: { select: { nombre: true } } },
      },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Panel del jefe
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Hola, {usuario.nombre_completo.split(" ")[0]}
        </h1>
      </header>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-serif text-base text-zelanda-verde-900">
          <AlertTriangle className="h-4 w-4 text-estado-vencida" />
          Vencidas <span className="text-sm font-normal text-zelanda-verde-700">({vencidas.length})</span>
        </h2>
        {vencidas.length === 0 ? (
          <p className="mt-2 text-sm text-zelanda-verde-700">Todo al día por ahora.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {vencidas.map((f) => (
              <li key={`${f.loteId}_${f.tipoId}`}>
                <Link
                  href={`/jefe/asignaciones/nueva?lote_id=${f.loteId}&tipo_tarea_id=${f.tipoId}`}
                  className="flex items-center gap-2 rounded-lg border border-zelanda-beige-200 px-3 py-2 text-sm transition hover:bg-zelanda-beige-50"
                >
                  <span className="flex-1">
                    <span className="font-medium text-zelanda-verde-900">{f.tipoNombre}</span>
                    <span className="text-zelanda-verde-700"> · Lote {f.loteNombre}</span>
                  </span>
                  <span className="text-xs text-estado-vencida">
                    {f.estado === "sin_historial" ? "nunca hecho" : `vencida ${formatearDias(f.dias_para_proxima)}`}
                  </span>
                  <ChevronRight className="h-4 w-4 text-zelanda-verde-700/40" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-serif text-base text-zelanda-verde-900">
          <Clock className="h-4 w-4 text-estado-proxima" />
          Próximas (7 días) <span className="text-sm font-normal text-zelanda-verde-700">({proximas.length})</span>
        </h2>
        {proximas.length === 0 ? (
          <p className="mt-2 text-sm text-zelanda-verde-700">Sin tareas próximas.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {proximas.map((f) => (
              <li key={`${f.loteId}_${f.tipoId}`}>
                <Link
                  href={`/jefe/asignaciones/nueva?lote_id=${f.loteId}&tipo_tarea_id=${f.tipoId}`}
                  className="flex items-center gap-2 rounded-lg border border-zelanda-beige-200 px-3 py-2 text-sm transition hover:bg-zelanda-beige-50"
                >
                  <span className="flex-1">
                    <span className="font-medium text-zelanda-verde-900">{f.tipoNombre}</span>
                    <span className="text-zelanda-verde-700"> · Lote {f.loteNombre}</span>
                  </span>
                  <span className="text-xs text-estado-proxima">{formatearDias(f.dias_para_proxima)}</span>
                  <ChevronRight className="h-4 w-4 text-zelanda-verde-700/40" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-serif text-base text-zelanda-verde-900">
            <AlertCircle className="h-4 w-4 text-zelanda-ocre-600" />
            Novedades sin resolver
          </h2>
          <Link href="/jefe/novedades" className="text-xs text-zelanda-verde-700 hover:text-zelanda-verde-900">
            Ver todas
          </Link>
        </div>
        {novedadesPendientes.length === 0 ? (
          <p className="mt-2 text-sm text-zelanda-verde-700">Sin novedades pendientes.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {novedadesPendientes.map((n) => (
              <li key={String(n.id)}>
                <Link
                  href={`/jefe/novedades/${n.id}`}
                  className="flex items-center gap-2 rounded-lg border border-zelanda-beige-200 px-3 py-2 text-sm transition hover:bg-zelanda-beige-50"
                >
                  <BadgeBase tono="alerta">{ETIQUETA_NOVEDAD[n.tipo]}</BadgeBase>
                  <span className="flex-1 truncate text-zelanda-verde-900">
                    Árbol {n.arboles.numero_placa} · Lote {n.arboles.lotes.nombre}
                  </span>
                  <span className="text-xs text-zelanda-verde-700">{formatearFechaCorta(n.fecha)}</span>
                  <ChevronRight className="h-4 w-4 text-zelanda-verde-700/40" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
