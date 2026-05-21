import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil, Hexagon, MapPin, Droplet } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BadgeBase } from "@/components/shared/BadgeRol";
import { calcularResumen, formatearDias, etiquetaEstado } from "@/lib/fechas-tarea";

const ETIQUETA_ESTADO_APIARIO: Record<string, string> = {
  BIEN: "Bien",
  CON_PROBLEMAS: "Con problemas",
  CRITICO: "Crítico",
};

function tonoEstadoApiario(estado: string | null): "info" | "neutro" | "alerta" {
  if (estado === "BIEN") return "info";
  if (estado === "CON_PROBLEMAS") return "neutro";
  if (estado === "CRITICO") return "alerta";
  return "neutro";
}

function tonoBadge(estado: "aldia" | "proxima" | "vencida" | "sin_historial"): "neutro" | "alerta" | "info" {
  if (estado === "aldia") return "info";
  if (estado === "vencida" || estado === "sin_historial") return "alerta";
  return "neutro";
}

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const idBig = parsearId(id);
  if (!idBig) return { title: "Apiario no encontrado" };
  const apiario = await prisma.apiarios.findUnique({
    where: { id: idBig },
    select: { nombre: true },
  });
  return { title: apiario?.nombre ?? "Apiario no encontrado" };
}

export default async function DetalleApiario({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id } = await params;
  const idBig = parsearId(id);
  if (!idBig) notFound();

  const apiario = await prisma.apiarios.findUnique({
    where: { id: idBig },
    select: {
      id: true,
      nombre: true,
      total_colmenas: true,
      ubicacion_descripcion: true,
      activo: true,
    },
  });

  if (!apiario) notFound();

  const idStr = String(apiario.id);

  const [tiposApicultura, completadas, visitasRecientes, cosechasMiel, totalKgAnioRows] =
    await Promise.all([
      prisma.tipos_tarea.findMany({
        where: { area: "APICULTURA", activo: true },
        orderBy: { nombre: "asc" },
        select: { id: true, nombre: true, frecuencia_dias_default: true },
      }),
      prisma.asignaciones.findMany({
        where: { apiario_id: idBig, estado: "COMPLETADA" },
        orderBy: { fecha_completada: "desc" },
        select: { tipo_tarea_id: true, fecha_completada: true },
      }),
      prisma.registros_avance.findMany({
        where: {
          tipo_registro: "VISITA",
          asignaciones: { apiario_id: idBig },
        },
        orderBy: { fecha_registro: "desc" },
        take: 5,
        select: {
          id: true,
          fecha_registro: true,
          estado_apiario: true,
          observaciones: true,
          persona: { select: { nombre_completo: true } },
        },
      }),
      prisma.cosechas_miel.findMany({
        where: { apiario_id: idBig },
        orderBy: { fecha: "desc" },
        take: 5,
        select: {
          id: true,
          fecha: true,
          kg: true,
          notas: true,
          persona: { select: { nombre_completo: true } },
        },
      }),
      prisma.$queryRaw<{ kg: string }[]>`
        SELECT COALESCE(SUM(kg), 0)::text AS kg
        FROM cosechas_miel
        WHERE apiario_id = ${idBig}
          AND date_part('year', fecha) = date_part('year', CURRENT_DATE)
      `,
    ]);

  const totalKgAnio = Number(totalKgAnioRows[0]?.kg ?? 0);

  const mapaUltima = new Map<string, Date | null>();
  for (const c of completadas) {
    const key = String(c.tipo_tarea_id);
    if (!mapaUltima.has(key)) mapaUltima.set(key, c.fecha_completada);
  }

  const filasTarea = tiposApicultura.map((t) => {
    const ultima = mapaUltima.get(String(t.id)) ?? null;
    const resumen = calcularResumen(ultima, t.frecuencia_dias_default);
    return { id: String(t.id), nombre: t.nombre, ...resumen };
  });

  return (
    <div className="space-y-5">
      <Link
        href="/jefe/lotes"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Lotes y apiarios
      </Link>

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
            Apiario
          </p>
          <h1 className="mt-1 flex items-center gap-2 font-serif text-3xl text-zelanda-verde-900">
            <Hexagon className="h-6 w-6 shrink-0 text-zelanda-ocre-500" />
            {apiario.nombre}
          </h1>
          <div className="mt-2">
            {apiario.activo ? null : <BadgeBase tono="alerta">Inactivo</BadgeBase>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/jefe/apiarios/${idStr}/ubicacion`}
            className="inline-flex min-h-touch items-center gap-1.5 rounded-lg border border-zelanda-beige-300 px-3 py-2 text-sm font-medium text-zelanda-verde-800 transition hover:bg-zelanda-beige-100"
          >
            <MapPin className="h-4 w-4" />
            Ubicación
          </Link>
          <Link
            href={`/jefe/apiarios/${idStr}/editar`}
            className="inline-flex min-h-touch items-center gap-1.5 rounded-lg border border-zelanda-beige-300 px-3 py-2 text-sm font-medium text-zelanda-verde-800 transition hover:bg-zelanda-beige-100"
          >
            <Pencil className="h-4 w-4" />
            Editar
          </Link>
        </div>
      </header>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Información
        </h2>
        <dl className="mt-3 space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <Hexagon className="h-4 w-4 shrink-0 text-zelanda-verde-700/60" />
            <dt className="w-24 text-xs uppercase tracking-wider text-zelanda-verde-700">Colmenas</dt>
            <dd className="text-zelanda-verde-900">{apiario.total_colmenas}</dd>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zelanda-verde-700/60" />
            <dt className="w-24 shrink-0 text-xs uppercase tracking-wider text-zelanda-verde-700">Ubicación</dt>
            <dd className="text-zelanda-verde-900">{apiario.ubicacion_descripcion ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Tareas y estado
        </h2>
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
                <BadgeBase tono={tonoBadge(f.estado)}>
                  {etiquetaEstado(f.estado)}
                </BadgeBase>
                <Link
                  href={`/jefe/asignaciones/nueva?apiario_id=${idStr}&tipo_tarea_id=${f.id}`}
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
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Últimas visitas
        </h2>
        {visitasRecientes.length === 0 ? (
          <p className="mt-2 text-sm text-zelanda-verde-700">Sin visitas registradas todavía.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zelanda-beige-200">
            {visitasRecientes.map((v) => (
              <li key={String(v.id)} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zelanda-verde-900">
                      {v.fecha_registro.toLocaleString("es-CO", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="text-xs text-zelanda-verde-700">
                      {v.persona.nombre_completo}
                    </p>
                  </div>
                  <BadgeBase tono={tonoEstadoApiario(v.estado_apiario)}>
                    {v.estado_apiario
                      ? ETIQUETA_ESTADO_APIARIO[v.estado_apiario]
                      : "Sin estado"}
                  </BadgeBase>
                </div>
                {v.observaciones ? (
                  <p className="mt-1 text-xs text-zelanda-verde-700/80">
                    {v.observaciones}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-serif text-base text-zelanda-verde-900">
            <Droplet className="h-4 w-4 text-zelanda-ocre-600" />
            Cosechas de miel
          </h2>
          <p className="text-xs text-zelanda-verde-700">
            Total {new Date().getFullYear()}:{" "}
            <strong className="text-zelanda-verde-900">
              {totalKgAnio.toLocaleString("es-CO", { maximumFractionDigits: 1 })} kg
            </strong>
          </p>
        </div>
        {cosechasMiel.length === 0 ? (
          <p className="mt-2 text-sm text-zelanda-verde-700">Sin cosechas registradas todavía.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zelanda-beige-200">
            {cosechasMiel.map((c) => (
              <li key={String(c.id)} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zelanda-verde-900">
                      {Number(c.kg).toLocaleString("es-CO", { maximumFractionDigits: 1 })} kg
                    </p>
                    <p className="text-xs text-zelanda-verde-700">
                      {c.fecha.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
                      {" · "}
                      {c.persona.nombre_completo}
                    </p>
                  </div>
                </div>
                {c.notas ? (
                  <p className="mt-1 text-xs text-zelanda-verde-700/80">{c.notas}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
