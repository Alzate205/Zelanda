import Link from "next/link";
import { Plus, Bell, Check, ChevronLeft } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AvatarIniciales } from "@/components/shared/AvatarIniciales";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Badge } from "@/components/ui/Badge";
import {
  marcarRecordatorioHecho,
  reabrirRecordatorio,
  borrarRecordatorio,
} from "./acciones";

export const metadata = { title: "Recordatorios" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ resueltos?: string }>;

function fmtFecha(d: Date): string {
  return d.toLocaleDateString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function diasParaHoy(fecha: Date): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(fecha);
  f.setHours(0, 0, 0, 0);
  return Math.round((f.getTime() - hoy.getTime()) / 86400000);
}

function etiquetaFecha(fecha: Date): string {
  const d = diasParaHoy(fecha);
  if (d === 0) return "Hoy";
  if (d === 1) return "Mañana";
  if (d === -1) return "Ayer";
  if (d > 0 && d <= 7) return `En ${d} días`;
  if (d < 0) return `Hace ${Math.abs(d)} días`;
  return fmtFecha(fecha);
}

function badgeEstadoFecha(
  fecha: Date,
): "vencida" | "proxima" | "aldia" | "neutro" {
  const d = diasParaHoy(fecha);
  if (d < 0) return "vencida";
  if (d === 0) return "proxima";
  if (d <= 7) return "proxima";
  return "neutro";
}

