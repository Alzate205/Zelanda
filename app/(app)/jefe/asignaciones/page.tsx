import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BadgeBase } from "@/components/shared/BadgeRol";
import { formatearFechaCorta } from "@/lib/utils";

export const metadata = { title: "Asignaciones" };

type SearchParams = Promise<{ estado?: string }>;

export default async function PaginaAsignaciones({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requerirUsuario("JEFE");
  const sp = await searchParams;

  const filtroEstado = sp.estado;
  const where = filtroEstado
    ? filtroEstado === "abiertas"
      ? { estado: { in: ["PENDIENTE" as const, "EN_CURSO" as const] } }
      : filtroEstado === "todas"
        ? {}
        : { estado: filtroEstado as "PENDIENTE" | "EN_CURSO" | "COMPLETADA" | "CANCELADA" }
    : { estado: { in: ["PENDIENTE" as const, "EN_CURSO" as const] } };

  const asignaciones = await prisma.asignaciones.findMany({
    where,
    orderBy: { fecha_inicio: "desc" },
    take: 100,
    include: {
      persona: { select: { nombre_completo: true } },
      tipos_tarea: { select: { nombre: true, area: true } },
      lotes: { select: { nombre: true, total_arboles: true } },
    },
  });

  const apiarioIds = Array.from(
    new Set(asignaciones.map((a) => a.apiario_id).filter((x): x is bigint => x !== null)),
  );
  const apiarios = apiarioIds.length
    ? await prisma.apiarios.findMany({
        where: { id: { in: apiarioIds } },
        select: { id: true, nombre: true },
      })
    : [];
  const mapaApiario = new Map(apiarios.map((a) => [String(a.id), a.nombre]));

  const opciones = [
    { value: "abiertas", label: "Abiertas" },
    { value: "PENDIENTE", label: "Pendientes" },
    { value: "EN_CURSO", label: "En curso" },
    { value: "COMPLETADA", label: "Completadas" },
    { value: "CANCELADA", label: "Canceladas" },
    { value: "todas", label: "Todas" },
  ];
  const filtroActual = filtroEstado ?? "abiertas";

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
            Tareas asignadas
          </p>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
            Asignaciones
          </h1>
          <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
            {asignaciones.length}{" "}
            {asignaciones.length === 1 ? "asignación" : "asignaciones"} ·
            {" "}
            {opciones.find((o) => o.value === filtroActual)?.label.toLowerCase()}
          </p>
        </div>
        <Link
          href="/jefe/asignaciones/nueva"
          className="inline-flex min-h-touch items-center gap-1.5 rounded-xl bg-zelanda-verde-700 px-3.5 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
        >
          <Plus className="h-4 w-4" />
          Nueva
        </Link>
      </header>

      <nav className="flex flex-wrap gap-1.5">
        {opciones.map((o) => (
          <Link
            key={o.value}
            href={`/jefe/asignaciones?estado=${o.value}`}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              filtroActual === o.value
                ? "bg-zelanda-verde-700 text-zelanda-beige-50"
                : "border border-zelanda-beige-300 text-zelanda-verde-700 hover:bg-zelanda-beige-100"
            }`}
          >
            {o.label}
          </Link>
        ))}
      </nav>

      <ul className="space-y-2">
        {asignaciones.length === 0 ? (
          <li className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center text-sm text-zelanda-verde-700">
            No hay asignaciones con este filtro.
          </li>
        ) : (
          asignaciones.map((a) => {
            const destino = a.lote_id
              ? `Lote ${a.lotes!.nombre}`
              : `Apiario ${mapaApiario.get(String(a.apiario_id)) ?? "?"}`;
            const total = a.lotes?.total_arboles ?? null;
            return (
              <li
                key={String(a.id)}
                className="rounded-xl border border-zelanda-beige-200 bg-white p-3 shadow-suave"
              >
                <Link
                  href={`/jefe/asignaciones/${a.id}`}
                  className="flex items-center gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zelanda-verde-900">
                      {a.tipos_tarea.nombre} · {destino}
                    </p>
                    <p className="truncate text-xs text-zelanda-verde-700">
                      {a.persona.nombre_completo} · inicio {formatearFechaCorta(a.fecha_inicio)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <BadgeBase tono={a.estado === "COMPLETADA" ? "info" : a.estado === "CANCELADA" ? "alerta" : "neutro"}>
                        {a.estado === "PENDIENTE" ? "Pendiente"
                         : a.estado === "EN_CURSO" ? "En curso"
                         : a.estado === "COMPLETADA" ? "Completada"
                         : "Cancelada"}
                      </BadgeBase>
                      {total !== null ? (
                        <span className="text-xs text-zelanda-verde-700">
                          {a.arboles_completados} / {total} árboles
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zelanda-verde-700/40" />
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
