import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BadgeBase } from "@/components/shared/BadgeRol";

export const metadata = { title: "Mis tareas" };

export default async function PaginaInicioTrabajador() {
  const usuario = await requerirUsuario("TRABAJADOR");

  const asignaciones = usuario.persona_id
    ? await prisma.asignaciones.findMany({
        where: {
          persona_id: BigInt(usuario.persona_id),
          estado: { in: ["PENDIENTE", "EN_CURSO"] },
        },
        orderBy: { fecha_inicio: "asc" },
        include: {
          tipos_tarea: { select: { nombre: true, area: true } },
          lotes: { select: { nombre: true, total_arboles: true } },
        },
      })
    : [];

  const apiarioIds = Array.from(
    new Set(asignaciones.map((a) => a.apiario_id).filter((x): x is bigint => x !== null)),
  );
  const apiarios = apiarioIds.length
    ? await prisma.apiarios.findMany({
        where: { id: { in: apiarioIds } },
        select: { id: true, nombre: true, total_colmenas: true },
      })
    : [];
  const mapaApiario = new Map(apiarios.map((a) => [String(a.id), a]));

  return (
    <div className="space-y-6 pb-24">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Trabajador
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Hola, {usuario.nombre_completo.split(" ")[0]}
        </h1>
      </header>

      <section>
        <h2 className="mb-3 font-serif text-base text-zelanda-verde-900">
          Mis tareas activas <span className="text-sm text-zelanda-verde-700">({asignaciones.length})</span>
        </h2>

        {asignaciones.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center text-sm text-zelanda-verde-700">
            No tienes tareas asignadas en este momento.
          </p>
        ) : (
          <ul className="space-y-2">
            {asignaciones.map((a) => {
              const apiario = a.apiario_id ? mapaApiario.get(String(a.apiario_id)) : null;
              const destino = a.lote_id
                ? `Lote ${a.lotes!.nombre}`
                : `Apiario ${apiario?.nombre ?? "?"}`;
              const total = a.lote_id ? a.lotes?.total_arboles ?? 0 : (apiario?.total_colmenas ?? 0);
              const labelDetalle = a.lote_id
                ? `${a.arboles_completados} / ${total} árboles`
                : `${total} colmenas`;
              const accion = a.estado === "EN_CURSO" ? "Continuar" : "Empezar";

              return (
                <li
                  key={String(a.id)}
                  className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-suave"
                >
                  <Link href={`/trabajador/avance/${a.id}`} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-zelanda-verde-900">
                        {a.tipos_tarea.nombre}
                      </p>
                      <p className="text-xs text-zelanda-verde-700">
                        {destino} · {labelDetalle}
                      </p>
                      <div className="mt-1.5">
                        <BadgeBase tono={a.estado === "EN_CURSO" ? "info" : "neutro"}>
                          {a.estado === "EN_CURSO" ? "En curso" : "Pendiente"}
                        </BadgeBase>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 rounded-lg bg-zelanda-verde-700 px-3 py-2 text-sm font-medium text-zelanda-beige-50">
                      {accion}
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-16 mx-auto max-w-screen-md px-4 pb-2">
        <Link
          href="/trabajador/novedad/nueva"
          className="flex min-h-touch w-full items-center justify-center gap-2 rounded-lg bg-zelanda-ocre-600 px-4 py-3 text-base font-medium text-zelanda-beige-50 shadow-card transition hover:bg-zelanda-ocre-700"
        >
          <Plus className="h-5 w-5" />
          Reportar novedad
        </Link>
      </div>
    </div>
  );
}