export default async function PaginaRecordatorios({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const usuario = await requerirUsuario();
  const sp = await searchParams;
  const verResueltos = sp.resueltos === "si";

  if (usuario.persona_id === null) {
    return (
      <div className="space-y-4">
        <header>
          <Eyebrow>Recordatorios</Eyebrow>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
            Recordatorios
          </h1>
        </header>
        <p className="rounded-2xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center text-sm text-zelanda-verde-700">
          Tu usuario no tiene persona vinculada. Pedile al jefe que la asigne.
        </p>
      </div>
    );
  }

  const personaId = BigInt(usuario.persona_id);
  const esJefe = usuario.rol === "JEFE";

  const filtro = esJefe
    ? {}
    : {
        OR: [
          { asignado_a_persona_id: personaId },
          { creado_por_persona_id: personaId },
        ],
      };

  const recordatorios = await prisma.recordatorios.findMany({
    where: {
      ...filtro,
      completado_en: verResueltos ? { not: null } : null,
    },
    orderBy: verResueltos
      ? [{ completado_en: "desc" }]
      : [{ fecha: "asc" }, { created_at: "desc" }],
    take: 100,
    include: {
      asignado_a: { select: { id: true, nombre_completo: true } },
      creado_por: { select: { nombre_completo: true } },
      completado_por: { select: { nombre_completo: true } },
    },
  });

  const cancelarPath = esJefe ? "/jefe" : "/trabajador";

  return (
    <div className="space-y-5">
      <Link
        href={cancelarPath}
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Inicio
      </Link>

      <header className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>Recordatorios</Eyebrow>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
            {verResueltos ? "Resueltos" : "Pendientes"}
          </h1>
          <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
            {recordatorios.length}{" "}
            {recordatorios.length === 1 ? "recordatorio" : "recordatorios"}
          </p>
        </div>
        <Link
          href="/recordatorios/nuevo"
          className="inline-flex min-h-touch items-center gap-1.5 rounded-xl bg-zelanda-verde-700 px-3.5 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
        >
          <Plus className="h-4 w-4" /> Nuevo
        </Link>
      </header>

      <nav className="grid grid-flow-col auto-cols-fr gap-0 rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 p-[3px]">
        <Link
          href="/recordatorios"
          className={`rounded-lg px-2 py-2 text-center text-[13px] font-semibold transition ${
            !verResueltos
              ? "bg-white text-zelanda-verde-900 shadow-suave"
              : "text-zelanda-verde-700"
          }`}
        >
          Pendientes
        </Link>
        <Link
          href="/recordatorios?resueltos=si"
          className={`rounded-lg px-2 py-2 text-center text-[13px] font-semibold transition ${
            verResueltos
              ? "bg-white text-zelanda-verde-900 shadow-suave"
              : "text-zelanda-verde-700"
          }`}
        >
          Resueltos
        </Link>
      </nav>

      {recordatorios.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center">
          <Bell className="mx-auto h-8 w-8 text-zelanda-verde-700/40" />
          <p className="mt-3 font-serif text-base text-zelanda-verde-900">
            {verResueltos
              ? "Sin recordatorios resueltos todavía"
              : "Sin recordatorios pendientes"}
          </p>
          <p className="mt-1 text-sm text-zelanda-verde-700">
            {verResueltos
              ? "Cuando completes uno aparecerá acá."
              : "Crea uno para no olvidar algo importante."}
          </p>
          {!verResueltos ? (
            <Link
              href="/recordatorios/nuevo"
              className="mt-4 inline-flex min-h-touch items-center gap-1.5 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
            >
              <Plus className="h-4 w-4" />
              Crear el primero
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-2">
          {recordatorios.map((r) => {
            const propio = r.asignado_a.id === personaId;
            const yoCree = r.creado_por_persona_id === personaId;
            const estadoFecha = badgeEstadoFecha(r.fecha);
            const completado = r.completado_en !== null;
            return (
              <li
                key={String(r.id)}
                className={`rounded-xl border border-l-[3px] border-zelanda-beige-200 bg-white p-3.5 shadow-suave ${
                  completado
                    ? "border-l-zelanda-verde-300 opacity-70"
                    : estadoFecha === "vencida"
                      ? "border-l-estado-vencida"
                      : estadoFecha === "proxima"
                        ? "border-l-zelanda-ocre-400"
                        : "border-l-zelanda-verde-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p
                      className={`m-0 font-serif text-[15px] ${
                        completado
                          ? "text-zelanda-verde-700 line-through"
                          : "text-zelanda-verde-900"
                      }`}
                    >
                      {r.titulo}
                    </p>
                    {r.descripcion ? (
                      <p className="m-0 mt-1 text-[12.5px] text-zelanda-verde-700">
                        {r.descripcion}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-zelanda-verde-700">
                      {!completado ? (
                        <Badge estado={estadoFecha}>
                          {etiquetaFecha(r.fecha)}
                        </Badge>
                      ) : (
                        <Badge estado="aldia">
                          <Check className="h-3 w-3" /> Hecho
                        </Badge>
                      )}
                      {!propio ? (
                        <span className="inline-flex items-center gap-1.5">
                          <AvatarIniciales
                            id={String(r.asignado_a.id)}
                            nombre={r.asignado_a.nombre_completo}
                            tamano="sm"
                          />
                          <span>Para {r.asignado_a.nombre_completo}</span>
                        </span>
                      ) : !yoCree && r.creado_por ? (
                        <span>De {r.creado_por.nombre_completo}</span>
                      ) : null}
                      {completado && r.completado_por ? (
                        <span className="text-[11px] text-zelanda-verde-700/70">
                          Cerrado por {r.completado_por.nombre_completo}
                        </span>
                      ) : null}
                    </div>
                    {completado && r.notas_completado ? (
                      <p className="m-0 mt-2 rounded-[8px] bg-zelanda-beige-100 px-2.5 py-1.5 text-[11.5px] text-zelanda-verde-800">
                        {r.notas_completado}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    {!completado ? (
                      <form action={marcarRecordatorioHecho}>
                        <input type="hidden" name="id" value={String(r.id)} />
                        <button
                          type="submit"
                          className="flex h-9 items-center gap-1 rounded-[10px] bg-zelanda-verde-700 px-3 text-[12px] font-semibold text-zelanda-beige-50 hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900)]"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Hecho
                        </button>
                      </form>
                    ) : (
                      <form action={reabrirRecordatorio}>
                        <input type="hidden" name="id" value={String(r.id)} />
                        <button
                          type="submit"
                          className="flex h-9 items-center rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 px-3 text-[12px] font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
                        >
                          Reabrir
                        </button>
                      </form>
                    )}
                    {(esJefe || yoCree) && completado ? (
                      <form action={borrarRecordatorio}>
                        <input type="hidden" name="id" value={String(r.id)} />
                        <button
                          type="submit"
                          className="flex h-8 items-center rounded-[10px] border border-[#e8b3ad] bg-[#f4dad7] px-2.5 text-[11.5px] font-semibold text-[#7b2a23] hover:bg-[#efc7c2]"
                        >
                          Borrar
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
