import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatearFechaCorta } from "@/lib/utils";
import { calcularResumen, formatearDias, etiquetaEstado, tonoEstado } from "@/lib/fechas-tarea";
import { BadgeBase } from "@/components/shared/BadgeRol";

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const loteId = parsearId(id);
  if (!loteId) return { title: "Lote no encontrado" };

  const lote = await prisma.lotes.findUnique({
    where: { id: loteId },
    select: { nombre: true },
  });
  return { title: lote?.nombre ? `Lote ${lote.nombre}` : "Lote no encontrado" };
}

export default async function DetalleLote({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id } = await params;

  const loteId = parsearId(id);
  if (!loteId) notFound();

  const lote = await prisma.lotes.findUnique({
    where: { id: loteId },
    select: {
      id: true,
      nombre: true,
      total_arboles: true,
      hectareas: true,
      fecha_siembra: true,
      notas: true,
      deleted_at: true,
    },
  });

  if (!lote || lote.deleted_at) notFound();

  const idBig = loteId;
  const arbolesGenerados = await prisma.arboles.count({
    where: { lote_id: idBig, deleted_at: null },
  });

  const [tiposCultivo, asignacionesCompletadas, frecuenciasOverride] = await Promise.all([
    prisma.tipos_tarea.findMany({
      where: { area: "CULTIVO", activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, frecuencia_dias_default: true },
    }),
    prisma.asignaciones.findMany({
      where: { lote_id: idBig, estado: "COMPLETADA" },
      orderBy: { fecha_completada: "desc" },
      select: { tipo_tarea_id: true, fecha_completada: true },
    }),
    prisma.frecuencias_lote.findMany({
      where: { lote_id: idBig },
      select: { tipo_tarea_id: true, frecuencia_dias: true },
    }),
  ]);

  const mapaUltima = new Map<string, Date | null>();
  for (const c of asignacionesCompletadas) {
    const key = String(c.tipo_tarea_id);
    if (!mapaUltima.has(key)) mapaUltima.set(key, c.fecha_completada);
  }

  const mapaFreq = new Map<string, number>();
  for (const f of frecuenciasOverride) {
    mapaFreq.set(String(f.tipo_tarea_id), f.frecuencia_dias);
  }

  const filasTarea = tiposCultivo.map((t) => {
    const ultima = mapaUltima.get(String(t.id)) ?? null;
    const freq = mapaFreq.get(String(t.id)) ?? t.frecuencia_dias_default;
    const resumen = calcularResumen(ultima, freq);
    return { id: String(t.id), nombre: t.nombre, ...resumen };
  });

  const novedadesLote = await prisma.novedades.findMany({
    where: { arboles: { lote_id: idBig }, resuelta: false },
    orderBy: { fecha: "desc" },
    take: 5,
    include: { arboles: { select: { numero_placa: true } } },
  });

  return (
    <div className="space-y-5">
      <Link
        href="/jefe/lotes"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Lotes
      </Link>

      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
            Lote
          </p>
          <h1 className="mt-1 font-serif text-3xl text-zelanda-verde-900">
            {lote.nombre}
          </h1>
        </div>
        <Link
          href={`/jefe/lotes/${lote.id}/editar`}
          className="inline-flex min-h-touch items-center gap-1.5 rounded-lg border border-zelanda-beige-300 px-3 py-2 text-sm font-medium text-zelanda-verde-800 transition hover:bg-zelanda-beige-100"
        >
          <Pencil className="h-4 w-4" />
          Editar
        </Link>
      </header>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Información
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">
              Árboles
            </dt>
            <dd className="mt-0.5 font-medium text-zelanda-verde-900">
              {lote.total_arboles.toLocaleString("es-CO")}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">
              Hectáreas
            </dt>
            <dd className="mt-0.5 font-medium text-zelanda-verde-900">
              {lote.hectareas ? Number(lote.hectareas) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">
              Siembra
            </dt>
            <dd className="mt-0.5 font-medium text-zelanda-verde-900">
              {lote.fecha_siembra ? formatearFechaCorta(lote.fecha_siembra) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">
              Árboles cargados
            </dt>
            <dd className="mt-0.5 font-medium text-zelanda-verde-900">
              {arbolesGenerados.toLocaleString("es-CO")} / {lote.total_arboles.toLocaleString("es-CO")}
              {arbolesGenerados < lote.total_arboles ? (
                <span className="ml-2 text-xs text-zelanda-ocre-600">
                  (faltan {(lote.total_arboles - arbolesGenerados).toLocaleString("es-CO")})
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
        {lote.notas ? (
          <p className="mt-4 border-t border-zelanda-beige-200 pt-4 text-sm leading-relaxed text-zelanda-verde-700">
            {lote.notas}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-base text-zelanda-verde-900">
            Tareas y estado
          </h2>
          <Link
            href={`/jefe/lotes/${lote.id}/frecuencias`}
            className="text-xs text-zelanda-verde-700 hover:text-zelanda-verde-900"
          >
            Frecuencias
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-zelanda-beige-200">
          {filasTarea.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zelanda-verde-900">{f.nombre}</p>
                <p className="text-xs text-zelanda-verde-700">
                  {f.ultima
                    ? `Última: ${f.ultima.toLocaleDateString("es-CO", { day: "2-digit", month: "short" })} · próxima ${formatearDias(f.dias_para_proxima)}`
                    : "Sin historial"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <BadgeBase tono={tonoEstado(f.estado) === "vencida" ? "alerta" : tonoEstado(f.estado) === "aldia" ? "info" : "neutro"}>
                  {etiquetaEstado(f.estado)}
                </BadgeBase>
                <Link
                  href={`/jefe/asignaciones/nueva?lote_id=${lote.id}&tipo_tarea_id=${f.id}`}
                  className="text-xs font-medium text-zelanda-verde-700 hover:text-zelanda-verde-900"
                >
                  Asignar
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-base text-zelanda-verde-900">
            Novedades pendientes
          </h2>
          <Link
            href="/jefe/novedades"
            className="text-xs text-zelanda-verde-700 hover:text-zelanda-verde-900"
          >
            Ver todas
          </Link>
        </div>
        {novedadesLote.length === 0 ? (
          <p className="mt-2 text-sm text-zelanda-verde-700">
            No hay novedades pendientes en este lote.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {novedadesLote.map((n) => (
              <li key={String(n.id)}>
                <Link
                  href={`/jefe/novedades/${n.id}`}
                  className="block rounded-lg border border-zelanda-beige-200 px-3 py-2 text-sm transition hover:bg-zelanda-beige-50"
                >
                  <span className="font-medium text-zelanda-verde-900">Árbol {n.arboles.numero_placa}</span>
                  <span className="text-zelanda-verde-700"> · {n.tipo.replace("_", " ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
