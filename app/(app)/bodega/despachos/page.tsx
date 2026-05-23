import Link from "next/link";
import { Plus, PackageOpen, CheckCircle2 } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseRangoFechas, whereFecha, aIso } from "@/lib/rango-fechas";

export const metadata = { title: "Despachos" };

export default async function PaginaDespachos({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requerirUsuario("BODEGA");

  const sp = await searchParams;
  const rango = parseRangoFechas(sp);
  const personaIdRaw = typeof sp.persona === "string" ? sp.persona : "";
  const filtroPersona =
    personaIdRaw && /^\d+$/.test(personaIdRaw)
      ? { persona_id: BigInt(personaIdRaw) }
      : {};

  const hayFiltros =
    rango.desde !== null || rango.hasta !== null || personaIdRaw !== "";

  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);

  const whereCerradosBase = {
    estado: "CERRADO" as const,
    ...filtroPersona,
  };

  const whereCerrados = hayFiltros
    ? {
        ...whereCerradosBase,
        ...whereFecha("fecha_devolucion", rango),
      }
    : {
        ...whereCerradosBase,
        fecha_devolucion: { gte: inicioDia },
      };

  const [abiertos, cerrados, personas] = await Promise.all([
    prisma.despachos.findMany({
      where: { estado: "ABIERTO", ...filtroPersona },
      include: {
        persona: { select: { nombre_completo: true } },
        _count: { select: { despacho_items: true } },
      },
      orderBy: { fecha: "desc" },
    }),
    prisma.despachos.findMany({
      where: whereCerrados,
      include: {
        persona: { select: { nombre_completo: true } },
        _count: { select: { despacho_items: true } },
      },
      orderBy: { fecha_devolucion: "desc" },
      take: 100,
    }),
    prisma.personas.findMany({
      where: { activo: true },
      orderBy: { nombre_completo: "asc" },
      select: { id: true, nombre_completo: true },
    }),
  ]);

  const fmtHora = (d: Date) =>
    d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

  const fmt = (d: Date) =>
    d.toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const tituloCerrados = hayFiltros ? "Cerrados (filtrados)" : "Cerrados hoy";

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
            Bodega
          </p>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
            Despachos
          </h1>
          <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
            {abiertos.length} abiertos · {cerrados.length}{" "}
            {hayFiltros ? "filtrados" : "cerrados hoy"}
          </p>
        </div>
        <Link
          href="/bodega/despachos/nuevo"
          className="inline-flex min-h-touch items-center gap-1.5 rounded-xl bg-zelanda-verde-700 px-3.5 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
        >
          <Plus className="h-4 w-4" /> Nuevo
        </Link>
      </header>

      <form
        method="get"
        className="rounded-2xl border border-zelanda-beige-200 bg-white p-4 shadow-suave"
      >
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
          <div>
            <label className="block text-[10.5px] uppercase tracking-[0.12em] text-zelanda-verde-700">
              Desde
            </label>
            <input
              type="date"
              name="desde"
              defaultValue={aIso(rango.desde)}
              className="mt-1 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[14px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
            />
          </div>
          <div>
            <label className="block text-[10.5px] uppercase tracking-[0.12em] text-zelanda-verde-700">
              Hasta
            </label>
            <input
              type="date"
              name="hasta"
              defaultValue={aIso(rango.hasta)}
              className="mt-1 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[14px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
            />
          </div>
          <div>
            <label className="block text-[10.5px] uppercase tracking-[0.12em] text-zelanda-verde-700">
              Persona
            </label>
            <select
              name="persona"
              defaultValue={personaIdRaw}
              className="mt-1 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[14px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
            >
              <option value="">Todas</option>
              {personas.map((p) => (
                <option key={p.id.toString()} value={p.id.toString()}>
                  {p.nombre_completo}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="min-h-touch rounded-xl bg-zelanda-verde-700 px-3.5 text-sm font-semibold text-zelanda-beige-50 hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
            >
              Aplicar
            </button>
            {hayFiltros && (
              <Link
                href="/bodega/despachos"
                className="min-h-touch rounded-xl border border-zelanda-beige-300 bg-zelanda-beige-100 px-3.5 text-sm font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
              >
                Limpiar
              </Link>
            )}
          </div>
        </div>
      </form>

      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <h2 className="flex items-center gap-2 font-serif text-base text-zelanda-verde-900">
          <PackageOpen className="h-5 w-5 text-zelanda-verde-700" /> Abiertos{" "}
          <span className="text-sm font-normal text-zelanda-verde-700">
            ({abiertos.length})
          </span>
        </h2>
        {abiertos.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">
            No hay despachos abiertos.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zelanda-beige-200">
            {abiertos.map((d) => (
              <li key={d.id.toString()}>
                <Link
                  href={`/bodega/despachos/${d.id}`}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zelanda-verde-900">
                      {d.persona.nombre_completo}
                    </p>
                    <p className="text-xs text-zelanda-verde-700/70">
                      {fmtHora(d.fecha)} · {d._count.despacho_items} item(s)
                    </p>
                  </div>
                  <span className="text-xs text-zelanda-verde-700">Cerrar →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <h2 className="flex items-center gap-2 font-serif text-base text-zelanda-verde-900">
          <CheckCircle2 className="h-5 w-5 text-zelanda-verde-700" />{" "}
          {tituloCerrados}{" "}
          <span className="text-sm font-normal text-zelanda-verde-700">
            ({cerrados.length})
          </span>
        </h2>
        {cerrados.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">
            {hayFiltros
              ? "No hay despachos cerrados que coincidan con los filtros."
              : "Aún no se han cerrado despachos hoy."}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zelanda-beige-200">
            {cerrados.map((d) => (
              <li key={d.id.toString()} className="py-3 text-sm">
                <p className="font-medium text-zelanda-verde-900">
                  {d.persona.nombre_completo}
                </p>
                <p className="text-xs text-zelanda-verde-700/70">
                  {hayFiltros ? fmt(d.fecha) : fmtHora(d.fecha)} →{" "}
                  {d.fecha_devolucion &&
                    (hayFiltros
                      ? fmt(d.fecha_devolucion)
                      : fmtHora(d.fecha_devolucion))}{" "}
                  · {d._count.despacho_items} item(s)
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
