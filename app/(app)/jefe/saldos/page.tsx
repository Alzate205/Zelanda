import Link from 'next/link';
import { ChevronLeft, ChevronRight, ShoppingCart, TrendingUp, Wallet } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { KPI } from '@/components/ui/KPI';
import { formatearFechaDateCorta, mesBogota, periodoMesBogota } from '@/lib/fecha';
import { formatearCantidad } from '@/lib/formatos';

/**
 * Saldos = la caja de la finca: lo que entró por venta de aguacate menos lo que
 * salió en compras (insumos y herramientas). Antes era el saldo de nómina por
 * persona; ese módulo está apagado (lib/modulos.ts) y su pantalla de detalle
 * responde 404.
 */
export const metadata = { title: 'Saldos' };

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

function fmtMonto(n: number): string {
  return n.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

function fmtFechaTZ(d: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    timeZone: 'America/Bogota',
  }).format(d);
}

function parsearMes(raw: string | undefined): { anio: number; mes: number } {
  if (!raw || !/^\d{4}-\d{2}$/.test(raw)) return mesBogota();
  const [a, m] = raw.split('-');
  const mes = Number(m) - 1;
  if (mes < 0 || mes > 11) return mesBogota();
  return { anio: Number(a), mes };
}

function aClaveMes(anio: number, mes: number): string {
  return `${anio}-${String(mes + 1).padStart(2, '0')}`;
}

