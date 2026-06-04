import Link from 'next/link';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { KPI } from '@/components/ui/KPI';
import { mesBogota, periodoMesBogota } from '@/lib/fecha';

export const metadata = { title: 'Reportes avanzados' };
const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const MESES_CORTO = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

function fmtMonto(n: number): string {
  return n.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

function fmtKg(n: number): string {
  return n.toLocaleString('es-CO', { maximumFractionDigits: 0 });
}

function parsearMes(raw: string | undefined): { anio: number; mes: number } {
  if (!raw || !/^\d{4}-\d{2}$/.test(raw)) {
    return mesBogota();
  }
  const [a, m] = raw.split('-');
  return { anio: Number(a), mes: Number(m) - 1 };
}

function aClaveMes(anio: number, mes: number): string {
  return `${anio}-${String(mes + 1).padStart(2, '0')}`;
}

export default async function PaginaReportesAvanzados({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  await requerirUsuario('JEFE');

  const sp = await searchParams;
  const { anio, mes } = parsearMes(sp.mes);
  // ventas usan TIMESTAMPTZ: necesitan límites Bogotá; compras/pagos usan DATE: Date.UTC es suficiente.
  const { desde: desdeTZ, hasta: hastaTZ } = periodoMesBogota(anio, mes);
  const desdeDate = new Date(Date.UTC(anio, mes, 1));
  const hastaDate = new Date(Date.UTC(anio, mes + 1, 1) - 1);

  const [
    ventasMes,
    comprasMes,
    pagosMes,
    cosechaActual,
    cosechaAnterior,
    rankingLotes,
    cosechasAnio,
  ] = await Promise.all([
    // Ingresos del mes (ventas con precio_total)
    prisma.salidas_cosecha.aggregate({
      where: {
        tipo: 'VENTA',
        fecha: { gte: desdeTZ, lte: hastaTZ },
      },
      _sum: { precio_total: true, cantidad_kg: true },
      _count: { _all: true },
    }),
    // Costos de compras del mes
    prisma.compras.aggregate({
      where: { fecha: { gte: desdeDate, lte: hastaDate } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    // Costos de pagos a personas del mes
    prisma.pagos.aggregate({
      where: { fecha: { gte: desdeDate, lte: hastaDate } },
      _sum: { monto: true },
      _count: { _all: true },
    }),
    // Cosecha año actual (mes a mes)
    prisma.$queryRaw<{ m: number; total_kg: string }[]>`
      SELECT
        EXTRACT(MONTH FROM fecha)::int AS m,
        SUM(peso_kg)::text             AS total_kg
      FROM cosechas
      WHERE EXTRACT(YEAR FROM fecha)::int = ${anio}
      GROUP BY m
      ORDER BY m
    `,
    // Cosecha año anterior (mes a mes)
    prisma.$queryRaw<{ m: number; total_kg: string }[]>`
      SELECT
        EXTRACT(MONTH FROM fecha)::int AS m,
        SUM(peso_kg)::text             AS total_kg
      FROM cosechas
      WHERE EXTRACT(YEAR FROM fecha)::int = ${anio - 1}
      GROUP BY m
      ORDER BY m
    `,
    // Ranking lotes por productividad
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
        l.hectareas::text                  AS hectareas,
        COALESCE(SUM(c.peso_kg), 0)::text  AS kg_total
      FROM lotes l
      LEFT JOIN cosechas c ON c.lote_id = l.id
      WHERE l.deleted_at IS NULL
      GROUP BY l.id, l.nombre, l.total_arboles, l.hectareas
    `,
    // Cosecha por año (todos los años)
    prisma.$queryRaw<{ y: number; total_kg: string }[]>`
      SELECT
        EXTRACT(YEAR FROM fecha)::int AS y,
        SUM(peso_kg)::text            AS total_kg
      FROM cosechas
      GROUP BY y
      ORDER BY y
    `,
  ]);

  // Financiero del mes
  const ingresos = Number(ventasMes._sum.precio_total ?? 0);
  const kgVendidos = Number(ventasMes._sum.cantidad_kg ?? 0);
  const costoCompras = Number(comprasMes._sum.total ?? 0);
  const costoPagos = Number(pagosMes._sum.monto ?? 0);
  const costosTotal = costoCompras + costoPagos;
  const margen = ingresos - costosTotal;
  const margenPct = ingresos > 0 ? (margen / ingresos) * 100 : 0;

  // Cosecha comparativa: mapas año actual y anterior
  const mapaActual = new Map<number, number>();
  for (const r of cosechaActual) mapaActual.set(r.m, Number(r.total_kg));
  const mapaAnterior = new Map<number, number>();
  for (const r of cosechaAnterior) mapaAnterior.set(r.m, Number(r.total_kg));
  const maxComparativo = Math.max(
    ...Array.from(mapaActual.values()),
    ...Array.from(mapaAnterior.values()),
    1
  );
  const totalActual = Array.from(mapaActual.values()).reduce((a, b) => a + b, 0);
  const totalAnterior = Array.from(mapaAnterior.values()).reduce((a, b) => a + b, 0);
  const variacionAnual =
    totalAnterior > 0 ? ((totalActual - totalAnterior) / totalAnterior) * 100 : null;

  // Productividad por lote
  const productividad = rankingLotes
    .map((l) => {
      const kg = Number(l.kg_total);
      const hect = l.hectareas ? Number(l.hectareas) : 0;
      const arb = l.total_arboles;
      return {
        id: String(l.id),
        nombre: l.nombre,
        kg_total: kg,
        hectareas: hect,
        arboles: arb,
        kg_por_arbol: arb > 0 ? kg / arb : 0,
        kg_por_ha: hect > 0 ? kg / hect : 0,
      };
    })
    .filter((l) => l.kg_total > 0)
    .sort((a, b) => b.kg_por_ha - a.kg_por_ha);

  const maxKgHa = productividad.reduce((m, l) => Math.max(m, l.kg_por_ha), 0);

  // Cosecha anual
  const totalesAnio = cosechasAnio.map((r) => ({
    anio: r.y,
    kg: Number(r.total_kg),
  }));
  const maxAnio = totalesAnio.reduce((m, r) => Math.max(m, r.kg), 0);

  const mesAnterior = mes === 0 ? aClaveMes(anio - 1, 11) : aClaveMes(anio, mes - 1);
  const mesSiguiente = mes === 11 ? aClaveMes(anio + 1, 0) : aClaveMes(anio, mes + 1);

  return (
    <div className="space-y-5">
      <Link
        href="/jefe/reportes"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Reportes
      </Link>

      <header>
        <Eyebrow>Jefe · Reportes avanzados</Eyebrow>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Análisis financiero y productividad
        </h1>
      </header>

      {/* Sección 1: Resumen financiero del mes */}
      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-base text-zelanda-verde-900">Resumen financiero</h2>
          <div className="flex items-center gap-1">
            <Link
              href={`/jefe/reportes/avanzados?mes=${mesAnterior}`}
              className="inline-flex h-8 items-center gap-1 rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 px-2 text-[12px] font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
            >
              <ChevronLeft className="h-3 w-3" />
            </Link>
            <span className="px-2 font-serif text-[14px] text-zelanda-verde-900">
              {MESES[mes]} {anio}
            </span>
            <Link
              href={`/jefe/reportes/avanzados?mes=${mesSiguiente}`}
              className="inline-flex h-8 items-center gap-1 rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 px-2 text-[12px] font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
            >
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <KPI
            etiqueta="Ingresos"
            valor={fmtMonto(ingresos)}
            pie={`${ventasMes._count._all} ventas · ${fmtKg(kgVendidos)} kg`}
            acento="ocre"
          />
          <KPI
            etiqueta="Costos"
            valor={fmtMonto(costosTotal)}
            pie={`${comprasMes._count._all} compras · ${pagosMes._count._all} pagos`}
          />
          <KPI
            etiqueta="Margen"
            valor={fmtMonto(margen)}
            pie={
              ingresos > 0 ? `${margenPct >= 0 ? '+' : ''}${margenPct.toFixed(1)}%` : 'sin ventas'
            }
            acento={margen >= 0 ? 'ocre' : undefined}
          />
        </div>

        <div className="mt-4 space-y-2 rounded-[10px] bg-zelanda-beige-50 p-3 text-[12.5px] tabular-nums">
          <div className="flex justify-between gap-2 text-zelanda-verde-800">
            <span>Ventas</span>
            <span className="font-semibold">{fmtMonto(ingresos)}</span>
          </div>
          <div className="flex justify-between gap-2 text-zelanda-verde-800">
            <span>− Compras de insumos</span>
            <span className="font-semibold">{fmtMonto(costoCompras)}</span>
          </div>
          <div className="flex justify-between gap-2 text-zelanda-verde-800">
            <span>− Pagos a personas</span>
            <span className="font-semibold">{fmtMonto(costoPagos)}</span>
          </div>
          <div className="flex justify-between border-t border-zelanda-beige-300 pt-2 font-serif text-[14px]">
            <span className="text-zelanda-verde-900">Margen del mes</span>
            <span className={margen >= 0 ? 'text-zelanda-verde-900' : 'text-estado-vencida'}>
              {fmtMonto(margen)}
            </span>
          </div>
        </div>

        <p className="mt-2 text-[11px] text-zelanda-verde-700/70">
          Margen aproximado. Ventas: salidas tipo VENTA con precio. Costos: compras de insumos +
          suma de todos los pagos a personas (salarios, jornales, servicios, bonos, adelantos,
          ajustes).
        </p>
      </section>

      {/* Sección 2: Comparativo cosecha año vs anterior */}
      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-serif text-base text-zelanda-verde-900">
              Cosecha {anio} vs {anio - 1}
            </h2>
            <p className="mt-0.5 text-[11.5px] text-zelanda-verde-700">
              {fmtKg(totalActual)} kg en {anio} ·{' '}
              {variacionAnual !== null
                ? `${variacionAnual >= 0 ? '+' : ''}${variacionAnual.toFixed(1)}% vs ${anio - 1}`
                : `sin datos en ${anio - 1}`}
            </p>
          </div>
          {variacionAnual !== null ? (
            <div
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${
                variacionAnual >= 0
                  ? 'bg-zelanda-verde-50 text-zelanda-verde-800'
                  : 'bg-estado-vencida/10 text-estado-vencida'
              }`}
            >
              {variacionAnual >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {variacionAnual >= 0 ? '+' : ''}
              {variacionAnual.toFixed(1)}%
            </div>
          ) : null}
        </div>

        <div
          className="mt-4 grid items-end gap-1.5"
          style={{
            gridTemplateColumns: `repeat(12, 1fr)`,
            height: '120px',
          }}
        >
          {MESES_CORTO.map((_, i) => {
            const m = i + 1;
            const actual = mapaActual.get(m) ?? 0;
            const anterior = mapaAnterior.get(m) ?? 0;
            const hActual = maxComparativo > 0 ? Math.round((actual / maxComparativo) * 100) : 0;
            const hAnterior =
              maxComparativo > 0 ? Math.round((anterior / maxComparativo) * 100) : 0;
            return (
              <div
                key={m}
                className="flex flex-col items-stretch justify-end gap-0.5"
                title={`${MESES_CORTO[i]} · ${anio}: ${fmtKg(actual)} kg · ${anio - 1}: ${fmtKg(
                  anterior
                )} kg`}
              >
                <div className="flex h-full items-end gap-0.5">
                  <div
                    className="w-1/2 rounded-t-[2px] bg-zelanda-beige-300"
                    style={{ height: `${hAnterior}%` }}
                  />
                  <div
                    className="w-1/2 rounded-t-[2px] bg-zelanda-verde-600"
                    style={{ height: `${hActual}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div
          className="mt-1.5 grid gap-1.5 text-center text-[9px] text-zelanda-verde-700"
          style={{ gridTemplateColumns: `repeat(12, 1fr)` }}
        >
          {MESES_CORTO.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>

        <div className="mt-3 flex justify-end gap-3 text-[11px] text-zelanda-verde-700">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-zelanda-beige-300" />
            {anio - 1}: {fmtKg(totalAnterior)} kg
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-zelanda-verde-600" />
            {anio}: {fmtKg(totalActual)} kg
          </span>
        </div>
      </section>

      {/* Sección 3: Productividad por lote */}
      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <h2 className="font-serif text-base text-zelanda-verde-900">Productividad por lote</h2>
        <p className="mt-0.5 text-[11.5px] text-zelanda-verde-700">
          kg cosechados por hectárea · todos los tiempos
        </p>

        {productividad.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">Aún no hay cosechas registradas.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {productividad.slice(0, 10).map((l, i) => {
              const pct = maxKgHa > 0 ? (l.kg_por_ha / maxKgHa) * 100 : 0;
              return (
                <li key={l.id}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="font-serif text-[13.5px] text-zelanda-verde-900">
                      <span className="mr-1.5 text-zelanda-verde-700">{i + 1}.</span>
                      {l.nombre}
                    </span>
                    <span className="text-[11.5px] text-zelanda-verde-700">
                      <strong className="text-zelanda-verde-900">{fmtKg(l.kg_por_ha)}</strong> kg/ha
                      · {l.kg_por_arbol.toFixed(1)} kg/árbol
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zelanda-beige-200">
                    <div
                      className="h-full rounded-full bg-zelanda-verde-600"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-[10.5px] text-zelanda-verde-700/80">
                    {fmtKg(l.kg_total)} kg ·{' '}
                    {l.hectareas > 0 ? `${l.hectareas} ha` : 'sin hectáreas'} · {l.arboles} árboles
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Sección 4: Cosecha por año (tendencia larga) */}
      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-serif text-base text-zelanda-verde-900">Cosecha anual</h2>
            <p className="mt-0.5 text-[11.5px] text-zelanda-verde-700">
              Tendencia histórica · {totalesAnio.length} {totalesAnio.length === 1 ? 'año' : 'años'}
            </p>
          </div>
          <Wallet className="h-5 w-5 text-zelanda-verde-700/40" />
        </div>

        {totalesAnio.length === 0 ? (
          <p className="mt-3 text-sm text-zelanda-verde-700/70">Aún no hay cosechas registradas.</p>
        ) : (
          <>
            <div
              className="mt-4 grid items-end gap-2"
              style={{
                gridTemplateColumns: `repeat(${totalesAnio.length}, 1fr)`,
                height: '120px',
              }}
            >
              {totalesAnio.map((r) => {
                const altura = maxAnio > 0 ? (r.kg / maxAnio) * 100 : 0;
                return (
                  <div
                    key={r.anio}
                    className="flex flex-col items-center justify-end"
                    title={`${r.anio}: ${fmtKg(r.kg)} kg`}
                  >
                    <div
                      className="w-full rounded-t-[4px] bg-zelanda-ocre-500"
                      style={{ height: `${altura}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div
              className="mt-1.5 grid gap-2 text-center text-[10.5px] text-zelanda-verde-700"
              style={{
                gridTemplateColumns: `repeat(${totalesAnio.length}, 1fr)`,
              }}
            >
              {totalesAnio.map((r) => (
                <span key={r.anio}>{r.anio}</span>
              ))}
            </div>
            <div
              className="mt-0.5 grid gap-2 text-center text-[10px] text-zelanda-verde-700/80"
              style={{
                gridTemplateColumns: `repeat(${totalesAnio.length}, 1fr)`,
              }}
            >
              {totalesAnio.map((r) => (
                <span key={r.anio}>{(r.kg / 1000).toFixed(1)} t</span>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
