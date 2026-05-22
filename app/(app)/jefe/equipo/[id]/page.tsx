import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Pencil,
  Calendar,
  Phone,
  IdCard,
  TrendingUp,
  Sprout,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AvatarIniciales } from "@/components/shared/AvatarIniciales";
import { BadgeRol, BadgeBase } from "@/components/shared/BadgeRol";
import { ETIQUETA_TIPO_VINCULACION } from "@/lib/constantes";
import { formatearFechaCorta } from "@/lib/utils";
import type { RolUsuario, TipoVinculacion } from "@/types";

function parsearId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const idBig = parsearId(id);
  if (!idBig) return { title: "Miembro no encontrado" };
  const persona = await prisma.personas.findUnique({
    where: { id: idBig },
    select: { nombre_completo: true },
  });
  return { title: persona?.nombre_completo ?? "Miembro no encontrado" };
}

export default async function DetalleMiembro({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirUsuario("JEFE");
  const { id } = await params;
  const idBig = parsearId(id);
  if (!idBig) notFound();

  const hace30dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    persona,
    cosecha30d,
    cosechaTotal,
    arboles30d,
    arbolesTotal,
    novedades30d,
    novedadesTotal,
    tareas30d,
    tareasTotal,
  ] = await Promise.all([
    prisma.personas.findUnique({
      where: { id: idBig },
      include: {
        usuarios: { select: { id: true, email: true, rol: true, activo: true } },
        vinculaciones: { orderBy: { fecha_inicio: "desc" } },
      },
    }),
    prisma.cosechas.aggregate({
      where: { persona_id: idBig, fecha: { gte: hace30dias } },
      _sum: { peso_kg: true },
    }),
    prisma.cosechas.aggregate({
      where: { persona_id: idBig },
      _sum: { peso_kg: true },
    }),
    prisma.registros_avance.aggregate({
      where: {
        persona_id: idBig,
        tipo_registro: { in: ["TRAMO", "SUELTOS"] },
        fecha_registro: { gte: hace30dias },
      },
      _sum: { cantidad_arboles: true },
    }),
    prisma.registros_avance.aggregate({
      where: {
        persona_id: idBig,
        tipo_registro: { in: ["TRAMO", "SUELTOS"] },
      },
      _sum: { cantidad_arboles: true },
    }),
    prisma.novedades.count({
      where: { persona_id: idBig, fecha: { gte: hace30dias } },
    }),
    prisma.novedades.count({
      where: { persona_id: idBig },
    }),
    prisma.asignaciones.count({
      where: {
        persona_id: idBig,
        estado: "COMPLETADA",
        fecha_completada: { gte: hace30dias },
      },
    }),
    prisma.asignaciones.count({
      where: { persona_id: idBig, estado: "COMPLETADA" },
    }),
  ]);

  if (!persona || persona.deleted_at) notFound();

  const vincActiva = persona.vinculaciones.find((v) => v.fecha_fin === null);
  const historial = persona.vinculaciones.filter((v) => v.fecha_fin !== null);
  const usuario = persona.usuarios[0];
  const idStr = String(persona.id);

  const kg30d = Number(cosecha30d._sum.peso_kg ?? 0);
  const kgTotal = Number(cosechaTotal._sum.peso_kg ?? 0);
  const arb30d = arboles30d._sum.cantidad_arboles ?? 0;
  const arbTotal = arbolesTotal._sum.cantidad_arboles ?? 0;

  const hayActividad =
    kgTotal > 0 || arbTotal > 0 || novedadesTotal > 0 || tareasTotal > 0;

  const fmtKg = (n: number) =>
    n.toLocaleString("es-CO", { maximumFractionDigits: 2 });
  const fmtN = (n: number) => n.toLocaleString("es-CO");

  return (
    <div className="space-y-5">
      <Link
        href="/jefe/equipo"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Equipo
      </Link>

      <header className="flex items-start gap-4">
        <AvatarIniciales id={idStr} nombre={persona.nombre_completo} tamano="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-2xl leading-tight text-zelanda-verde-900">
            {persona.nombre_completo}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {vincActiva ? (
              <BadgeBase tono="info">
                {ETIQUETA_TIPO_VINCULACION[vincActiva.tipo as TipoVinculacion]}
              </BadgeBase>
            ) : (
              <BadgeBase tono="alerta">Sin vinculación</BadgeBase>
            )}
            {usuario ? <BadgeRol rol={usuario.rol as RolUsuario} /> : null}
            {!persona.activo ? <BadgeBase tono="alerta">Inactivo</BadgeBase> : null}
          </div>
        </div>
        <Link
          href={`/jefe/equipo/${idStr}/editar`}
          className="inline-flex min-h-touch items-center gap-1.5 rounded-lg border border-zelanda-beige-300 px-3 py-2 text-sm font-medium text-zelanda-verde-800 transition hover:bg-zelanda-beige-100"
        >
          <Pencil className="h-4 w-4" />
          Editar
        </Link>
      </header>

      {/* Datos personales */}
      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Datos personales
        </h2>
        <dl className="mt-3 space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <IdCard className="h-4 w-4 shrink-0 text-zelanda-verde-700/60" />
            <dt className="w-20 text-xs uppercase tracking-wider text-zelanda-verde-700">Cédula</dt>
            <dd className="text-zelanda-verde-900">{persona.cedula ?? "—"}</dd>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 shrink-0 text-zelanda-verde-700/60" />
            <dt className="w-20 text-xs uppercase tracking-wider text-zelanda-verde-700">Teléfono</dt>
            <dd className="text-zelanda-verde-900">{persona.telefono ?? "—"}</dd>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 shrink-0 text-zelanda-verde-700/60" />
            <dt className="w-20 text-xs uppercase tracking-wider text-zelanda-verde-700">Nacimiento</dt>
            <dd className="text-zelanda-verde-900">
              {persona.fecha_nacimiento ? formatearFechaCorta(persona.fecha_nacimiento) : "—"}
            </dd>
          </div>
        </dl>
        {persona.notas ? (
          <p className="mt-4 border-t border-zelanda-beige-200 pt-4 text-sm leading-relaxed text-zelanda-verde-700">
            {persona.notas}
          </p>
        ) : null}
      </section>

      {/* Vinculación activa */}
      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Vinculación activa
        </h2>
        {vincActiva ? (
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">Tipo</dt>
              <dd className="mt-0.5 font-medium text-zelanda-verde-900">
                {ETIQUETA_TIPO_VINCULACION[vincActiva.tipo as TipoVinculacion]}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">Rol en la finca</dt>
              <dd className="mt-0.5 text-zelanda-verde-900">{vincActiva.rol_finca ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">Desde</dt>
              <dd className="mt-0.5 text-zelanda-verde-900">
                {formatearFechaCorta(vincActiva.fecha_inicio)}
              </dd>
            </div>
            {vincActiva.salario_base ? (
              <div>
                <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">
                  Salario base ({vincActiva.periodo_pago?.toLowerCase()})
                </dt>
                <dd className="mt-0.5 text-zelanda-verde-900">
                  $ {Number(vincActiva.salario_base).toLocaleString("es-CO")}
                </dd>
              </div>
            ) : null}
            {vincActiva.tarifa_jornal ? (
              <div>
                <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">
                  Tarifa por jornal
                </dt>
                <dd className="mt-0.5 text-zelanda-verde-900">
                  $ {Number(vincActiva.tarifa_jornal).toLocaleString("es-CO")}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-zelanda-verde-700">
            Sin vinculación activa.
          </p>
        )}
      </section>

      {/* Productividad */}
      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-base text-zelanda-verde-900">
          Productividad
        </h2>
        <p className="mt-1 text-xs text-zelanda-verde-700">
          Últimos 30 días · acumulado total.
        </p>

        {hayActividad ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-zelanda-beige-200 bg-zelanda-beige-50 p-3">
              <div className="flex items-center gap-1.5 text-zelanda-verde-700">
                <TrendingUp className="h-4 w-4" />
                <p className="text-xs uppercase tracking-wider">Cosecha</p>
              </div>
              <p className="mt-1 font-serif text-xl text-zelanda-verde-900">
                {fmtKg(kg30d)} kg
              </p>
              <p className="text-xs text-zelanda-verde-700/70">
                {fmtKg(kgTotal)} kg total
              </p>
            </div>
            <div className="rounded-lg border border-zelanda-beige-200 bg-zelanda-beige-50 p-3">
              <div className="flex items-center gap-1.5 text-zelanda-verde-700">
                <Sprout className="h-4 w-4" />
                <p className="text-xs uppercase tracking-wider">
                  Árboles atendidos
                </p>
              </div>
              <p className="mt-1 font-serif text-xl text-zelanda-verde-900">
                {fmtN(arb30d)}
              </p>
              <p className="text-xs text-zelanda-verde-700/70">
                {fmtN(arbTotal)} total
              </p>
            </div>
            <div className="rounded-lg border border-zelanda-beige-200 bg-zelanda-beige-50 p-3">
              <div className="flex items-center gap-1.5 text-zelanda-verde-700">
                <AlertCircle className="h-4 w-4" />
                <p className="text-xs uppercase tracking-wider">Novedades</p>
              </div>
              <p className="mt-1 font-serif text-xl text-zelanda-verde-900">
                {fmtN(novedades30d)}
              </p>
              <p className="text-xs text-zelanda-verde-700/70">
                {fmtN(novedadesTotal)} total
              </p>
            </div>
            <div className="rounded-lg border border-zelanda-beige-200 bg-zelanda-beige-50 p-3">
              <div className="flex items-center gap-1.5 text-zelanda-verde-700">
                <CheckCircle2 className="h-4 w-4" />
                <p className="text-xs uppercase tracking-wider">
                  Tareas completadas
                </p>
              </div>
              <p className="mt-1 font-serif text-xl text-zelanda-verde-900">
                {fmtN(tareas30d)}
              </p>
              <p className="text-xs text-zelanda-verde-700/70">
                {fmtN(tareasTotal)} total
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">
            Sin actividad operativa registrada para esta persona.
          </p>
        )}
      </section>

      {/* Histórico */}
      {historial.length > 0 ? (
        <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
          <h2 className="font-serif text-base text-zelanda-verde-900">
            Histórico de vinculaciones
          </h2>
          <ul className="mt-3 space-y-3">
            {historial.map((v) => (
              <li
                key={String(v.id)}
                className="border-l-2 border-zelanda-beige-300 pl-3"
              >
                <p className="text-sm font-medium text-zelanda-verde-900">
                  {ETIQUETA_TIPO_VINCULACION[v.tipo as TipoVinculacion]}
                  {v.rol_finca ? ` · ${v.rol_finca}` : ""}
                </p>
                <p className="text-xs text-zelanda-verde-700">
                  {formatearFechaCorta(v.fecha_inicio)} → {v.fecha_fin ? formatearFechaCorta(v.fecha_fin) : "activo"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Acceso */}
      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-base text-zelanda-verde-900">
            Acceso al sistema
          </h2>
          <Link
            href={`/jefe/equipo/${idStr}/acceso`}
            className="inline-flex min-h-touch items-center rounded-lg border border-zelanda-beige-300 px-3 py-1.5 text-xs font-medium text-zelanda-verde-800 transition hover:bg-zelanda-beige-100"
          >
            {usuario ? "Gestionar" : "Dar acceso"}
          </Link>
        </div>
        {usuario ? (
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">Correo</dt>
              <dd className="mt-0.5 text-zelanda-verde-900">{usuario.email}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-zelanda-verde-700">Rol</dt>
              <dd className="mt-0.5 text-zelanda-verde-900">{usuario.rol}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-zelanda-verde-700">
            Esta persona aún no puede entrar a la app.
          </p>
        )}
      </section>
    </div>
  );
}
