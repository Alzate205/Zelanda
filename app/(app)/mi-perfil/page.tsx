import type { Metadata } from "next";
import Link from "next/link";
import { LogOut, ShieldCheck, FileText, User } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AvatarIniciales } from "@/components/shared/AvatarIniciales";
import { Badge } from "@/components/ui/Badge";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Card } from "@/components/ui/Card";
import {
  ETIQUETA_ROL,
  ETIQUETA_TIPO_VINCULACION,
} from "@/lib/constantes";
import { formatearFechaCorta } from "@/lib/utils";
import type { TipoVinculacion } from "@/types";
import { cerrarSesion } from "@/app/(auth)/login/acciones";
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
              select: {
                tipo: true,
                rol_finca: true,
                fecha_inicio: true,
                periodo_pago: true,
              },
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
      <Card lift className="p-5 text-center">
        <div className="flex justify-center">
          <AvatarIniciales
            id={usuario.id}
            nombre={usuario.nombre_completo}
            tamano="lg"
          />
        </div>
        <h2 className="mt-2.5 font-serif text-[22px] text-zelanda-verde-900">
          {usuario.nombre_completo}
        </h2>
        <p className="mt-0.5 text-[12.5px] text-zelanda-verde-700">
          {ETIQUETA_ROL[usuario.rol]}
          {vincActiva
            ? ` · ${ETIQUETA_TIPO_VINCULACION[vincActiva.tipo as TipoVinculacion]} desde ${formatearFechaCorta(vincActiva.fecha_inicio)}`
            : ""}
        </p>
        {persona?.cedula ? (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-zelanda-verde-200 bg-zelanda-verde-50 px-2.5 py-1 text-[11.5px] text-zelanda-verde-800">
            <User className="h-3 w-3" />
            CC {persona.cedula}
          </div>
        ) : null}
      </Card>

      <section>
        <Eyebrow className="mb-2">Mis datos</Eyebrow>
        <Card className="p-5">
          <FormularioMisDatos
            datos={{
              nombre_completo:
                persona?.nombre_completo ?? usuario.nombre_completo,
              cedula: persona?.cedula ?? null,
              telefono: persona?.telefono ?? null,
              notas: persona?.notas ?? null,
              vinculadoAPersona: persona !== null,
            }}
          />
        </Card>
      </section>

      {vincActiva ? (
        <section>
          <Eyebrow className="mb-2">Vinculación actual</Eyebrow>
          <Card>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-serif text-[15px] text-zelanda-verde-900">
                {ETIQUETA_TIPO_VINCULACION[vincActiva.tipo as TipoVinculacion]}
                {vincActiva.rol_finca ? ` · ${vincActiva.rol_finca}` : ""}
              </span>
              <Badge estado="aldia">Activo</Badge>
            </div>
            <p className="mt-1 text-[12.5px] text-zelanda-verde-700">
              Desde {formatearFechaCorta(vincActiva.fecha_inicio)}
              {vincActiva.periodo_pago
                ? ` · pago ${vincActiva.periodo_pago.toLowerCase()}`
                : ""}
            </p>
          </Card>
        </section>
      ) : null}

      <section>
        <Eyebrow className="mb-2">Acceso</Eyebrow>
        <Card className="p-5">
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.12em] text-zelanda-verde-700">
                Correo
              </dt>
              <dd className="mt-0.5 text-zelanda-verde-900">{usuario.email}</dd>
            </div>
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.12em] text-zelanda-verde-700">
                Usuario
              </dt>
              <dd className="mt-0.5 text-zelanda-verde-900">
                {miUsuario?.username ?? (
                  <span className="text-zelanda-verde-700/60">—</span>
                )}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-zelanda-verde-700">
            Si necesitas cambiar tu correo o tu rol, pídele al jefe.
          </p>
          <div className="mt-4 border-t border-zelanda-beige-200 pt-4">
            <FormularioUsername usernameInicial={miUsuario?.username ?? null} />
          </div>
        </Card>
      </section>

      <section>
        <Eyebrow className="mb-2">Notificaciones</Eyebrow>
        <Card className="p-5">
          <p className="text-xs text-zelanda-verde-700">
            Recibí avisos de asignaciones, novedades y vencidas en este
            dispositivo.
          </p>
          <div className="mt-3">
            <PushToggle />
          </div>
        </Card>
      </section>

      <section>
        <Eyebrow className="mb-2">Seguridad</Eyebrow>
        <Card className="p-0">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-zelanda-verde-900 hover:bg-zelanda-beige-50">
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-zelanda-verde-50 text-zelanda-verde-700">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <span className="flex-1 text-sm">Cambiar contraseña</span>
              <span className="text-xs text-zelanda-verde-700 group-open:hidden">
                Cambiar
              </span>
            </summary>
            <div className="border-t border-zelanda-beige-200 px-4 py-4">
              <FormularioCambiarContrasena />
            </div>
          </details>
          <hr className="border-t border-zelanda-beige-200" />
          <Link
            href="/jefe/reportes"
            className="flex items-center gap-3 px-4 py-3 text-zelanda-verde-900 hover:bg-zelanda-beige-50"
          >
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-zelanda-verde-50 text-zelanda-verde-700">
              <FileText className="h-4 w-4" />
            </span>
            <span className="flex-1 text-sm">Términos y privacidad</span>
          </Link>
          <hr className="border-t border-zelanda-beige-200" />
          <form action={cerrarSesion}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-[#7b2a23] hover:bg-[#fcefec]"
            >
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-[#f4dad7] text-[#7b2a23]">
                <LogOut className="h-4 w-4" />
              </span>
              <span className="flex-1 text-sm">Cerrar sesión</span>
            </button>
          </form>
        </Card>
      </section>

      <p className="pt-2 text-center text-[10.5px] uppercase tracking-[0.14em] text-zelanda-verde-700/50">
        FincApp v0.1 · La Zelanda
      </p>
    </div>
  );
}
