import Link from "next/link";
import { Plus } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseRangoFechas, whereFecha, aIso } from "@/lib/rango-fechas";

export const metadata = { title: "Cosechas" };

export default async function PaginaCosechas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requerirUsuario("ALMACEN");

  const sp = await searchParams;
  const rango = parseRangoFechas(sp);
  const loteIdRaw = typeof sp.lote === "string" ? sp.lote : "";
  const filtroLote =
    loteIdRaw && /^\d+$/.test(loteIdRaw)
      ? { lote_id: BigInt(loteIdRaw) }
      : {};

  const where = {
    ...whereFecha("fecha", rango),
    ...filtroLote,
  };

  const [cosechas, lotes, totales] = await Promise.all([
    prisma.cosechas.findMany({
      where,
      take: 100,
      orderBy: { fecha: "desc" },
      include: {
        persona: { select: { nombre_completo: true } },
        lotes: { select: { nombre: true } },
      },
    }),
    prisma.lotes.findMany({
      where: { deleted_at: null },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
    prisma.cosechas.aggregate({
      where,
      _count: { _all: true },
      _sum: { peso_kg: true },
    }),
  ]);

  const fmt = (d: Date) =>
    d.toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const hayFiltros =
    rango.desde !== null || rango.hasta !== null || loteIdRaw !== "";

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
            Almacén
          </p>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
            Cosechas
          </h1>
        </div>
        <Link
          href="/almacen/cosecha/nueva"
          className="inline-flex min-h-touch items-center gap-1 rounded-lg bg-zelanda-verde-700 px-3 py-2 text-sm text-white"
        >
          <Plus className="h-4 w-4" /> Nueva
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
              Lote
            </label>
            <select
              name="lote"
              defaultValue={loteIdRaw}
              className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-1.5 text-sm"
            >
              <option value="">Todos</option>
              {lotes.map((l) => (
                <option key={l.id.toString()} value={l.id.toString()}>
                  {l.nombre}
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
                href="/almacen/cosecha"
                className="min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2 text-sm text-zelanda-verde-700"
              >
                Limpiar
              </Link>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-zelanda-verde-700/70">
          {totales._count._all} cosecha{totales._count._all === 1 ? "" : "s"} ·{" "}
          {Number(totales._sum.peso_kg ?? 0).toLocaleString("es-CO", {
            maximumFractionDigits: 2,
          })}{" "}
          kg total
        </p>
      </form>

      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        {cosechas.length === 0 ? (
          <p className="text-sm text-zelanda-verde-700/70">
            {hayFiltros
              ? "No hay cosechas que coincidan con los filtros."
              : "Aún no hay cosechas registradas."}
          </p>
        ) : (
          <ul className="divide-y divide-zelanda-beige-200">
            {cosechas.map((c) => (
              <li
                key={c.id.toString()}
                className="grid grid-cols-[1fr_auto] gap-2 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-zelanda-verde-900">
                    {c.persona.nombre_completo} · {c.lotes.nombre}
                  </p>
                  <p className="text-xs text-zelanda-verde-700/70">
                    {fmt(c.fecha)} · {c.metodo_medicion}
                  </p>
                </div>
                <p className="text-right font-serif text-zelanda-verde-900">
                  {Number(c.peso_kg).toLocaleString("es-CO", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  kg
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
