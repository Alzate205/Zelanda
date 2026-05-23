import Link from "next/link";
import { Plus } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseRangoFechas, whereFecha, aIso } from "@/lib/rango-fechas";

export const metadata = { title: "Salidas" };

const TONO_TIPO: Record<string, string> = {
  VENTA: "bg-zelanda-verde-700/10 text-zelanda-verde-800",
  CONSUMO: "bg-zelanda-ocre-700/10 text-zelanda-ocre-800",
  PERDIDA: "bg-estado-vencida/10 text-estado-vencida",
  OTRO: "bg-zelanda-beige-200 text-zelanda-verde-700",
};

const TIPOS = ["VENTA", "CONSUMO", "PERDIDA", "OTRO"] as const;
type TipoSalida = (typeof TIPOS)[number];

function esTipoValido(v: string): v is TipoSalida {
  return (TIPOS as readonly string[]).includes(v);
}

export default async function PaginaSalidas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requerirUsuario("ALMACEN");

  const sp = await searchParams;
  const rango = parseRangoFechas(sp);
  const tipoRaw = typeof sp.tipo === "string" ? sp.tipo : "";
  const filtroTipo = esTipoValido(tipoRaw) ? { tipo: tipoRaw } : {};

  const where = {
    ...whereFecha("fecha", rango),
    ...filtroTipo,
  };

  const [salidas, totales] = await Promise.all([
    prisma.salidas_cosecha.findMany({
      where,
      take: 100,
      orderBy: { fecha: "desc" },
    }),
    prisma.salidas_cosecha.aggregate({
      where,
      _count: { _all: true },
      _sum: { cantidad_kg: true, precio_total: true },
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
    rango.desde !== null || rango.hasta !== null || tipoRaw !== "";

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
            Almacén
          </p>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
            Salidas
          </h1>
          <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
            {totales._count._all}{" "}
            {totales._count._all === 1 ? "salida" : "salidas"} ·{" "}
            {Number(totales._sum.cantidad_kg ?? 0).toLocaleString("es-CO", {
              maximumFractionDigits: 0,
            })}{" "}
            kg
          </p>
        </div>
        <Link
          href="/almacen/salidas/nueva"
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
              Tipo
            </label>
            <select
              name="tipo"
              defaultValue={tipoRaw}
              className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-1.5 text-sm"
            >
              <option value="">Todos</option>
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
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
                href="/almacen/salidas"
                className="min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2 text-sm text-zelanda-verde-700"
              >
                Limpiar
              </Link>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-zelanda-verde-700/70">
          {totales._count._all} salida{totales._count._all === 1 ? "" : "s"} ·{" "}
          {Number(totales._sum.cantidad_kg ?? 0).toLocaleString("es-CO", {
            maximumFractionDigits: 2,
          })}{" "}
          kg
          {tipoRaw === "VENTA" && totales._sum.precio_total
            ? ` · $${Number(totales._sum.precio_total).toLocaleString("es-CO", { maximumFractionDigits: 0 })}`
            : ""}
        </p>
      </form>

      {salidas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center text-sm text-zelanda-verde-700">
          {hayFiltros
            ? "No hay salidas que coincidan con los filtros."
            : "Aún no hay salidas registradas."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {salidas.map((s) => (
            <div
              key={s.id.toString()}
              className="flex items-center gap-3 rounded-xl border border-l-[3px] border-l-zelanda-ocre-500 border-zelanda-beige-200 bg-white px-3 py-2.5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-zelanda-ocre-50 text-zelanda-ocre-700">
                <Plus className="h-4 w-4 rotate-45" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.04em] ${TONO_TIPO[s.tipo] ?? ""}`}
                  >
                    {s.tipo}
                  </span>
                  {s.cliente_detalle ? (
                    <span className="truncate text-[13px] text-zelanda-verde-900">
                      {s.cliente_detalle}
                    </span>
                  ) : null}
                </div>
                <p className="m-0 mt-0.5 text-[11.5px] text-zelanda-verde-700">
                  {fmt(s.fecha)}
                </p>
              </div>
              <span className="font-serif text-[18px] text-zelanda-verde-900">
                −
                {Number(s.cantidad_kg).toLocaleString("es-CO", {
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
