import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil, Hexagon, MapPin } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BadgeBase } from "@/components/shared/BadgeRol";
import { calcularResumen, formatearDias, etiquetaEstado } from "@/lib/fechas-tarea";

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

  const [tiposApicultura, completadas] = await Promise.all([
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
  ]);

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
        <Link
          href={`/jefe/apiarios/${idStr}/editar`}
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
    </div>
  );
}
