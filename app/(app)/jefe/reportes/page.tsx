import { TrendingUp, TrendingDown, Warehouse, ShoppingBag, BarChart3, FlaskConical } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Reportes" };
export const dynamic = "force-dynamic";

export default async function PaginaReportes() {
  await requerirUsuario("JEFE");

  const [
    cosechasTotal,
    salidasTotal,
    stockRows,
    cosechasMes,
    rankingLotes,
    topRecolectores,
    insumosConsumidos,
  ] = await Promise.all([
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
    prisma.$queryRaw<{
      id: bigint;
      nombre: string;
      total_arboles: number;
      hectareas: string | null;
      kg_total: string;
    }[]>`
      SELECT
        l.id,
        l.nombre,
        l.total_arboles,
        l.hectareas::text       AS hectareas,
        COALESCE(SUM(c.peso_kg), 0)::text AS kg_total
      FROM lotes l
      LEFT JOIN cosechas c ON c.lote_id = l.id
      WHERE l.deleted_at IS NULL
      GROUP BY l.id, l.nombre, l.total_arboles, l.hectareas
      ORDER BY SUM(c.peso_kg) DESC NULLS LAST, l.nombre ASC
    `,
    prisma.$queryRaw<{
      persona_id: bigint;
      nombre_completo: string;
      total_kg: string;
      n_cosechas: number;
    }[]>`
      SELECT
        c.persona_id,
        p.nombre_completo,
        SUM(c.peso_kg)::text    AS total_kg,
        COUNT(c.id)::int        AS n_cosechas
      FROM cosechas c
      JOIN personas p ON p.id = c.persona_id
      GROUP BY c.persona_id, p.nombre_completo
      ORDER BY SUM(c.peso_kg) DESC
      LIMIT 10
    `,
    prisma.$queryRaw<{
      insumo_id: bigint;
      nombre: string;
      unidad: string;
      total: string;
    }[]>`
      SELECT
        i.id                                AS insumo_id,
        i.nombre,
        i.unidad,
        SUM(di.cantidad_consumida)::text    AS total
      FROM despacho_items di
      JOIN insumos i ON i.id = di.insumo_id
      WHERE di.tipo_item = 'INSUMO'
        AND di.cantidad_consumida IS NOT NULL
        AND di.cantidad_consumida > 0
      GROUP BY i.id, i.nombre, i.unidad
      ORDER BY SUM(di.cantidad_consumida) DESC
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

  const maxLote = rankingLotes.reduce(
    (m, r) => Math.max(m, Number(r.kg_total)),
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

      {/* Sección 3: Ranking de lotes */}
      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-lg text-zelanda-verde-900">
          Ranking de lotes
        </h2>
        <p className="mt-1 text-xs text-zelanda-verde-700/70">
          Ordenados por cosecha acumulada. Métricas derivadas cuando hay árboles y hectáreas.
        </p>
        <ul className="mt-3 space-y-2">
          {rankingLotes.map((l) => {
            const kg = Number(l.kg_total);
            const pct = maxLote > 0 ? (kg / maxLote) * 100 : 0;
            const kgArbol = l.total_arboles > 0 ? kg / l.total_arboles : null;
            const hect = l.hectareas ? Number(l.hectareas) : 0;
            const kgHa = hect > 0 ? kg / hect : null;
            return (
              <li key={l.id.toString()} className="text-sm">
                <div className="flex items-center justify-between gap-2 text-zelanda-verde-900">
                  <span className="font-medium">{l.nombre}</span>
                  <span className="font-serif">{fmtKg(kg)} kg</span>
                </div>
                <div className="mt-0.5 text-xs text-zelanda-verde-700/70">
                  {kgArbol !== null
                    ? `${kgArbol.toFixed(2)} kg/árbol`
                    : "— kg/árbol"}
                  {" · "}
                  {kgHa !== null
                    ? `${kgHa.toFixed(2)} kg/ha`
                    : "— kg/ha"}
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
      </section>

      {/* Sección 4: Top recolectores de la finca */}
      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="font-serif text-lg text-zelanda-verde-900">
          Top recolectores
        </h2>
        {topRecolectores.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">
            Sin recolectores registrados.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zelanda-beige-200">
            {topRecolectores.map((r) => (
              <li
                key={r.persona_id.toString()}
                className="grid grid-cols-[1fr_auto] gap-2 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-zelanda-verde-900">
                    {r.nombre_completo}
                  </p>
                  <p className="text-xs text-zelanda-verde-700/70">
                    {r.n_cosechas} cosecha{r.n_cosechas === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="text-right font-serif text-zelanda-verde-900">
                  {fmtKg(Number(r.total_kg))} kg
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Sección 5: Insumos consumidos (finca) */}
      <section className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-serif text-lg text-zelanda-verde-900">
          <FlaskConical className="h-5 w-5" /> Insumos consumidos
        </h2>
        <p className="mt-1 text-xs text-zelanda-verde-700/70">
          Suma de <code>cantidad_consumida</code> en todos los despachos cerrados.
        </p>
        {insumosConsumidos.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">
            Sin insumos consumidos.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zelanda-beige-200">
            {insumosConsumidos.map((c) => (
              <li
                key={c.insumo_id.toString()}
                className="grid grid-cols-[1fr_auto] gap-2 py-2 text-sm"
              >
                <span className="truncate font-medium text-zelanda-verde-900">
                  {c.nombre}
                </span>
                <span className="text-right font-serif text-zelanda-verde-900">
                  {Number(c.total).toLocaleString("es-CO", {
                    maximumFractionDigits: 3,
                  })}{" "}
                  {c.unidad}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
