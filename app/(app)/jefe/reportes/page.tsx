import { TrendingUp, TrendingDown, Warehouse, ShoppingBag, BarChart3 } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Reportes" };
export const dynamic = "force-dynamic";

export default async function PaginaReportes() {
  await requerirUsuario("JEFE");

  const [cosechasTotal, salidasTotal, stockRows, cosechasMes] = await Promise.all([
    prisma.cosechas.aggregate({
      _count: { _all: true },
      _sum: { peso_kg: true },
    }),
    prisma.salidas_cosecha.aggregate({
      _sum: { cantidad_kg: true },
    }),
    prisma.$queryRaw<{ stock_kg: string }[]>`
      SELECT stock_kg::text FROM v_stock_almacen
    `,
    prisma.$queryRaw<{ ym: string; total_kg: string; n_cosechas: number }[]>`
      SELECT
        TO_CHAR(fecha, 'YYYY-MM')          AS ym,
        SUM(peso_kg)::text                  AS total_kg,
        COUNT(*)::int                       AS n_cosechas
      FROM cosechas
      WHERE fecha >= NOW() - INTERVAL '12 months'
      GROUP BY ym
      ORDER BY ym DESC
    `,
  ]);

  const totalCosechaKg = Number(cosechasTotal._sum.peso_kg ?? 0);
  const nCosechas = cosechasTotal._count._all;
  const totalSalidasKg = Number(salidasTotal._sum.cantidad_kg ?? 0);
  const stockKg = Number(stockRows[0]?.stock_kg ?? 0);

  const fmtKg = (n: number) =>
    n.toLocaleString("es-CO", { maximumFractionDigits: 2 });

  const fmtMes = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("es-CO", {
      month: "short",
      year: "2-digit",
    });
  };

  const maxMes = cosechasMes.reduce(
    (m, r) => Math.max(m, Number(r.total_kg)),
    0,
  );

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-zelanda-verde-700">
          Jefe · Reportes
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Reportes de la finca
        </h1>
        <p className="mt-1 text-xs text-zelanda-verde-700/70">
          Datos consolidados de todos los lotes y operaciones.
        </p>
      </header>

      {/* Sección 1: Resumen acumulado */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card">
          <div className="flex items-center gap-2 text-zelanda-verde-700">
            <TrendingUp className="h-4 w-4" />
            <p className="text-xs uppercase tracking-wider">Cosecha total</p>
          </div>
          <p className="mt-2 font-serif text-2xl text-zelanda-verde-900">
            {fmtKg(totalCosechaKg)} kg
          </p>
        </div>
        <div className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card">
          <div className="flex items-center gap-2 text-zelanda-verde-700">
            <ShoppingBag className="h-4 w-4" />
            <p className="text-xs uppercase tracking-wider">Cosechas</p>
          </div>
          <p className="mt-2 font-serif text-2xl text-zelanda-verde-900">
            {nCosechas.toLocaleString("es-CO")}
          </p>
        </div>
        <div className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card">
          <div className="flex items-center gap-2 text-zelanda-verde-700">
            <TrendingDown className="h-4 w-4" />
            <p className="text-xs uppercase tracking-wider">Salidas totales</p>
          </div>
          <p className="mt-2 font-serif text-2xl text-zelanda-verde-900">
            {fmtKg(totalSalidasKg)} kg
          </p>
        </div>
        <div className="rounded-xl border border-zelanda-beige-200 bg-white p-4 shadow-card">
          <div className="flex items-center gap-2 text-zelanda-verde-700">
            <Warehouse className="h-4 w-4" />
            <p className="text-xs uppercase tracking-wider">Stock actual</p>
          </div>
          <p className="mt-2 font-serif text-2xl text-zelanda-verde-900">
            {fmtKg(stockKg)} kg
          </p>
        </div>
      </section>

      {/* Sección 2: Cosecha últimos 12 meses */}
      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-serif text-lg text-zelanda-verde-900">
          <BarChart3 className="h-5 w-5" /> Cosecha — últimos 12 meses
        </h2>
        {cosechasMes.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">
            Sin cosechas en los últimos 12 meses.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {cosechasMes.map((r) => {
              const v = Number(r.total_kg);
              const pct = maxMes > 0 ? (v / maxMes) * 100 : 0;
              return (
                <li key={r.ym} className="text-sm">
                  <div className="flex items-center justify-between text-xs text-zelanda-verde-700/70">
                    <span>{fmtMes(r.ym)}</span>
                    <span>
                      {fmtKg(v)} kg · {r.n_cosechas} cosecha
                      {r.n_cosechas === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-zelanda-beige-200">
                    <div
                      className="h-full rounded-full bg-zelanda-verde-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
