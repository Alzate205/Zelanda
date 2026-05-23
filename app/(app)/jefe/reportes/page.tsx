import { TrendingUp, TrendingDown, Warehouse, ShoppingBag, BarChart3, FlaskConical } from "lucide-react";
import { requerirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DescargarCSVButton } from "@/components/jefe/DescargarCSVButton";

export const metadata = { title: "Reportes" };
export const dynamic = "force-dynamic";

export default async function PaginaReportes() {
  await requerirUsuario("JEFE");
  const hoy = new Date().toISOString().slice(0, 10);

  const [
    cosechasTotal,
    salidasTotal,
    stockRows,
    cosechasMes,
    rankingLotes,
    topRecolectores,
    insumosConsumidos,
    mielTotal,
    rankingApiarios,
    topRecolectoresMiel,
    salidasPorTipo,
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
    prisma.cosechas_miel.aggregate({
      _sum: { kg: true },
      _count: { _all: true },
    }),
    prisma.$queryRaw<{ nombre: string; total_kg: string }[]>`
      SELECT a.nombre, SUM(cm.kg)::text AS total_kg
      FROM cosechas_miel cm
      JOIN apiarios a ON a.id = cm.apiario_id
      GROUP BY a.id, a.nombre
      ORDER BY SUM(cm.kg) DESC
    `,
    prisma.$queryRaw<{
      persona_id: bigint;
      nombre_completo: string;
      total_kg: string;
    }[]>`
      SELECT cm.persona_id, p.nombre_completo, SUM(cm.kg)::text AS total_kg
      FROM cosechas_miel cm
      JOIN personas p ON p.id = cm.persona_id
      GROUP BY cm.persona_id, p.nombre_completo
      ORDER BY SUM(cm.kg) DESC
      LIMIT 5
    `,
    prisma.$queryRaw<{ tipo: string; total_kg: string; n_salidas: number }[]>`
      SELECT tipo::text                  AS tipo,
             SUM(cantidad_kg)::text       AS total_kg,
             COUNT(*)::int                AS n_salidas
      FROM salidas_cosecha
      WHERE fecha >= NOW() - INTERVAL '12 months'
      GROUP BY tipo
      ORDER BY SUM(cantidad_kg) DESC
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

  const totalMielKg = Number(mielTotal._sum.kg ?? 0);
  const hayMiel = mielTotal._count._all > 0;

  const totalSalidas12m = salidasPorTipo.reduce(
    (s, r) => s + Number(r.total_kg),
    0,
  );
  const maxSalida = salidasPorTipo.reduce(
    (m, r) => Math.max(m, Number(r.total_kg)),
    0,
  );

  const TONO_TIPO_SALIDA: Record<string, string> = {
    VENTA: "bg-zelanda-verde-700/10 text-zelanda-verde-800",
    CONSUMO: "bg-zelanda-ocre-700/10 text-zelanda-ocre-800",
    PERDIDA: "bg-estado-vencida/10 text-estado-vencida",
    OTRO: "bg-zelanda-beige-200 text-zelanda-verde-700",
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Jefe · Reportes
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Reportes de la finca
        </h1>
        <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
          Datos consolidados de todos los lotes y operaciones.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="flex flex-col rounded-2xl border border-zelanda-beige-200 bg-white p-3 shadow-suave">
          <div className="flex items-center gap-1.5 text-zelanda-verde-700">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-[10.5px] uppercase tracking-[0.14em]">
              Cosecha total
            </span>
          </div>
          <span className="mt-0.5 font-serif text-[28px] leading-none text-zelanda-verde-900">
            {fmtKg(totalCosechaKg)}
          </span>
          <span className="mt-1 text-xs text-zelanda-verde-700">kg</span>
        </div>
        <div className="flex flex-col rounded-2xl border border-zelanda-beige-200 bg-white p-3 shadow-suave">
          <div className="flex items-center gap-1.5 text-zelanda-verde-700">
            <ShoppingBag className="h-3.5 w-3.5" />
            <span className="text-[10.5px] uppercase tracking-[0.14em]">
              Cosechas
            </span>
          </div>
          <span className="mt-0.5 font-serif text-[28px] leading-none text-zelanda-verde-900">
            {nCosechas.toLocaleString("es-CO")}
          </span>
          <span className="mt-1 text-xs text-zelanda-verde-700">
            registros
          </span>
        </div>
        <div className="flex flex-col rounded-2xl border border-zelanda-ocre-200 bg-zelanda-ocre-50 p-3 shadow-suave">
          <div className="flex items-center gap-1.5 text-zelanda-verde-700">
            <TrendingDown className="h-3.5 w-3.5" />
            <span className="text-[10.5px] uppercase tracking-[0.14em]">
              Salidas totales
            </span>
          </div>
          <span className="mt-0.5 font-serif text-[28px] leading-none text-zelanda-verde-900">
            {fmtKg(totalSalidasKg)}
          </span>
          <span className="mt-1 text-xs text-zelanda-verde-700">kg</span>
        </div>
        <div className="flex flex-col rounded-2xl border border-zelanda-beige-200 bg-white p-3 shadow-suave">
          <div className="flex items-center gap-1.5 text-zelanda-verde-700">
            <Warehouse className="h-3.5 w-3.5" />
            <span className="text-[10.5px] uppercase tracking-[0.14em]">
              Stock actual
            </span>
          </div>
          <span className="mt-0.5 font-serif text-[28px] leading-none text-zelanda-verde-900">
            {fmtKg(stockKg)}
          </span>
          <span className="mt-1 text-xs text-zelanda-verde-700">kg</span>
        </div>
      </section>

      {/* Sección 2: Cosecha últimos 12 meses */}
      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div className="flex items-start justify-between gap-2">
          <h2 className="flex items-center gap-2 font-serif text-lg text-zelanda-verde-900">
            <BarChart3 className="h-5 w-5" /> Cosecha — últimos 12 meses
          </h2>
          <DescargarCSVButton
            filename={`cosecha-12m-${hoy}.csv`}
            headers={["Mes", "Total kg", "Cosechas"]}
            rows={cosechasMes.map((r) => [
              r.ym,
              Number(r.total_kg).toFixed(2),
              r.n_cosechas,
            ])}
          />
        </div>
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
      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-serif text-lg text-zelanda-verde-900">
            Ranking de lotes
          </h2>
          <DescargarCSVButton
            filename={`ranking-lotes-${hoy}.csv`}
            headers={[
              "Lote",
              "Total árboles",
              "Hectáreas",
              "Cosecha total (kg)",
              "kg/árbol",
              "kg/ha",
            ]}
            rows={rankingLotes.map((l) => {
              const kg = Number(l.kg_total);
              const hect = l.hectareas ? Number(l.hectareas) : 0;
              return [
                l.nombre,
                l.total_arboles,
                l.hectareas ?? "",
                kg.toFixed(2),
                l.total_arboles > 0 ? (kg / l.total_arboles).toFixed(2) : "",
                hect > 0 ? (kg / hect).toFixed(2) : "",
              ];
            })}
          />
        </div>
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
      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-serif text-lg text-zelanda-verde-900">
            Top recolectores
          </h2>
          <DescargarCSVButton
            filename={`top-recolectores-${hoy}.csv`}
            headers={["Persona", "Cosechas", "Total kg"]}
            rows={topRecolectores.map((r) => [
              r.nombre_completo,
              r.n_cosechas,
              Number(r.total_kg).toFixed(2),
            ])}
          />
        </div>
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
      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div className="flex items-start justify-between gap-2">
          <h2 className="flex items-center gap-2 font-serif text-lg text-zelanda-verde-900">
            <FlaskConical className="h-5 w-5" /> Insumos consumidos
          </h2>
          <DescargarCSVButton
            filename={`insumos-consumidos-${hoy}.csv`}
            headers={["Insumo", "Unidad", "Total consumido"]}
            rows={insumosConsumidos.map((c) => [
              c.nombre,
              c.unidad,
              Number(c.total).toFixed(3),
            ])}
          />
        </div>
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

      {/* Sección 6: Miel — solo si hay datos */}
      {hayMiel ? (
        <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
          <h2 className="font-serif text-lg text-zelanda-verde-900">
            Apicultura — miel
          </h2>
          <p className="mt-2 font-serif text-3xl text-zelanda-verde-900">
            {fmtKg(totalMielKg)} kg
          </p>
          <p className="text-xs text-zelanda-verde-700/70">
            {mielTotal._count._all} cosecha{mielTotal._count._all === 1 ? "" : "s"} de miel
          </p>

          {rankingApiarios.length > 0 ? (
            <div className="mt-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[10.5px] uppercase tracking-[0.12em] text-zelanda-verde-700">
                  Por apiario
                </h3>
                <DescargarCSVButton
                  filename={`miel-por-apiario-${hoy}.csv`}
                  headers={["Apiario", "Total kg"]}
                  rows={rankingApiarios.map((a) => [
                    a.nombre,
                    Number(a.total_kg).toFixed(2),
                  ])}
                />
              </div>
              <ul className="mt-2 divide-y divide-zelanda-beige-200">
                {rankingApiarios.map((a) => (
                  <li
                    key={a.nombre}
                    className="grid grid-cols-[1fr_auto] gap-2 py-2 text-sm"
                  >
                    <span className="truncate font-medium text-zelanda-verde-900">
                      {a.nombre}
                    </span>
                    <span className="text-right font-serif text-zelanda-verde-900">
                      {fmtKg(Number(a.total_kg))} kg
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {topRecolectoresMiel.length > 0 ? (
            <div className="mt-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[10.5px] uppercase tracking-[0.12em] text-zelanda-verde-700">
                  Top recolectores de miel
                </h3>
                <DescargarCSVButton
                  filename={`top-recolectores-miel-${hoy}.csv`}
                  headers={["Persona", "Total kg"]}
                  rows={topRecolectoresMiel.map((r) => [
                    r.nombre_completo,
                    Number(r.total_kg).toFixed(2),
                  ])}
                />
              </div>
              <ul className="mt-2 divide-y divide-zelanda-beige-200">
                {topRecolectoresMiel.map((r) => (
                  <li
                    key={r.persona_id.toString()}
                    className="grid grid-cols-[1fr_auto] gap-2 py-2 text-sm"
                  >
                    <span className="truncate font-medium text-zelanda-verde-900">
                      {r.nombre_completo}
                    </span>
                    <span className="text-right font-serif text-zelanda-verde-900">
                      {fmtKg(Number(r.total_kg))} kg
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Sección 7: Salidas por tipo (últimos 12 meses) */}
      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-serif text-lg text-zelanda-verde-900">
            Salidas del almacén — últimos 12 meses
          </h2>
          <DescargarCSVButton
            filename={`salidas-12m-${hoy}.csv`}
            headers={["Tipo", "Total kg", "Salidas"]}
            rows={salidasPorTipo.map((s) => [
              s.tipo,
              Number(s.total_kg).toFixed(2),
              s.n_salidas,
            ])}
          />
        </div>
        {salidasPorTipo.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">
            Sin salidas registradas en los últimos 12 meses.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {salidasPorTipo.map((s) => {
              const kg = Number(s.total_kg);
              const pct = maxSalida > 0 ? (kg / maxSalida) * 100 : 0;
              const pctTotal =
                totalSalidas12m > 0 ? (kg / totalSalidas12m) * 100 : 0;
              return (
                <li key={s.tipo} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${TONO_TIPO_SALIDA[s.tipo] ?? ""}`}
                    >
                      {s.tipo}
                    </span>
                    <span className="font-serif text-zelanda-verde-900">
                      {fmtKg(kg)} kg
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-zelanda-verde-700/70">
                    {pctTotal.toFixed(1)}% del total · {s.n_salidas} salida
                    {s.n_salidas === 1 ? "" : "s"}
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
