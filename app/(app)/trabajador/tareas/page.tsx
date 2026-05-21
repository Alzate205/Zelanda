import type { Metadata } from "next";
import Link from "next/link";
import {
  ListChecks,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Pause,
  Ban,
} from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BadgeBase } from "@/components/shared/BadgeRol";
import { formatearFechaCorta } from "@/lib/utils";

export const metadata: Metadata = { title: "Mis tareas" };
export const dynamic = "force-dynamic";

type Filtro = "activas" | "completadas" | "todas";

function parsearFiltro(raw: string | undefined): Filtro {
  if (raw === "completadas" || raw === "todas") return raw;
  return "activas";
}

const ETIQUETA_ESTADO: Record<string, { texto: string; tono: "info" | "alerta" | "neutro" }> = {
  PENDIENTE: { texto: "Pendiente", tono: "neutro" },
  EN_CURSO: { texto: "En curso", tono: "info" },
  COMPLETADA: { texto: "Completada", tono: "info" },
  CANCELADA: { texto: "Cancelada", tono: "neutro" },
};

function IconoEstado({ estado }: { estado: string }) {
  const clase = "h-4 w-4 shrink-0";
  if (estado === "COMPLETADA") return <CheckCircle2 className={`${clase} text-zelanda-verde-700`} />;
  if (estado === "EN_CURSO") return <Pause className={`${clase} text-zelanda-ocre-600`} />;
  if (estado === "CANCELADA") return <Ban className={`${clase} text-zelanda-verde-700/40`} />;
  return <Circle className={`${clase} text-zelanda-verde-700/60`} />;
}

export default async function PaginaTareasTrabajador({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const usuario = await requerirUsuario("TRABAJADOR");
  const sp = await searchParams;
  const filtro = parsearFiltro(sp.filtro);

  if (usuario.persona_id === null) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="font-serif text-2xl text-zelanda-verde-900">Mis tareas</h1>
        </header>
        <p className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center text-sm text-zelanda-verde-700">
          Tu usuario no tiene persona vinculada. Pedile al jefe que la asigne.
        </p>
      </div>
    );
  }

  const whereEstado =
    filtro === "activas"
      ? { in: ["PENDIENTE" as const, "EN_CURSO" as const] }
      : filtro === "completadas"
        ? { equals: "COMPLETADA" as const }
        : undefined;

  const orderBy =
    filtro === "completadas"
      ? [{ fecha_completada: "desc" as const }]
      : [{ estado: "asc" as const }, { fecha_inicio: "asc" as const }];

  const asignaciones = await prisma.asignaciones.findMany({
    where: {
      persona_id: BigInt(usuario.persona_id),
      ...(whereEstado ? { estado: whereEstado } : {}),
    },
    orderBy,
    take: 100,
    include: {
      tipos_tarea: { select: { nombre: true, area: true } },
      lotes: { select: { id: true, nombre: true, total_arboles: true } },
      apiarios: { select: { id: true, nombre: true, total_colmenas: true } },
    },
  });

  return (
    <div className="space-y-5 pb-12">
      <Link
        href="/trabajador"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Inicio
      </Link>

      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Histórico
        </p>
        <h1 className="mt-1 flex items-center gap-2 font-serif text-2xl text-zelanda-verde-900">
          <ListChecks className="h-6 w-6 text-zelanda-verde-600" />
          Mis tareas
        </h1>
      </header>

      <nav className="flex gap-1 rounded-lg border border-zelanda-beige-300 bg-white p-1">
        {(
          [
            ["activas", "Activas"],
            ["completadas", "Completadas"],
            ["todas", "Todas"],
          ] as const
        ).map(([clave, etiqueta]) => (
          <Link
            key={clave}
            href={`/trabajador/tareas?filtro=${clave}`}
            className={`flex-1 rounded-md px-3 py-2 text-center text-sm font-medium transition ${
              filtro === clave
                ? "bg-zelanda-verde-700 text-zelanda-beige-50"
                : "text-zelanda-verde-700 hover:bg-zelanda-beige-100"
            }`}
          >
            {etiqueta}
          </Link>
        ))}
      </nav>

      {asignaciones.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center text-sm text-zelanda-verde-700">
          {filtro === "completadas"
            ? "Aún no hay tareas completadas."
            : filtro === "activas"
              ? "No tenés tareas activas en este momento."
              : "No hay tareas registradas."}
        </p>
      ) : (
        <ul className="space-y-2">
          {asignaciones.map((a) => {
            const destino = a.lote_id
              ? `Lote ${a.lotes!.nombre}`
              : a.apiario_id
                ? `Apiario ${a.apiarios!.nombre}`
                : "—";
            const total = a.lote_id
              ? (a.lotes?.total_arboles ?? 0)
              : (a.apiarios?.total_colmenas ?? 0);
            const progreso = a.lote_id
              ? `${a.arboles_completados} / ${total} árboles`
              : `${total} colmenas`;
            const meta = ETIQUETA_ESTADO[a.estado] ?? {
              texto: a.estado,
              tono: "neutro" as const,
            };
            const esActiva = a.estado === "PENDIENTE" || a.estado === "EN_CURSO";

            const contenido = (
              <>
                <IconoEstado estado={a.estado} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zelanda-verde-900">
                    {a.tipos_tarea.nombre}
                  </p>
                  <p className="text-xs text-zelanda-verde-700">
                    {destino} · {progreso}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <BadgeBase tono={meta.tono}>{meta.texto}</BadgeBase>
                    {a.estado === "COMPLETADA" && a.fecha_completada ? (
                      <span className="text-[11px] text-zelanda-verde-700/70">
                        {formatearFechaCorta(a.fecha_completada)}
                      </span>
                    ) : null}
                  </div>
                </div>
                {esActiva ? (
                  <ChevronRight className="h-4 w-4 text-zelanda-verde-700/40" />
                ) : null}
              </>
            );

            return (
              <li
                key={String(a.id)}
                className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-suave"
              >
                {esActiva ? (
                  <Link
                    href={`/trabajador/avance/${a.id}`}
                    className="flex items-center gap-3"
                  >
                    {contenido}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3">{contenido}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
