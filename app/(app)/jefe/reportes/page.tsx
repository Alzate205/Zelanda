import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Warehouse,
  ShoppingBag,
  Hexagon,
  BarChart3,
  ChevronRight,
} from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DescargarCSVButton } from '@/components/jefe/DescargarCSVButton';
import { AvatarIniciales } from '@/components/shared/AvatarIniciales';
import { Eyebrow } from '@/components/ui/Eyebrow';

export const metadata = { title: 'Reportes' };
export default async function PaginaReportes() {
  await requerirUsuario('JEFE');
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
    prisma.$queryRaw<
      {
        id: bigint;
        nombre: string;
        total_arboles: number;
        hectareas: string | null;
        kg_total: string;
      }[]
    >`
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
    prisma.$queryRaw<
      {
        persona_id: bigint;
        nombre_completo: string;
        total_kg: string;
        n_cosechas: number;
      }[]
    >`
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
    prisma.$queryRaw<
      {
        insumo_id: bigint;
        nombre: string;
        unidad: string;
        total: string;
      }[]
    >`
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
    prisma.$queryRaw<
      {
        persona_id: bigint;
        nombre_completo: string;
        total_kg: string;
      }[]
    >`
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

  const fmtKg = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 2 });

  const fmtMes = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('es-CO', {
      month: 'short',
      year: '2-digit',
    });
  };

  const maxMes = cosechasMes.reduce((m, r) => Math.max(m, Number(r.total_kg)), 0);

  const maxLote = rankingLotes.reduce((m, r) => Math.max(m, Number(r.kg_total)), 0);

  const totalMielKg = Number(mielTotal._sum.kg ?? 0);
  const hayMiel = mielTotal._count._all > 0;

  const totalSalidas12m = salidasPorTipo.reduce((s, r) => s + Number(r.total_kg), 0);

  const TONO_TIPO_SALIDA: Record<string, string> = {
    VENTA: 'bg-zelanda-verde-700/10 text-zelanda-verde-800',
    CONSUMO: 'bg-zelanda-ocre-700/10 text-zelanda-ocre-800',
    PERDIDA: 'bg-estado-vencida/10 text-estado-vencida',
    OTRO: 'bg-zelanda-beige-200 text-zelanda-verde-700',
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Jefe · Reportes
        </p>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Reportes de la finca</h1>
        <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
          Datos consolidados de todos los lotes y operaciones.
        </p>
      </header>

      <Link
        href="/jefe/reportes/avanzados"
        className="flex items-center justify-between rounded-2xl border border-zelanda-verde-200 bg-zelanda-verde-50 p-4 shadow-suave transition hover:border-zelanda-verde-400"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-zelanda-verde-700 text-zelanda-beige-50">
            <BarChart3 className="h-5 w-5" />
          </span>
          <div>
            <p className="font-serif text-[15px] text-zelanda-verde-900">Reportes avanzados</p>
            <p className="text-[12px] text-zelanda-verde-700">
              Margen del mes, año vs anterior, productividad por lote, anual
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-zelanda-verde-700" />
      </Link>

      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="flex flex-col rounded-2xl border border-zelanda-beige-200 bg-white p-3 shadow-suave">
          <div className="flex items-center gap-1.5 text-zelanda-verde-700">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-[10.5px] uppercase tracking-[0.14em]">Cosecha total</span>
          </div>
          <span className="mt-0.5 font-serif text-[28px] leading-none text-zelanda-verde-900">
            {fmtKg(totalCosechaKg)}
          </span>
          <span className="mt-1 text-xs text-zelanda-verde-700">kg</span>
        </div>
        <div className="flex flex-col rounded-2xl border border-zelanda-beige-200 bg-white p-3 shadow-suave">
          <div className="flex items-center gap-1.5 text-zelanda-verde-700">
            <ShoppingBag className="h-3.5 w-3.5" />
            <span className="text-[10.5px] uppercase tracking-[0.14em]">Cosechas</span>
          </div>
          <span className="mt-0.5 font-serif text-[28px] leading-none text-zelanda-verde-900">
            {nCosechas.toLocaleString('es-CO')}
          </span>
          <span className="mt-1 text-xs text-zelanda-verde-700">registros</span>
        </div>
        <div className="flex flex-col rounded-2xl border border-zelanda-ocre-200 bg-zelanda-ocre-50 p-3 shadow-suave">
          <div className="flex items-center gap-1.5 text-zelanda-verde-700">
            <TrendingDown className="h-3.5 w-3.5" />
            <span className="text-[10.5px] uppercase tracking-[0.14em]">Salidas totales</span>
          </div>
          <span className="mt-0.5 font-serif text-[28px] leading-none text-zelanda-verde-900">
            {fmtKg(totalSalidasKg)}
          </span>
          <span className="mt-1 text-xs text-zelanda-verde-700">kg</span>
        </div>
        <div className="flex flex-col rounded-2xl border border-zelanda-beige-200 bg-white p-3 shadow-suave">
          <div className="flex items-center gap-1.5 text-zelanda-verde-700">
            <Warehouse className="h-3.5 w-3.5" />
            <span className="text-[10.5px] uppercase tracking-[0.14em]">Stock actual</span>
          </div>
          <span className="mt-0.5 font-serif text-[28px] leading-none text-zelanda-verde-900">
            {fmtKg(stockKg)}
          </span>
          <span className="mt-1 text-xs text-zelanda-verde-700">kg</span>
        </div>
      </section>

      {/* Sección 2: Cosecha últimos 12 meses — bar chart vertical estilo mockup */}
      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-serif text-base text-zelanda-verde-900">
              Cosecha últimos 12 meses
            </h2>
            <p className="mt-0.5 text-[11.5px] text-zelanda-verde-700">
              {(cosechasMes.reduce((a, m) => a + Number(m.total_kg), 0) / 1000).toFixed(1)} t
              totales
            </p>
          </div>
          <DescargarCSVButton
            filename={`cosecha-12m-${hoy}.csv`}
            headers={['Mes', 'Total kg', 'Cosechas']}
            rows={cosechasMes.map((r) => [r.ym, Number(r.total_kg).toFixed(2), r.n_cosechas])}
          />
        </div>
        {cosechasMes.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">
            Sin cosechas en los últimos 12 meses.
          </p>
        ) : (
          <>
            <div
              className="mt-4 grid items-end gap-1"
              style={{
                gridTemplateColumns: `repeat(${cosechasMes.length}, 1fr)`,
                height: '110px',
              }}
            >
              {[...cosechasMes].reverse().map((m, i, arr) => {
                const v = Number(m.total_kg);
                const altura = maxMes > 0 ? Math.round((v / maxMes) * 90) : 0;
                const esUltimo = i === arr.length - 1;
                return (
                  <div
                    key={m.ym}
                    className="flex flex-col items-center justify-end"
                    title={`${fmtMes(m.ym)}: ${fmtKg(v)} kg`}
                  >
                    <div
                      className={`w-full rounded-t-[3px] ${
                        esUltimo ? 'bg-zelanda-ocre-500' : 'bg-zelanda-verde-600'
                      }`}
                      style={{ height: `${altura}px` }}
                    />
                  </div>
                );
              })}
            </div>
            <div
              className="mt-1.5 grid gap-1 text-center text-[8.5px] text-zelanda-verde-700"
              style={{
                gridTemplateColumns: `repeat(${cosechasMes.length}, 1fr)`,
              }}
            >
              {[...cosechasMes].reverse().map((m) => (
                <span key={m.ym}>{fmtMes(m.ym).split(' ')[0]}</span>
              ))}
            </div>

            <table className="mt-4 w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-zelanda-beige-100 text-zelanda-verde-800">
                  <th className="px-2 py-1.5 text-left font-semibold">Mes</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Kg</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Cosechas</th>
                </tr>
              </thead>
              <tbody>
                {cosechasMes.slice(0, 3).map((m) => (
                  <tr key={m.ym} className="border-b border-zelanda-beige-200">
                    <td className="px-2 py-1.5 text-zelanda-verde-900">{fmtMes(m.ym)}</td>
                    <td className="px-2 py-1.5 text-right font-serif text-zelanda-verde-900">
                      {fmtKg(Number(m.total_kg))}
                    </td>
                    <td className="px-2 py-1.5 text-right text-zelanda-verde-700">
                      {m.n_cosechas}
                    </td>
                  </tr>
                ))}
                {cosechasMes.length > 3 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-2 py-1.5 text-center text-[11px] text-zelanda-verde-700"
                    >
                      · {cosechasMes.length - 3} meses más en CSV ·
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </>
        )}
      </section>

      {/* Sección 3: Ranking de lotes */}
      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-serif text-base text-zelanda-verde-900">
              Ranking de lotes por cosecha
            </h2>
            <p className="mt-0.5 text-[11.5px] text-zelanda-verde-700">
              Año fiscal en curso · {rankingLotes.length} lotes
            </p>
          </div>
          <DescargarCSVButton
            filename={`ranking-lotes-${hoy}.csv`}
            headers={[
              'Lote',
              'Total árboles',
              'Hectáreas',
              'Cosecha total (kg)',
              'kg/árbol',
              'kg/ha',
            ]}
            rows={rankingLotes.map((l) => {
              const kg = Number(l.kg_total);
              const hect = l.hectareas ? Number(l.hectareas) : 0;
              return [
                l.nombre,
                l.total_arboles,
                l.hectareas ?? '',
                kg.toFixed(2),
                l.total_arboles > 0 ? (kg / l.total_arboles).toFixed(2) : '',
                hect > 0 ? (kg / hect).toFixed(2) : '',
              ];
            })}
          />
        </div>
        {(() => {
          const totalKg = rankingLotes.reduce((a, l) => a + Number(l.kg_total), 0);
          return (
            <ul className="mt-3 space-y-2.5">
              {rankingLotes.slice(0, 8).map((l, i) => {
                const kg = Number(l.kg_total);
                const pct = maxLote > 0 ? (kg / maxLote) * 100 : 0;
                const pctTotal = totalKg > 0 ? (kg / totalKg) * 100 : 0;
                return (
                  <li key={l.id.toString()}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-serif text-[13.5px] text-zelanda-verde-900">
                        <span className="mr-1.5 text-zelanda-verde-700">{i + 1}.</span>
                        {l.nombre}
                      </span>
                      <span className="text-[12px] text-zelanda-verde-700">
                        <strong className="text-zelanda-verde-900">{fmtKg(kg)}</strong> kg ·{' '}
                        {pctTotal.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zelanda-beige-200">
                      <div
                        className="h-full rounded-full bg-zelanda-verde-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
              {rankingLotes.length > 8 ? (
                <li className="pt-1 text-center text-[11px] text-zelanda-verde-700">
                  · {rankingLotes.length - 8} lotes más en CSV ·
                </li>
              ) : null}
            </ul>
          );
        })()}
      </section>

      {/* Sección 4: Top recolectores de la finca */}
      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-serif text-base text-zelanda-verde-900">Top recolectores</h2>
            <p className="mt-0.5 text-[11.5px] text-zelanda-verde-700">Por kg totales</p>
          </div>
          <DescargarCSVButton
            filename={`top-recolectores-${hoy}.csv`}
            headers={['Persona', 'Cosechas', 'Total kg']}
            rows={topRecolectores.map((r) => [
              r.nombre_completo,
              r.n_cosechas,
              Number(r.total_kg).toFixed(2),
            ])}
          />
        </div>
        {topRecolectores.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">Sin recolectores registrados.</p>
        ) : (
          <ul className="mt-3">
            {topRecolectores.map((r, i) => (
              <li
                key={r.persona_id.toString()}
                className={`flex items-center gap-2.5 py-2 text-sm ${
                  i > 0 ? 'border-t border-zelanda-beige-200' : ''
                }`}
              >
                <span className="w-5 text-center font-serif text-[14px] text-zelanda-verde-700">
                  {i + 1}
                </span>
                <AvatarIniciales id={String(r.persona_id)} nombre={r.nombre_completo} tamano="sm" />
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-zelanda-verde-900">
                  {r.nombre_completo}
                </span>
                <span className="text-[11.5px] text-zelanda-verde-700">
                  {r.n_cosechas} {r.n_cosechas === 1 ? 'cosecha' : 'cosechas'}
                </span>
                <span className="min-w-[60px] text-right font-serif text-[14px] text-zelanda-verde-900">
                  {fmtKg(Number(r.total_kg))}{' '}
                  <span className="text-[10px] text-zelanda-verde-700">kg</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Sección 5: Insumos consumidos (finca) */}
      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-serif text-base text-zelanda-verde-900">Insumos consumidos</h2>
            <p className="mt-0.5 text-[11.5px] text-zelanda-verde-700">
              Suma de despachos cerrados
            </p>
          </div>
          <DescargarCSVButton
            filename={`insumos-consumidos-${hoy}.csv`}
            headers={['Insumo', 'Unidad', 'Total consumido']}
            rows={insumosConsumidos.map((c) => [c.nombre, c.unidad, Number(c.total).toFixed(3)])}
          />
        </div>
        {insumosConsumidos.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">Sin insumos consumidos.</p>
        ) : (
          <ul className="mt-3">
            {insumosConsumidos.map((c, i) => (
              <li
                key={c.insumo_id.toString()}
                className={`flex items-center justify-between gap-2 py-2 text-[13px] ${
                  i > 0 ? 'border-t border-zelanda-beige-200' : ''
                }`}
              >
                <span className="truncate text-zelanda-verde-900">{c.nombre}</span>
                <span className="font-serif text-zelanda-verde-900">
                  {Number(c.total).toLocaleString('es-CO', {
                    maximumFractionDigits: 3,
                  })}{' '}
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
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-serif text-base text-zelanda-verde-900">Apicultura — miel</h2>
              <p className="mt-0.5 text-[11.5px] text-zelanda-verde-700">
                {fmtKg(totalMielKg)} kg en {mielTotal._count._all}{' '}
                {mielTotal._count._all === 1 ? 'cosecha' : 'cosechas'}
              </p>
            </div>
          </div>

          {rankingApiarios.length > 0 ? (
            <div className="mt-4">
              <div className="flex items-start justify-between gap-2">
                <Eyebrow>Por apiario</Eyebrow>
                <DescargarCSVButton
                  filename={`miel-por-apiario-${hoy}.csv`}
                  headers={['Apiario', 'Total kg']}
                  rows={rankingApiarios.map((a) => [a.nombre, Number(a.total_kg).toFixed(2)])}
                />
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                {rankingApiarios.map((a) => (
                  <div
                    key={a.nombre}
                    className="flex items-center gap-2.5 rounded-[10px] border border-zelanda-ocre-200 bg-zelanda-ocre-50 px-3 py-2"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-zelanda-ocre-200 text-zelanda-ocre-700">
                      <Hexagon className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex-1 truncate font-serif text-[14px] text-zelanda-verde-900">
                      Apiario {a.nombre}
                    </span>
                    <span className="font-serif text-[15px] text-zelanda-verde-900">
                      {fmtKg(Number(a.total_kg))}{' '}
                      <span className="text-[10px] text-zelanda-verde-700">kg</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {topRecolectoresMiel.length > 0 ? (
            <div className="mt-4">
              <div className="flex items-start justify-between gap-2">
                <Eyebrow>Top recolectores de miel</Eyebrow>
                <DescargarCSVButton
                  filename={`top-recolectores-miel-${hoy}.csv`}
                  headers={['Persona', 'Total kg']}
                  rows={topRecolectoresMiel.map((r) => [
                    r.nombre_completo,
                    Number(r.total_kg).toFixed(2),
                  ])}
                />
              </div>
              <ul className="mt-2">
                {topRecolectoresMiel.map((r, i) => (
                  <li
                    key={r.persona_id.toString()}
                    className={`flex items-center gap-2.5 py-2 text-sm ${
                      i > 0 ? 'border-t border-zelanda-beige-200' : ''
                    }`}
                  >
                    <span className="w-5 text-center font-serif text-[14px] text-zelanda-verde-700">
                      {i + 1}
                    </span>
                    <AvatarIniciales
                      id={String(r.persona_id)}
                      nombre={r.nombre_completo}
                      tamano="sm"
                    />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-zelanda-verde-900">
                      {r.nombre_completo}
                    </span>
                    <span className="font-serif text-[14px] text-zelanda-verde-900">
                      {fmtKg(Number(r.total_kg))}{' '}
                      <span className="text-[10px] text-zelanda-verde-700">kg</span>
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
          <div>
            <h2 className="font-serif text-base text-zelanda-verde-900">Salidas del almacén</h2>
            <p className="mt-0.5 text-[11.5px] text-zelanda-verde-700">
              {fmtKg(totalSalidas12m)} kg en los últimos 12 meses
            </p>
          </div>
          <DescargarCSVButton
            filename={`salidas-12m-${hoy}.csv`}
            headers={['Tipo', 'Total kg', 'Salidas']}
            rows={salidasPorTipo.map((s) => [s.tipo, Number(s.total_kg).toFixed(2), s.n_salidas])}
          />
        </div>
        {salidasPorTipo.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">
            Sin salidas registradas en los últimos 12 meses.
          </p>
        ) : (
          <ul className="mt-3">
            {salidasPorTipo.map((s, i) => {
              const kg = Number(s.total_kg);
              const pctTotal = totalSalidas12m > 0 ? (kg / totalSalidas12m) * 100 : 0;
              const color =
                s.tipo === 'PERDIDA'
                  ? 'text-estado-vencida'
                  : s.tipo === 'VENTA'
                  ? 'text-zelanda-ocre-700'
                  : 'text-zelanda-verde-700';
              return (
                <li
                  key={s.tipo}
                  className={`flex items-center justify-between gap-2 py-2 text-sm ${
                    i > 0 ? 'border-t border-zelanda-beige-200' : ''
                  }`}
                >
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.04em] ${
                      TONO_TIPO_SALIDA[s.tipo] ?? ''
                    }`}
                  >
                    {s.tipo}
                  </span>
                  <span className="text-[11.5px] text-zelanda-verde-700">
                    {s.n_salidas} mov · {pctTotal.toFixed(1)}%
                  </span>
                  <span className={`min-w-[68px] text-right font-serif text-[14px] ${color}`}>
                    {fmtKg(kg)} <span className="text-[10px] text-zelanda-verde-700">kg</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
