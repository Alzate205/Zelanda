import Link from 'next/link';
import { ChevronLeft, ChevronRight, FlaskConical } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { DescargarCSVButton } from '@/components/jefe/DescargarCSVButton';
import { mesBogota, periodoMesBogota } from '@/lib/fecha';
import { obtenerAplicaciones } from '@/lib/jefe/aplicaciones';
import { FiltroLote } from './FiltroLote';

export const metadata = { title: 'Aplicaciones' };

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
  return d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    timeZone: 'America/Bogota',
  });
}

function parsearMes(raw: string | undefined): { anio: number; mes: number } {
  if (!raw || !/^\d{4}-\d{2}$/.test(raw)) return mesBogota();
  const [a, m] = raw.split('-');
  return { anio: Number(a), mes: Number(m) - 1 };
}

function aClaveMes(anio: number, mes: number): string {
  return `${anio}-${String(mes + 1).padStart(2, '0')}`;
}

export default async function PaginaAplicaciones({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; lote?: string }>;
}) {
  await requerirUsuario('JEFE');

  const sp = await searchParams;
  const { anio, mes } = parsearMes(sp.mes);
  const { desde, hasta } = periodoMesBogota(anio, mes);
  const loteFiltro = sp.lote && /^\d+$/.test(sp.lote) ? sp.lote : null;

  const [todas, lotes] = await Promise.all([
    obtenerAplicaciones(desde, hasta),
    prisma.lotes.findMany({
      where: { deleted_at: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
  ]);
  const aplicaciones = loteFiltro ? todas.filter((a) => a.lote_id === loteFiltro) : todas;
  const costoTotal = aplicaciones.reduce((acc, a) => acc + a.costo, 0);

  const mesAnterior = mes === 0 ? aClaveMes(anio - 1, 11) : aClaveMes(anio, mes - 1);
  const mesSiguiente = mes === 11 ? aClaveMes(anio + 1, 0) : aClaveMes(anio, mes + 1);
  const claveMes = aClaveMes(anio, mes);
  const conservarLote = loteFiltro ? `&lote=${loteFiltro}` : '';

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
        <Eyebrow>Trazabilidad · Insumos</Eyebrow>
        <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">
          Registro de aplicaciones
        </h1>
        <p className="mt-0.5 text-[12.5px] text-zelanda-verde-700">
          Qué producto se aplicó en qué lote, según los despachos cerrados de bodega.
        </p>
      </header>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Link
            href={`/jefe/aplicaciones?mes=${mesAnterior}${conservarLote}`}
            aria-label="Mes anterior"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zelanda-beige-300 bg-white text-zelanda-verde-800 hover:bg-zelanda-beige-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-[130px] text-center font-serif text-[15px] text-zelanda-verde-900">
            {MESES[mes]} {anio}
          </span>
          <Link
            href={`/jefe/aplicaciones?mes=${mesSiguiente}${conservarLote}`}
            aria-label="Mes siguiente"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zelanda-beige-300 bg-white text-zelanda-verde-800 hover:bg-zelanda-beige-50"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <FiltroLote lotes={lotes.map((l) => ({ id: l.id.toString(), nombre: l.nombre }))} />
      </div>

      <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-serif text-base text-zelanda-verde-900">
              {aplicaciones.length} {aplicaciones.length === 1 ? 'aplicación' : 'aplicaciones'} ·{' '}
              {fmtMonto(costoTotal)}
            </h2>
            <p className="mt-0.5 text-[11.5px] text-zelanda-verde-700">
              Fecha = día del despacho (el día del trabajo)
            </p>
          </div>
          <DescargarCSVButton
            filename={`aplicaciones-${claveMes}.csv`}
            headers={[
              'Fecha',
              'Producto',
              'Cantidad',
              'Unidad',
              'Lote',
              'Aplicó',
              'Tarea',
              'Costo',
            ]}
            // en-CA = YYYY-MM-DD; día de Bogotá para coincidir con la UI y el filtro mensual
            rows={aplicaciones.map((a) => [
              a.fecha.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }),
              a.insumo,
              a.cantidad.toFixed(3),
              a.unidad,
              a.lote ?? 'Sin lote',
              a.persona,
              a.tarea ?? '',
              a.costo.toFixed(0),
            ])}
          />
        </div>

        {aplicaciones.length === 0 ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-zelanda-verde-700/70">
            <FlaskConical className="h-4 w-4" aria-hidden />
            Sin aplicaciones registradas este mes.
          </p>
        ) : (
          <ul className="mt-3 list-none divide-y divide-zelanda-beige-200 p-0">
            {aplicaciones.map((a) => (
              <li key={a.id} className="py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="m-0 text-sm text-zelanda-verde-900">
                    <span className="font-medium">{a.insumo}</span> · {a.cantidad} {a.unidad}
                  </p>
                  <span className="shrink-0 text-sm text-zelanda-verde-800">
                    {fmtMonto(a.costo)}
                  </span>
                </div>
                <p className="m-0 mt-0.5 text-[11.5px] text-zelanda-verde-700">
                  {fmtFecha(a.fecha)} · {a.lote ?? 'Sin lote'} · {a.persona}
                  {a.tarea ? ` · ${a.tarea.toLowerCase()}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