export default async function PaginaSaldos({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  await requerirUsuario('JEFE');

  const sp = await searchParams;
  const { anio, mes } = parsearMes(sp.mes);

  // salidas_cosecha.fecha es TIMESTAMPTZ (límites en hora de Bogotá);
  // compras.fecha es DATE (alcanza con medianoche UTC).
  const { desde: desdeTZ, hasta: hastaTZ } = periodoMesBogota(anio, mes);
  const { desde: inicioAnioTZ } = periodoMesBogota(anio, 0);
  const desdeDate = new Date(Date.UTC(anio, mes, 1));
  const hastaDate = new Date(Date.UTC(anio, mes + 1, 1) - 1);
  const inicioAnioDate = new Date(Date.UTC(anio, 0, 1));

  const [ventas, compras, ventasAnio, comprasAnio] = await Promise.all([
    prisma.salidas_cosecha.findMany({
      where: { tipo: 'VENTA', fecha: { gte: desdeTZ, lte: hastaTZ } },
      include: { clientes: { select: { nombre: true } } },
      orderBy: { fecha: 'desc' },
    }),
    prisma.compras.findMany({
      where: { borrado_en: null, fecha: { gte: desdeDate, lte: hastaDate } },
      include: {
        proveedor: { select: { nombre: true } },
        items: {
          select: {
            insumo: { select: { nombre: true } },
            herramienta: { select: { nombre: true } },
          },
        },
      },
      orderBy: { fecha: 'desc' },
    }),
    prisma.salidas_cosecha.aggregate({
      where: { tipo: 'VENTA', fecha: { gte: inicioAnioTZ, lte: hastaTZ } },
      _sum: { precio_total: true },
    }),
    prisma.compras.aggregate({
      where: { borrado_en: null, fecha: { gte: inicioAnioDate, lte: hastaDate } },
      _sum: { total: true },
    }),
  ]);

  const ingresos = ventas.reduce((acc, v) => acc + Number(v.precio_total ?? 0), 0);
  const kgVendidos = ventas.reduce((acc, v) => acc + Number(v.cantidad_kg), 0);
  const egresos = compras.reduce((acc, c) => acc + Number(c.total), 0);
  const balance = ingresos - egresos;

  const ingresosAnio = Number(ventasAnio._sum.precio_total ?? 0);
  const egresosAnio = Number(comprasAnio._sum.total ?? 0);
  const balanceAnio = ingresosAnio - egresosAnio;

  const mesAnterior = mes === 0 ? aClaveMes(anio - 1, 11) : aClaveMes(anio, mes - 1);
  const mesSiguiente = mes === 11 ? aClaveMes(anio + 1, 0) : aClaveMes(anio, mes + 1);

  const botonMes =
    'inline-flex h-9 items-center gap-1 rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 px-3 text-[13px] font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200';

  return (
    <div className="space-y-5">
      <Link
        href="/jefe"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Inicio
      </Link>

      <header>
        <Eyebrow>Finanzas · Saldos</Eyebrow>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Entradas y salidas</h1>
        <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
          Venta de aguacate menos compras de la finca.
        </p>
      </header>

      <div className="flex items-center justify-between rounded-xl border border-zelanda-beige-200 bg-white p-3 shadow-suave">
        <Link href={`/jefe/saldos?mes=${mesAnterior}`} className={botonMes}>
          <ChevronLeft className="h-4 w-4" /> Ant
        </Link>
        <p className="font-serif text-[16px] text-zelanda-verde-900">
          {MESES[mes]} {anio}
        </p>
        <Link href={`/jefe/saldos?mes=${mesSiguiente}`} className={botonMes}>
          Sig <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <KPI
          etiqueta="Entró · ventas"
          valor={fmtMonto(ingresos)}
          pie={`${ventas.length} ${ventas.length === 1 ? 'venta' : 'ventas'} · ${formatearCantidad(
            Math.round(kgVendidos)
          )} kg`}
          acento="ocre"
        />
        <KPI
          etiqueta="Salió · compras"
          valor={fmtMonto(egresos)}
          pie={`${compras.length} ${compras.length === 1 ? 'compra' : 'compras'}`}
        />
        <KPI
          etiqueta="Saldo del mes"
          valor={fmtMonto(balance)}
          pie={balance >= 0 ? 'A favor' : 'En contra'}
          acento={balance >= 0 ? 'verde' : 'alerta'}
        />
      </div>

      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-4 shadow-suave">
        <h2 className="font-serif text-base text-zelanda-verde-900">Acumulado {anio}</h2>
        <p className="mt-0.5 text-[11.5px] text-zelanda-verde-700">
          De enero a {MESES[mes].toLowerCase()}
        </p>
        <div className="mt-3 space-y-2 rounded-[10px] bg-zelanda-beige-50 p-3 text-[13px] tabular-nums">
          <div className="flex justify-between gap-2 text-zelanda-verde-800">
            <span>Ventas de aguacate</span>
            <span className="font-semibold">{fmtMonto(ingresosAnio)}</span>
          </div>
          <div className="flex justify-between gap-2 text-zelanda-verde-800">
            <span>− Compras</span>
            <span className="font-semibold">{fmtMonto(egresosAnio)}</span>
          </div>
          <div className="flex justify-between border-t border-zelanda-beige-300 pt-2 font-serif text-[15px]">
            <span className="text-zelanda-verde-900">Saldo</span>
            <span className={balanceAnio >= 0 ? 'text-zelanda-verde-900' : 'text-estado-vencida'}>
              {fmtMonto(balanceAnio)}
            </span>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-base text-zelanda-verde-900">Ventas de aguacate</h2>
          <Link
            href={`/jefe/ventas?mes=${aClaveMes(anio, mes)}`}
            className="text-xs text-zelanda-verde-700 hover:text-zelanda-verde-900"
          >
            Ver ventas
          </Link>
        </div>
        {ventas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-6 text-center">
            <TrendingUp className="mx-auto h-7 w-7 text-zelanda-verde-700/40" />
            <p className="mt-2 text-sm text-zelanda-verde-700">Sin ventas este mes.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {ventas.map((v) => (
              <li
                key={String(v.id)}
                className="flex items-start justify-between gap-3 rounded-xl border border-zelanda-beige-200 bg-white p-3.5 shadow-suave"
              >
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate font-serif text-[15px] text-zelanda-verde-900">
                    {v.clientes?.nombre ?? v.cliente_detalle ?? 'Cliente sin nombre'}
                  </p>
                  <p className="m-0 mt-0.5 text-[12.5px] text-zelanda-verde-700">
                    {fmtFechaTZ(v.fecha)} · {formatearCantidad(Number(v.cantidad_kg))} kg
                  </p>
                </div>
                <span className="shrink-0 text-right text-[14px] font-semibold tabular-nums text-zelanda-verde-900">
                  {v.precio_total !== null ? (
                    `+ ${fmtMonto(Number(v.precio_total))}`
                  ) : (
                    <span className="text-[12px] font-normal text-zelanda-verde-700">
                      Sin precio
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-base text-zelanda-verde-900">Compras</h2>
          <Link
            href={`/jefe/compras?mes=${aClaveMes(anio, mes)}`}
            className="text-xs text-zelanda-verde-700 hover:text-zelanda-verde-900"
          >
            Ver compras
          </Link>
        </div>
        {compras.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-6 text-center">
            <ShoppingCart className="mx-auto h-7 w-7 text-zelanda-verde-700/40" />
            <p className="mt-2 text-sm text-zelanda-verde-700">Sin compras este mes.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {compras.map((c) => {
              const nombres = c.items.map(
                (it) => it.insumo?.nombre ?? it.herramienta?.nombre ?? 'Item'
              );
              const resumen =
                nombres.length <= 2
                  ? nombres.join(', ')
                  : `${nombres.slice(0, 2).join(', ')} y ${nombres.length - 2} más`;
              return (
                <li key={String(c.id)}>
                  <Link
                    href={`/jefe/compras/${c.id}`}
                    className="flex items-start justify-between gap-3 rounded-xl border border-zelanda-beige-200 bg-white p-3.5 shadow-suave transition hover:border-zelanda-verde-400"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate font-serif text-[15px] text-zelanda-verde-900">
                        {c.proveedor?.nombre ?? c.proveedor_detalle ?? 'Proveedor sin nombre'}
                      </p>
                      <p className="m-0 mt-0.5 text-[12.5px] text-zelanda-verde-700">
                        {formatearFechaDateCorta(c.fecha)}
                        {resumen ? ` · ${resumen}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-right text-[14px] font-semibold tabular-nums text-zelanda-verde-900">
                      − {fmtMonto(Number(c.total))}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="flex items-center justify-center gap-1.5 px-2 text-center text-[11px] text-zelanda-verde-700/70">
        <Wallet className="h-3.5 w-3.5" />
        Ventas: salidas de almacén tipo venta. Compras: las registradas en Compras, sin las
        anuladas.
      </p>
    </div>
  );
}
