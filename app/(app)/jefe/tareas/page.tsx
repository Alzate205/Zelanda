import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BadgeBase } from "@/components/shared/BadgeRol";
import { cambiarEstadoTipo } from "./acciones";

export const metadata = { title: "Tipos de tarea" };

export default async function PaginaTipos() {
  await requerirUsuario("JEFE");

  const tipos = await prisma.tipos_tarea.findMany({
    orderBy: [{ area: "asc" }, { nombre: "asc" }],
    select: {
      id: true,
      nombre: true,
      area: true,
      frecuencia_dias_default: true,
      activo: true,
      _count: { select: { asignaciones: true } },
    },
  });

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
            Configuración
          </p>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
            Tipos de tarea
          </h1>
          <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
            {tipos.filter((t) => t.activo).length} activos · {tipos.length} en
            total
          </p>
        </div>
        <Link
          href="/jefe/tareas/nuevo"
          className="inline-flex min-h-touch items-center gap-1.5 rounded-xl bg-zelanda-verde-700 px-3.5 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
        >
          <Plus className="h-4 w-4" />
          Nuevo
        </Link>
      </header>

      <ul className="space-y-2">
        {tipos.map((t) => {
          const idStr = String(t.id);
          return (
            <li
              key={idStr}
              className="flex items-center gap-3 rounded-2xl border border-zelanda-beige-200 bg-white p-3.5 shadow-suave transition hover:border-zelanda-verde-300"
            >
              <Link
                href={`/jefe/tareas/${idStr}/editar`}
                className="flex flex-1 items-center gap-3 min-w-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zelanda-verde-900">
                    {t.nombre}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <BadgeBase tono="info">{t.area}</BadgeBase>
                    <span className="text-xs text-zelanda-verde-700">
                      cada {t.frecuencia_dias_default} días
                    </span>
                    <span className="text-xs text-zelanda-verde-700">
                      · {t._count.asignaciones} asignaciones
                    </span>
                    {!t.activo ? (
                      <BadgeBase tono="alerta">Inactivo</BadgeBase>
                    ) : null}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-zelanda-verde-700/40" />
              </Link>
              <form action={cambiarEstadoTipo}>
                <input type="hidden" name="tipo_id" value={idStr} />
                <input
                  type="hidden"
                  name="activar"
                  value={t.activo ? "false" : "true"}
                />
                <button
                  type="submit"
                  className="min-h-touch rounded-lg px-2.5 py-1.5 text-xs font-medium text-zelanda-verde-700 transition hover:bg-zelanda-beige-100 hover:text-zelanda-verde-900"
                >
                  {t.activo ? "Desactivar" : "Activar"}
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
