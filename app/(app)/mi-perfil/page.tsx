import type { Metadata } from "next";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AvatarIniciales } from "@/components/shared/AvatarIniciales";
import { BadgeBase, BadgeRol } from "@/components/shared/BadgeRol";
import { ETIQUETA_TIPO_VINCULACION } from "@/lib/constantes";
import type { TipoVinculacion } from "@/types";
import { FormularioMisDatos } from "./FormularioMisDatos";
import { FormularioCambiarContrasena } from "./FormularioCambiarContrasena";
import { FormularioUsername } from "./FormularioUsername";
import { PushToggle } from "@/components/shared/PushToggle";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function PaginaMiPerfil() {
  const usuario = await requerirUsuario();

  const [persona, miUsuario] = await Promise.all([
    usuario.persona_id
      ? prisma.personas.findUnique({
          where: { id: BigInt(usuario.persona_id) },
          include: {
            vinculaciones: {
              where: { fecha_fin: null },
              take: 1,
              select: { tipo: true, rol_finca: true },
            },
          },
        })
      : Promise.resolve(null),
    prisma.usuarios.findUnique({
      where: { id: usuario.id },
      select: { username: true },
    }),
  ]);

  const vincActiva = persona?.vinculaciones[0] ?? null;

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-4">
        <AvatarIniciales
          id={usuario.id}
          nombre={usuario.nombre_completo}
          tamano="lg"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
            Mi perfil
          </p>
          <h1 className="mt-0.5 font-serif text-2xl leading-tight text-zelanda-verde-900">
            {usuario.nombre_completo}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <BadgeRol rol={usuario.rol} />
            {vincActiva ? (
              <BadgeBase tono="info">
                {ETIQUETA_TIPO_VINCULACION[vincActiva.tipo as TipoVinculacion]}
                {vincActiva.rol_finca ? ` · ${vincActiva.rol_finca}` : ""}
              </BadgeBase>
            ) : null}
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Datos de acceso
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">Correo</dt>
            <dd className="mt-0.5 text-zelanda-verde-900">{usuario.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">
              Usuario
            </dt>
            <dd className="mt-0.5 text-zelanda-verde-900">
              {miUsuario?.username ?? <span className="text-zelanda-verde-700/60">—</span>}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-zelanda-verde-700">
          Si necesitas cambiar tu correo o tu rol, pídele al jefe.
        </p>
        <div className="mt-4 border-t border-zelanda-beige-200 pt-4">
          <FormularioUsername usernameInicial={miUsuario?.username ?? null} />
        </div>
      </section>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Mis datos
        </h2>
        <p className="mt-1 text-xs text-zelanda-verde-700">
          Tus datos personales en la finca.
        </p>
        <div className="mt-4">
          <FormularioMisDatos
            datos={{
              nombre_completo: persona?.nombre_completo ?? usuario.nombre_completo,
              cedula: persona?.cedula ?? null,
              telefono: persona?.telefono ?? null,
              notas: persona?.notas ?? null,
              vinculadoAPersona: persona !== null,
            }}
          />
        </div>
      </section>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Notificaciones
        </h2>
        <p className="mt-1 text-xs text-zelanda-verde-700">
          Recibí avisos de asignaciones, novedades y vencidas en este
          dispositivo.
        </p>
        <div className="mt-3">
          <PushToggle />
        </div>
      </section>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Cambiar contraseña
        </h2>
        <div className="mt-4">
          <FormularioCambiarContrasena />
        </div>
      </section>
    </div>
  );
}
