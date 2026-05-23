import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioCrearAcceso } from "./FormularioCrearAcceso";
import { FormularioCambiarRol } from "./FormularioCambiarRol";
import { FormularioResetContrasena } from "./FormularioResetContrasena";
import type { RolUsuario } from "@/types";

export const metadata: Metadata = { title: "Gestionar acceso" };

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try { return BigInt(raw); } catch { return null; }
}

export default async function PaginaAcceso({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id } = await params;
  const idBig = parsearId(id);
  if (!idBig) notFound();

  const persona = await prisma.personas.findUnique({
    where: { id: idBig },
    include: {
      usuarios: { select: { id: true, email: true, rol: true } },
    },
  });

  if (!persona || persona.deleted_at) notFound();

  const idStr = String(persona.id);
  const usuario = persona.usuarios[0];

  if (persona.usuarios.length > 1) {
    return (
      <div className="space-y-5">
        <Link
          href={`/jefe/equipo/${idStr}`}
          className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
        >
          <ChevronLeft className="h-4 w-4" />
          {persona.nombre_completo}
        </Link>
        <p className="rounded-md border border-estado-vencida/20 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida">
          Esta persona tiene más de una cuenta de acceso enlazada. Pídele al
          admin que revise la tabla <code>usuarios</code> antes de continuar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href={`/jefe/equipo/${idStr}`}
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        {persona.nombre_completo}
      </Link>

      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Acceso al sistema
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          {usuario ? "Gestionar acceso" : "Dar acceso al sistema"}
        </h1>
      </header>

      {usuario ? (
        <>
          <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
            <h2 className="font-serif text-base text-zelanda-verde-900">
              Cuenta actual
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-[10.5px] uppercase tracking-[0.12em] text-zelanda-verde-700">Correo</dt>
                <dd className="mt-0.5 text-zelanda-verde-900">{usuario.email}</dd>
              </div>
              <div>
                <dt className="text-[10.5px] uppercase tracking-[0.12em] text-zelanda-verde-700">Rol actual</dt>
                <dd className="mt-0.5 text-zelanda-verde-900">{usuario.rol}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
            <h2 className="font-serif text-base text-zelanda-verde-900">
              Cambiar rol
            </h2>
            <p className="mt-1 mb-4 text-sm text-zelanda-verde-700">
              Define qué interfaz ve esta persona al entrar (trabajador, bodega,
              almacén o jefe).
            </p>
            <FormularioCambiarRol
              personaId={idStr}
              usuarioId={usuario.id}
              rolActual={usuario.rol as RolUsuario}
            />
          </section>

          <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
            <h2 className="font-serif text-base text-zelanda-verde-900">
              Resetear contraseña
            </h2>
            <p className="mt-1 mb-4 text-sm text-zelanda-verde-700">
              Pon una contraseña temporal y compártesela al usuario por canal
              seguro.
            </p>
            <FormularioResetContrasena usuarioId={usuario.id} />
          </section>
        </>
      ) : (
        <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
          <h2 className="font-serif text-base text-zelanda-verde-900">
            Crear cuenta de acceso
          </h2>
          <p className="mt-1 mb-4 text-sm text-zelanda-verde-700">
            Esta persona aún no puede entrar a la app. Configura su correo,
            contraseña inicial y rol.
          </p>
          <FormularioCrearAcceso personaId={idStr} />
        </section>
      )}
    </div>
  );
}
