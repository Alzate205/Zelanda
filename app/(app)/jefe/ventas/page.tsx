import Link from 'next/link';
import { ChevronLeft, ChevronRight, TrendingUp, Package } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { KPI } from '@/components/ui/KPI';
import { mesBogota, periodoMesBogota } from '@/lib/fecha';
import { resumenVentas } from '@/lib/comercio';

export const metadata = { title: 'Ventas' };
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

function fmtFecha(d: Date): string {
  // salidas_cosecha.fecha es TIMESTAMPTZ; convertir a Bogotá para mostrar.
  return d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    timeZone: 'America/Bogota',
  });
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

export default async function PaginaVentas({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  await requerirUsuario('JEFE');

  const sp = await searchParams;
  const { anio, mes } = parsearMes(sp.mes);
  // salidas_cosecha.fecha es TIMESTAMPTZ: usar límites en hora Bogotá para no perder ventas nocturnas.
  const { desde, hasta } = periodoMesBogota(anio, mes);

  const ventas = await prisma.salidas_cosecha.findMany({
    where: {
      tipo: 'VENTA',
      fecha: { gte: desde, lte: hasta },
    },
    orderBy: { fecha: 'desc' },
    include: {
      clientes: { select: { id: true, nombre: true } },
    },
  });

  const { totalKg, totalIngreso, ticketPromedio, precioPromedioKg } = resumenVentas(
    ventas.map((v) => ({
      cantidad_kg: Number(v.cantidad_kg),
      precio_total: v.precio_total == null ? null : Number(v.precio_total),
    }))
  );

  // Ingresos por cliente del periodo
  const ingresosPorCliente = new Map<
    string,
    { nombre: string; clienteId: string | null; kg: number; ingreso: number }
  >();
  for (const v of ventas) {
    const key = v.clientes ? String(v.clientes.id) : v.cliente_detalle ?? '(sin cliente)';
    const nombre = v.clientes ? v.clientes.nombre : v.cliente_detalle ?? '(sin cliente)';
    const prev = ingresosPorCliente.get(key) ?? {
      nombre,
      clienteId: v.clientes ? String(v.clientes.id) : null,
      kg: 0,
      ingreso: 0,
    };
    prev.kg += Number(v.cantidad_kg);
    prev.ingreso += Number(v.precio_total ?? 0);
    ingresosPorCliente.set(key, prev);
  }
  const rankingClientes = Array.from(ingresosPorCliente.values()).sort(
    (a, b) => b.ingreso - a.ingreso
  );

  const mesAnterior = mes === 0 ? aClaveMes(anio - 1, 11) : aClaveMes(anio, mes - 1);
  const mesSiguiente = mes === 11 ? aClaveMes(anio + 1, 0) : aClaveMes(anio, mes + 1);

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
        <Eyebrow>Negocio · Ventas</Eyebrow>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Ingresos por cosecha</h1>
      </header>

      <div className="flex items-center justify-between rounded-xl border border-zelanda-beige-200 bg-white p-3 shadow-suave">
        <Link
          href={`/jefe/ventas?mes=${mesAnterior}`}
          className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 px-3 text-[13px] font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
        >
          <ChevronLeft className="h-4 w-4" /> Ant
        </Link>
        <div className="text-center">
          <p className="font-serif text-[16px] text-zelanda-verde-900">
            {MESES[mes]} {anio}
          </p>
          <p className="text-[11px] text-zelanda-verde-700">
            {ventas.length} {ventas.length === 1 ? 'venta' : 'ventas'}
          </p>
        </div>
        <Link
          href={`/jefe/ventas?mes=${mesSiguiente}`}
          className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-zelanda-beige-300 bg-zelanda-beige-100 px-3 text-[13px] font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200"
        >
          Sig <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <KPI
          etiqueta="Ingresos"
          valor={fmtMonto(totalIngreso)}
          pie={`${ventas.length} ventas`}
          acento="ocre"
        />
        <KPI
          etiqueta="Kg vendidos"
          valor={totalKg.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
          pie={precioPromedioKg > 0 ? `${fmtMonto(precioPromedioKg)} / kg` : '—'}
        />
        <KPI
          etiqueta="Ticket promedio"
          valor={fmtMonto(ticketPromedio)}
          pie={ventas.length > 0 ? `${ventas.length} operaciones` : '—'}
        />
        <KPI etiqueta="Clientes" valor={rankingClientes.length} pie="distintos en el mes" />
      </div>

      {rankingClientes.length > 0 ? (
        <section>
          <h2 className="mb-2 font-serif text-base text-zelanda-verde-900">Por cliente</h2>
          <ul className="space-y-2">
            {rankingClientes.map((r, i) => {
              const Wrapper = r.clienteId
                ? Link
                : (props: { children: React.ReactNode; className?: string }) => (
                    <div className={props.className}>{props.children}</div>
                  );
              return (
                <li key={i}>
                  <Wrapper
                    href={r.clienteId ? `/jefe/clientes/${r.clienteId}/editar` : '#'}
                    className="block rounded-xl border border-zelanda-beige-200 bg-white p-3 shadow-suave transition hover:border-zelanda-verde-400"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-serif text-[14.5px] text-zelanda-verde-900">{r.nombre}</p>
                      <span className="font-serif text-[15px] text-zelanda-verde-900">
                        {fmtMonto(r.ingreso)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-zelanda-verde-700">
                      {r.kg.toLocaleString('es-CO', { maximumFractionDigits: 0 })} kg
                    </p>
                  </Wrapper>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 font-serif text-base text-zelanda-verde-900">Ventas del mes</h2>
        {ventas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center">
            <TrendingUp className="mx-auto h-8 w-8 text-zelanda-verde-700/40" />
            <p className="mt-3 font-serif text-base text-zelanda-verde-900">Sin ventas este mes</p>
            <p className="mt-1 text-sm text-zelanda-verde-700">
              Las ventas se registran desde Almacén → Salidas → tipo Venta.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {ventas.map((v) => (
              <li
                key={String(v.id)}
                className="rounded-xl border border-zelanda-beige-200 bg-white p-3.5 shadow-suave"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-[14.5px] text-zelanda-verde-900">
                      {v.clientes ? v.clientes.nombre : v.cliente_detalle ?? '(sin cliente)'}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[12px] text-zelanda-verde-700">
                      <Package className="h-3 w-3" />
                      {Number(v.cantidad_kg).toLocaleString('es-CO', {
                        maximumFractionDigits: 1,
                      })}{' '}
                      kg · {fmtFecha(v.fecha)}
                    </p>
                  </div>
                  <span className="font-serif text-[16px] text-zelanda-verde-900">
                    {fmtMonto(Number(v.precio_total ?? 0))}
                  </span>
                </div>
                {v.notas ? (
                  <p className="mt-1.5 text-[11.5px] text-zelanda-verde-700">{v.notas}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
