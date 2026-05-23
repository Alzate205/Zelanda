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
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
            Almacén
          </p>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
            Cosechas
          </h1>
          <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
            {totales._count._all}{" "}
            {totales._count._all === 1 ? "cosecha" : "cosechas"} ·{" "}
            {Number(totales._sum.peso_kg ?? 0).toLocaleString("es-CO", {
              maximumFractionDigits: 0,
            })}{" "}
            kg
          </p>
        </div>
        <Link
          href="/almacen/cosecha/nueva"
          className="inline-flex min-h-touch items-center gap-1.5 rounded-xl bg-zelanda-verde-700 px-3.5 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
        >
          <Plus className="h-4 w-4" /> Nueva
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
              Lote
            </label>
            <select
              name="lote"
              defaultValue={loteIdRaw}
              className="mt-1 block w-full min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[14px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
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
              className="min-h-touch rounded-xl bg-zelanda-verde-700 px-3.5 text-sm font-semibold text-zelanda-beige-50 hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
            >
              Aplicar
            </button>
            {hayFiltros && (
              <Link
                href="/almacen/cosecha"
                className="min-h-touch rounded-xl border border-zelanda-beige-300 bg-zelanda-beige-100 px-3.5 text-sm font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
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

      {cosechas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center text-sm text-zelanda-verde-700">
          {hayFiltros
            ? "No hay cosechas que coincidan con los filtros."
            : "Aún no hay cosechas registradas."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {cosechas.map((c) => (
            <div
              key={c.id.toString()}
              className="flex items-center gap-3 rounded-xl border border-l-[3px] border-l-zelanda-verde-500 border-zelanda-beige-200 bg-white px-3 py-2.5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-zelanda-verde-50 text-zelanda-verde-700">
                <Plus className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-[13.5px] text-zelanda-verde-900">
                  {c.lotes.nombre} · {c.persona.nombre_completo}
                </p>
                <p className="m-0 mt-0.5 text-[11.5px] text-zelanda-verde-700">
                  {c.metodo_medicion === "CANASTA" ? "Canastas" : "Báscula"} ·{" "}
                  {fmt(c.fecha)}
                </p>
              </div>
              <span className="font-serif text-[18px] text-zelanda-verde-900">
                +
                {Number(c.peso_kg).toLocaleString("es-CO", {
                  maximumFractionDigits: 0,
                })}{" "}
                <span className="text-[11px] text-zelanda-verde-700">kg</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
