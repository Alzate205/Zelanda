import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BadgeBase } from "@/components/shared/BadgeRol";
import { formatearFechaCorta } from "@/lib/utils";
import { ETIQUETA_ESTADO_ASIGNACION } from "@/lib/constantes";
import { cancelarAsignacion, reabrirAsignacion } from "../acciones";
import { BotonSubmit } from "./_botones";

export const metadata: Metadata = { title: "Asignación" };

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

function formatearFechaHora(d: Date): string {
  return d.toLocaleString("es-CO", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default async function DetalleAsignacion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id } = await params;
  const idBig = parsearId(id);
  if (!idBig) notFound();

  const a = await prisma.asignaciones.findUnique({
    where: { id: idBig },
    include: {
      persona: { select: { nombre_completo: true } },
      tipos_tarea: { select: { nombre: true, area: true } },
      lotes: { select: { nombre: true, total_arboles: true } },
      registros_avance: {
        orderBy: { fecha_registro: "desc" },
        include: { persona: { select: { nombre_completo: true } } },
      },
    },
  });

  if (!a) notFound();

  let apiarioNombre: string | null = null;
  if (a.apiario_id) {
    const ap = await prisma.apiarios.findUnique({
      where: { id: a.apiario_id },
      select: { nombre: true },
    });
    apiarioNombre = ap?.nombre ?? null;
  }

  const destino = a.lote_id
    ? { tipo: "lote" as const, nombre: a.lotes!.nombre, total: a.lotes!.total_arboles }
    : { tipo: "apiario" as const, nombre: apiarioNombre ?? "?", total: null };

  const abierta = a.estado === "PENDIENTE" || a.estado === "EN_CURSO";

  return (
    <div className="space-y-5">
      <Link
        href="/jefe/asignaciones"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Asignaciones
      </Link>

      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          {destino.tipo === "lote" ? "Lote" : "Apiario"} {destino.nombre}
        </p>
        <h1 className="mt-1 font-serif text-2xl leading-tight text-zelanda-verde-900">
          {a.tipos_tarea.nombre}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <BadgeBase tono={a.estado === "COMPLETADA" ? "info" : a.estado === "CANCELADA" ? "alerta" : "neutro"}>
            {ETIQUETA_ESTADO_ASIGNACION[a.estado] ?? a.estado}
          </BadgeBase>
          <span className="text-xs text-zelanda-verde-700">
            {a.persona.nombre_completo}
          </span>
        </div>
      </header>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">Información</h2>
        <dl className="mt-3 space-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">Fecha inicio</dt>
            <dd className="mt-0.5 text-zelanda-verde-900">{formatearFechaCorta(a.fecha_inicio)}</dd>
          </div>
          {a.fecha_completada ? (
            <div>
              <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">Completada</dt>
              <dd className="mt-0.5 text-zelanda-verde-900">{formatearFechaCorta(a.fecha_completada)}</dd>
            </div>
          ) : null}
          {destino.total !== null ? (
            <div>
              <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">Progreso</dt>
              <dd className="mt-0.5 text-zelanda-verde-900">
                {a.arboles_completados} / {destino.total} árboles
                ({destino.total > 0 ? Math.round((a.arboles_completados / destino.total) * 100) : 0}%)
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">Historial de registros</h2>
        {a.registros_avance.length === 0 ? (
          <p className="mt-2 text-sm text-zelanda-verde-700">Sin registros aún.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {a.registros_avance.map((r) => (
              <li key={String(r.id)} className="border-l-2 border-zelanda-beige-300 pl-3">
                <p className="text-sm font-medium text-zelanda-verde-900">
                  {r.tipo_registro}
                  {r.tipo_registro === "TRAMO" ? ` · árboles ${r.arbol_desde}–${r.arbol_hasta}` : ""}
                  {r.tipo_registro === "SUELTOS" ? ` · ${r.cantidad_arboles} árboles` : ""}
                </p>
                <p className="text-xs text-zelanda-verde-700">
                  {formatearFechaHora(r.fecha_registro)} · {r.persona.nombre_completo}
                </p>
                {r.observaciones ? (
                  <p className="mt-1 text-sm text-zelanda-verde-800">{r.observaciones}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex gap-3">
        {abierta ? (
          <form action={cancelarAsignacion} className="flex-1">
            <input type="hidden" name="asignacion_id" value={String(a.id)} />
            <BotonSubmit
              texto="Cancelar asignación"
              textoPendiente="Cancelando…"
              className="w-full rounded-lg border border-zelanda-beige-300 px-4 py-3 text-base font-medium text-estado-vencida transition hover:bg-zelanda-beige-100 disabled:opacity-60"
            />
          </form>
        ) : a.estado === "COMPLETADA" ? (
          <form action={reabrirAsignacion} className="flex-1">
            <input type="hidden" name="asignacion_id" value={String(a.id)} />
            <BotonSubmit
              texto="Reabrir"
              textoPendiente="Reabriendo…"
              className="w-full rounded-lg border border-zelanda-beige-300 px-4 py-3 text-base font-medium text-zelanda-verde-800 transition hover:bg-zelanda-beige-100 disabled:opacity-60"
            />
          </form>
        ) : null}
      </div>
    </div>
  );
}
