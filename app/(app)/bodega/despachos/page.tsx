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
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
            Bodega
          </p>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
            Despachos
          </h1>
        </div>
        <Link
          href="/bodega/despachos/nuevo"
          className="inline-flex min-h-touch items-center gap-1 rounded-lg bg-zelanda-verde-700 px-3 py-2 text-sm text-white"
        >
          <Plus className="h-4 w-4" /> Nuevo
        </Link>
      </header>

      <form
        method="get"
        className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card"
      >
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-zelanda-verde-700">
              Desde
            </label>
            <input
              type="date"
              name="desde"
              defaultValue={aIso(rango.desde)}
              className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-zelanda-verde-700">
              Hasta
            </label>
            <input
              type="date"
              name="hasta"
              defaultValue={aIso(rango.hasta)}
              className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-zelanda-verde-700">
              Persona
            </label>
            <select
              name="persona"
              defaultValue={personaIdRaw}
              className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-1.5 text-sm"
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
              className="min-h-touch rounded-lg bg-zelanda-verde-700 px-3 text-sm text-white"
            >
              Aplicar
            </button>
            {hayFiltros && (
              <Link
                href="/bodega/despachos"
                className="min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2 text-sm text-zelanda-verde-700"
              >
                Limpiar
              </Link>
            )}
          </div>
        </div>
      </form>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-serif text-lg text-zelanda-verde-900">
          <PackageOpen className="h-5 w-5" /> Abiertos ({abiertos.length})
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

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-serif text-lg text-zelanda-verde-900">
          <CheckCircle2 className="h-5 w-5" /> {tituloCerrados} ({cerrados.length})
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
