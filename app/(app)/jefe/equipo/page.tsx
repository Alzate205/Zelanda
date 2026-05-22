import Link from "next/link";
import { Plus, UserPlus, ChevronRight } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AvatarIniciales } from "@/components/shared/AvatarIniciales";
import { BadgeRol, BadgeBase } from "@/components/shared/BadgeRol";
import { ETIQUETA_TIPO_VINCULACION } from "@/lib/constantes";
import { BotonEstadoMiembro } from "./_boton-estado";
import type { RolUsuario, TipoVinculacion } from "@/types";

export const metadata = { title: "Equipo" };

export default async function PaginaEquipo() {
  await requerirUsuario("JEFE");

  const personas = await prisma.personas.findMany({
    where: { deleted_at: null },
    include: {
      usuarios: {
        select: { id: true, email: true, rol: true, activo: true },
      },
      vinculaciones: {
        where: { fecha_fin: null },
        orderBy: { fecha_inicio: "desc" },
        take: 1,
        select: { tipo: true, rol_finca: true },
      },
    },
    orderBy: [{ activo: "desc" }, { nombre_completo: "asc" }],
  });

  const totalActivos = personas.filter((p) => p.activo).length;
  const totalConAcceso = personas.filter((p) => p.usuarios.length > 0).length;

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
            {totalActivos} activos · {totalConAcceso} con acceso
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

      {personas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center">
          <UserPlus className="mx-auto h-8 w-8 text-zelanda-verde-700/60" />
          <p className="mt-3 font-serif text-base text-zelanda-verde-900">
            Aún no hay miembros del equipo
          </p>
          <p className="mt-1 text-sm text-zelanda-verde-700">
            Empieza creando a los trabajadores fijos y jornaleros.
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
          {personas.map((p) => {
            const usuario = p.usuarios[0];
            const vinc = p.vinculaciones[0];
            const idStr = String(p.id);
            return (
              <li
                key={idStr}
                className="flex items-center gap-3 rounded-xl border border-zelanda-beige-200 bg-white p-3 shadow-suave"
              >
                <Link
                  href={`/jefe/equipo/${idStr}`}
                  className="flex flex-1 items-center gap-3 min-w-0"
                >
                  <AvatarIniciales id={idStr} nombre={p.nombre_completo} tamano="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zelanda-verde-900">
                      {p.nombre_completo}
                    </p>
                    <p className="truncate text-xs text-zelanda-verde-700">
                      {vinc?.rol_finca ?? "Sin rol"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {vinc ? (
                        <BadgeBase tono="info">
                          {ETIQUETA_TIPO_VINCULACION[vinc.tipo as TipoVinculacion]}
                        </BadgeBase>
                      ) : (
                        <BadgeBase tono="alerta">Sin vinculación</BadgeBase>
                      )}
                      {usuario ? (
                        <BadgeRol rol={usuario.rol as RolUsuario} />
                      ) : (
                        <BadgeBase tono="neutro">Sin acceso</BadgeBase>
                      )}
                      {!p.activo ? <BadgeBase tono="alerta">Inactivo</BadgeBase> : null}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zelanda-verde-700/40" />
                </Link>
                <BotonEstadoMiembro
                  id={idStr}
                  nombre={p.nombre_completo}
                  activo={p.activo}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
