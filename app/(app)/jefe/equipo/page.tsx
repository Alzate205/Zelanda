import Link from "next/link";
import { Plus, UserPlus } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AvatarIniciales } from "@/components/shared/AvatarIniciales";
import { BadgeRol, BadgeBase } from "@/components/shared/BadgeRol";
import { cambiarEstadoMiembro } from "./acciones";
import type { RolUsuario } from "@/types";

export const metadata = { title: "Equipo" };

export default async function PaginaEquipo() {
  await requerirUsuario("JEFE");

  const trabajadores = await prisma.trabajadores.findMany({
    where: { deleted_at: null },
    include: {
      usuarios: {
        select: { id: true, email: true, rol: true, activo: true },
      },
    },
    orderBy: [{ activo: "desc" }, { nombre_completo: "asc" }],
  });

  const totalActivos = trabajadores.filter((t) => t.activo).length;
  const totalConAcceso = trabajadores.filter((t) => t.usuarios.length > 0).length;
  const totalApicultores = trabajadores.filter((t) => t.es_apicultor && t.activo).length;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
            Gestión
          </p>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
            Equipo
          </h1>
          <p className="mt-1 text-sm text-zelanda-verde-700">
            {totalActivos} activos · {totalConAcceso} con acceso · {totalApicultores} apicultores
          </p>
        </div>
        <Link
          href="/jefe/equipo/nuevo"
          className="inline-flex min-h-touch items-center gap-1.5 rounded-lg bg-zelanda-verde-700 px-3.5 py-2 text-sm font-medium text-zelanda-beige-50 shadow-suave transition hover:bg-zelanda-verde-800"
        >
          <Plus className="h-4 w-4" />
          Nuevo
        </Link>
      </header>

      {trabajadores.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center">
          <UserPlus className="mx-auto h-8 w-8 text-zelanda-verde-700/60" />
          <p className="mt-3 font-serif text-base text-zelanda-verde-900">
            Aún no hay miembros del equipo
          </p>
          <p className="mt-1 text-sm text-zelanda-verde-700">
            Empieza creando a Diego, Rocío y los trabajadores de campo.
          </p>
          <Link
            href="/jefe/equipo/nuevo"
            className="mt-4 inline-flex min-h-touch items-center gap-1.5 rounded-lg bg-zelanda-verde-700 px-4 py-2 text-sm font-medium text-zelanda-beige-50 shadow-suave"
          >
            <Plus className="h-4 w-4" />
            Agregar primer miembro
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {trabajadores.map((t) => {
            const usuario = t.usuarios[0];
            const idStr = String(t.id);
            return (
              <li
                key={idStr}
                className="flex items-center gap-3 rounded-xl border border-zelanda-beige-200 bg-white p-3 shadow-suave"
              >
                <AvatarIniciales id={idStr} nombre={t.nombre_completo} tamano="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zelanda-verde-900">
                    {t.nombre_completo}
                  </p>
                  <p className="truncate text-xs text-zelanda-verde-700">
                    {t.rol_finca}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {usuario ? (
                      <BadgeRol rol={usuario.rol as RolUsuario} />
                    ) : (
                      <BadgeBase tono="neutro">Sin acceso</BadgeBase>
                    )}
                    {t.es_apicultor ? <BadgeBase tono="info">Apicultor</BadgeBase> : null}
                    {!t.activo ? <BadgeBase tono="alerta">Inactivo</BadgeBase> : null}
                  </div>
                </div>
                <form action={cambiarEstadoMiembro}>
                  <input type="hidden" name="id" value={idStr} />
                  <input
                    type="hidden"
                    name="activar"
                    value={t.activo ? "false" : "true"}
                  />
                  <button
                    type="submit"
                    className="min-h-touch rounded-lg px-2.5 py-1.5 text-xs font-medium text-zelanda-verde-700 transition hover:bg-zelanda-beige-100 hover:text-zelanda-verde-900"
                  >
                    {t.activo ? "Desactivar" : "Reactivar"}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
