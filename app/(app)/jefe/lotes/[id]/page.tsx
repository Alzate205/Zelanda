import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Pencil,
  BarChart3,
  MapPin,
  Grid3x3,
  Weight,
  Plus,
} from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatearFechaCorta } from "@/lib/utils";
import {
  calcularResumen,
  formatearDias,
  etiquetaEstado,
  tonoEstado,
  type EstadoAlerta,
} from "@/lib/fechas-tarea";
import { ETIQUETA_NOVEDAD } from "@/lib/constantes";
import { Badge, type EstadoBadge } from "@/components/ui/Badge";
import { Card, CardTitle } from "@/components/ui/Card";
import { Bar } from "@/components/ui/Bar";
import { BuscadorArbol } from "./_buscador-arbol";

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

function badgeEstado(estado: EstadoAlerta): EstadoBadge {
  const t = tonoEstado(estado);
  if (t === "vencida") return "vencida";
  if (t === "proxima") return "proxima";
  if (t === "aldia") return "aldia";
  return "neutro";
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

  const [tiposCultivo, asignacionesCompletadas, frecuenciasOverride] =
    await Promise.all([
      prisma.tipos_tarea.findMany({
        where: { area: "CULTIVO", activo: true },
        orderBy: { nombre: "asc" },
        select: { id: true, nombre: true, frecuencia_dias_default: true },
      }),
      prisma.asignaciones.groupBy({
        by: ["tipo_tarea_id"],
        where: { lote_id: idBig, estado: "COMPLETADA" },
        _max: { fecha_completada: true },
      }),
      prisma.frecuencias_lote.findMany({
        where: { lote_id: idBig },
        select: { tipo_tarea_id: true, frecuencia_dias: true },
      }),
    ]);

  const mapaUltima = new globalThis.Map<string, Date | null>();
  for (const c of asignacionesCompletadas) {
    mapaUltima.set(String(c.tipo_tarea_id), c._max.fecha_completada);
  }

  const mapaFreq = new globalThis.Map<string, number>();
  for (const f of frecuenciasOverride) {
    mapaFreq.set(String(f.tipo_tarea_id), f.frecuencia_dias);
  }

  const filasTarea = tiposCultivo.map((t) => {
    const ultima = mapaUltima.get(String(t.id)) ?? null;
    const freq = mapaFreq.get(String(t.id)) ?? t.frecuencia_dias_default;
    const resumen = calcularResumen(ultima, freq);
    return { id: String(t.id), nombre: t.nombre, ...resumen };
  });

  const tareasActivas = filasTarea.filter(
    (f) => f.estado === "vencida" || f.estado === "proxima",
  ).length;

  const novedadesLote = await prisma.novedades.findMany({
    where: { arboles: { lote_id: idBig }, resuelta: false },
    orderBy: { fecha: "desc" },
    take: 5,
    include: { arboles: { select: { numero_placa: true } } },
  });

  const cosechaAgg = await prisma.cosechas.aggregate({
    where: { lote_id: idBig },
    _sum: { peso_kg: true },
    _count: { _all: true },
    _max: { fecha: true },
  });
  const cosechaTotalKg = Number(cosechaAgg._sum.peso_kg ?? 0);
  const cosechaCount = cosechaAgg._count._all;
  const ultimaCosecha = cosechaAgg._max.fecha;
  const promedioKgPorArbol =
    arbolesGenerados > 0 ? cosechaTotalKg / arbolesGenerados : 0;

  const estadoHero: EstadoBadge = filasTarea.some((f) => f.estado === "vencida")
    ? "vencida"
    : filasTarea.some((f) => f.estado === "proxima")
      ? "proxima"
      : "aldia";

  return (
    <div className="space-y-5">
      <div className="-mx-4 -mt-4 bg-gradient-to-b from-zelanda-verde-800 to-zelanda-verde-700 px-4 pb-4 pt-3 text-zelanda-beige-50">
        <div className="flex items-center gap-2">
          <Link
            href="/jefe/lotes"
            aria-label="Volver"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/15 bg-white/10 text-zelanda-beige-50 hover:bg-white/15"
          >
            <ChevronLeft className="h-[18px] w-[18px]" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] uppercase tracking-[0.16em] text-zelanda-beige-100/72">
              Lote · Quindío
            </p>
            <h1 className="m-0 mt-0.5 font-serif text-[22px] font-medium">
              {lote.nombre}
            </h1>
          </div>
          <Badge estado={estadoHero} />
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-zelanda-beige-100/85">
          <span>
            <strong className="font-serif text-sm text-white">
              {lote.total_arboles.toLocaleString("es-CO")}
            </strong>{" "}
            árboles
          </span>
          {lote.hectareas ? (
            <span>
              <strong className="font-serif text-sm text-white">
                {Number(lote.hectareas).toFixed(1)}
              </strong>{" "}
              ha
            </span>
          ) : null}
          <span>
            <strong className="font-serif text-sm text-white">
              {tareasActivas}
            </strong>{" "}
            tareas activas
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/jefe/lotes/${lote.id}/poligono`}
          className="inline-flex min-h-touch items-center gap-1.5 rounded-[10px] border border-zelanda-beige-300 bg-white px-3 py-2 text-sm font-medium text-zelanda-verde-800 transition hover:bg-zelanda-beige-100"
        >
          <MapPin className="h-4 w-4" />
          Polígono
        </Link>
        <Link
          href={`/jefe/lotes/${lote.id}/reporte`}
          className="inline-flex min-h-touch items-center gap-1.5 rounded-[10px] border border-zelanda-beige-300 bg-white px-3 py-2 text-sm font-medium text-zelanda-verde-800 transition hover:bg-zelanda-beige-100"
        >
          <BarChart3 className="h-4 w-4" />
          Reporte
        </Link>
        {arbolesGenerados > 0 ? (
          <Link
            href={`/jefe/lotes/${lote.id}/mapa-arboles`}
            className="inline-flex min-h-touch items-center gap-1.5 rounded-[10px] border border-zelanda-beige-300 bg-white px-3 py-2 text-sm font-medium text-zelanda-verde-800 transition hover:bg-zelanda-beige-100"
          >
            <Grid3x3 className="h-4 w-4" />
            Mapa árboles
          </Link>
        ) : null}
        <Link
          href={`/jefe/lotes/${lote.id}/editar`}
          className="inline-flex min-h-touch items-center gap-1.5 rounded-[10px] border border-zelanda-beige-300 bg-white px-3 py-2 text-sm font-medium text-zelanda-verde-800 transition hover:bg-zelanda-beige-100"
        >
          <Pencil className="h-4 w-4" />
          Editar
        </Link>
      </div>

      <Card lift>
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Información
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-[10.5px] uppercase tracking-[0.14em] text-zelanda-verde-700">
              Árboles
            </dt>
            <dd className="mt-0.5 font-medium text-zelanda-verde-900">
              {lote.total_arboles.toLocaleString("es-CO")}
            </dd>
          </div>
          <div>
            <dt className="text-[10.5px] uppercase tracking-[0.14em] text-zelanda-verde-700">
              Hectáreas
            </dt>
            <dd className="mt-0.5 font-medium text-zelanda-verde-900">
              {lote.hectareas ? Number(lote.hectareas).toFixed(1) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[10.5px] uppercase tracking-[0.14em] text-zelanda-verde-700">
              Siembra
            </dt>
            <dd className="mt-0.5 font-medium text-zelanda-verde-900">
              {lote.fecha_siembra
                ? formatearFechaCorta(lote.fecha_siembra)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[10.5px] uppercase tracking-[0.14em] text-zelanda-verde-700">
              Árboles cargados
            </dt>
            <dd className="mt-0.5 font-medium text-zelanda-verde-900">
              {arbolesGenerados.toLocaleString("es-CO")} /{" "}
              {lote.total_arboles.toLocaleString("es-CO")}
              {arbolesGenerados < lote.total_arboles ? (
                <span className="ml-2 text-xs text-zelanda-ocre-600">
                  (faltan{" "}
                  {(lote.total_arboles - arbolesGenerados).toLocaleString(
                    "es-CO",
                  )}
                  )
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
      </Card>

      <Card lift>
        <h2 className="flex items-center gap-2 font-serif text-base text-zelanda-verde-900">
          <Weight className="h-4 w-4 text-zelanda-ocre-600" />
          Cosecha acumulada
        </h2>
        {cosechaCount === 0 ? (
          <p className="mt-2 text-sm text-zelanda-verde-700">
            Aún no se ha registrado cosecha de este lote en el almacén.
          </p>
        ) : (
          <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-3 text-sm">
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.14em] text-zelanda-verde-700">
                Total
              </dt>
              <dd className="mt-0.5 font-serif text-xl text-zelanda-verde-900">
                {cosechaTotalKg.toLocaleString("es-CO", {
                  maximumFractionDigits: 0,
                })}{" "}
                <span className="text-sm">kg</span>
              </dd>
            </div>
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.14em] text-zelanda-verde-700">
                Promedio
              </dt>
              <dd className="mt-0.5 font-serif text-xl text-zelanda-verde-900">
                {promedioKgPorArbol.toFixed(1)}{" "}
                <span className="text-sm">kg/árbol</span>
              </dd>
            </div>
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.14em] text-zelanda-verde-700">
                Última
              </dt>
              <dd className="mt-0.5 text-sm text-zelanda-verde-900">
                {ultimaCosecha ? formatearFechaCorta(ultimaCosecha) : "—"}
              </dd>
            </div>
          </dl>
        )}
      </Card>

      {arbolesGenerados > 0 ? (
        <BuscadorArbol
          loteId={String(lote.id)}
          totalArboles={arbolesGenerados}
        />
      ) : null}

      <section>
        <div className="mb-2 flex items-center justify-between">
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
        <div className="flex flex-col gap-2.5">
          {filasTarea.map((f) => {
            const est = badgeEstado(f.estado);
            const barEstado =
              est === "vencida"
                ? "vencida"
                : est === "proxima"
                  ? "proxima"
                  : "aldia";
            return (
              <Card key={f.id} className="px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{f.nombre}</CardTitle>
                  <Badge estado={est}>{etiquetaEstado(f.estado)}</Badge>
                </div>
                <p className="mt-0.5 text-[12.5px] text-zelanda-verde-700">
                  {f.ultima
                    ? `Última: ${f.ultima.toLocaleDateString("es-CO", { day: "2-digit", month: "short" })} · próxima ${formatearDias(f.dias_para_proxima)}`
                    : "Sin historial"}
                </p>
                {f.ultima ? (
                  <Bar
                    valor={Math.max(
                      0,
                      Math.min(
                        1,
                        f.dias_para_proxima === null
                          ? 0
                          : f.dias_para_proxima < 0
                            ? 1
                            : 1 - f.dias_para_proxima / 90,
                      ),
                    )}
                    estado={barEstado}
                    className="mt-2.5"
                  />
                ) : null}
                <div className="mt-2 flex justify-end">
                  <Link
                    href={`/jefe/asignaciones/nueva?lote_id=${lote.id}&tipo_tarea_id=${f.id}`}
                    className="text-xs font-semibold text-zelanda-verde-700 hover:text-zelanda-verde-900"
                  >
                    Asignar →
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <Card lift>
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
                  <span className="font-medium text-zelanda-verde-900">
                    Árbol {n.arboles.numero_placa}
                  </span>
                  <span className="text-zelanda-verde-700">
                    {" "}
                    · {ETIQUETA_NOVEDAD[n.tipo] ?? n.tipo}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Link
        href={`/jefe/asignaciones/nueva?lote_id=${lote.id}`}
        className="mt-4 flex min-h-touch w-full items-center justify-center gap-2 rounded-xl bg-zelanda-verde-700 px-4 py-2 font-sans text-[15px] font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
      >
        <Plus className="h-[18px] w-[18px]" /> Asignar tarea en {lote.nombre}
      </Link>
    </div>
  );
}
