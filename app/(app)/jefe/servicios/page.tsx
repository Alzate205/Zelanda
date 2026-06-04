import Link from 'next/link';
import { Plus, Briefcase, ChevronLeft, ChevronRight } from 'lucide-react';
import { requerirUsuario } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';

export const metadata = { title: 'Servicios contratados' };

const ETIQUETA_ESTADO: Record<string, string> = {
  ACUERDO: 'Acuerdo',
  EN_CURSO: 'En curso',
  TERMINADO: 'Terminado',
  CANCELADO: 'Cancelado',
};

const ESTADO_BADGE: Record<string, 'aldia' | 'proxima' | 'vencida' | 'neutro'> = {
  ACUERDO: 'proxima',
  EN_CURSO: 'aldia',
  TERMINADO: 'neutro',
  CANCELADO: 'vencida',
};

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
    year: '2-digit',
  });
}

export default async function PaginaServicios() {
  await requerirUsuario('JEFE');

  const servicios = await prisma.servicios_contratados.findMany({
    where: { borrado_en: null },
    orderBy: [{ estado: 'asc' }, { fecha_inicio: 'desc' }],
    include: {
      persona: { select: { nombre_completo: true } },
      lotes: { select: { nombre: true } },
      pagos: { select: { monto: true } },
    },
    take: 200,
  });

  const abiertos = servicios.filter((s) => s.estado === 'ACUERDO' || s.estado === 'EN_CURSO');
  const cerrados = servicios.filter((s) => s.estado === 'TERMINADO' || s.estado === 'CANCELADO');

  function fila(s: (typeof servicios)[number]) {
    const pactado = Number(s.monto_pactado);
    const pagado = s.pagos.reduce((acc, p) => acc + Number(p.monto), 0);
    const saldo = pactado - pagado;
    const estado = ESTADO_BADGE[s.estado] ?? 'neutro';
    return (
      <li key={String(s.id)}>
        <Link
          href={`/jefe/servicios/${s.id}`}
          className="block rounded-xl border border-zelanda-beige-200 bg-white p-3.5 shadow-suave transition hover:border-zelanda-verde-400"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="m-0 font-serif text-[15px] text-zelanda-verde-900">{s.descripcion}</p>
              <p className="m-0 mt-0.5 text-[12.5px] text-zelanda-verde-700">
                {s.persona.nombre_completo}
                {s.lotes ? ` · Lote ${s.lotes.nombre}` : ''}
              </p>
            </div>
            <Badge estado={estado}>{ETIQUETA_ESTADO[s.estado] ?? s.estado}</Badge>
          </div>

          <div className="mt-2 flex items-baseline justify-between gap-2">
            <div>
              <span className="font-serif text-[20px] text-zelanda-verde-900">
                {fmtMonto(pactado)}
              </span>
              <span className="ml-1.5 text-[11.5px] text-zelanda-verde-700">pactado</span>
            </div>
            <span className="text-[11.5px] text-zelanda-verde-700">
              {fmtFecha(s.fecha_inicio)}
              {s.fecha_fin ? ` → ${fmtFecha(s.fecha_fin)}` : ' → en curso'}
            </span>
          </div>

          {s.pagos.length > 0 ? (
            <div className="mt-2 flex items-center justify-between rounded-[8px] bg-zelanda-beige-100 px-2.5 py-1.5 text-[11.5px]">
              <span className="text-zelanda-verde-800">Pagado: {fmtMonto(pagado)}</span>
              <span
                className={`font-semibold ${
                  saldo > 0
                    ? 'text-zelanda-verde-900'
                    : saldo === 0
                    ? 'text-estado-aldia'
                    : 'text-estado-vencida'
                }`}
              >
                {saldo > 0
                  ? `Falta ${fmtMonto(saldo)}`
                  : saldo === 0
                  ? 'Saldado'
                  : `Sobrepagado ${fmtMonto(Math.abs(saldo))}`}
              </span>
            </div>
          ) : null}

          <div className="mt-2 flex items-center justify-end text-[11px] text-zelanda-verde-700">
            Ver detalle <ChevronRight className="ml-0.5 h-3 w-3" />
          </div>
        </Link>
      </li>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href="/jefe"
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-zelanda-verde-700 hover:text-zelanda-verde-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Inicio
      </Link>

      <header className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>Finanzas · Contratos</Eyebrow>
          <h1 className="mt-1 font-serif text-2xl text-zelanda-verde-900">Servicios contratados</h1>
          <p className="mt-0.5 text-[13px] text-zelanda-verde-700">
            {abiertos.length} abiertos · {cerrados.length} cerrados
          </p>
        </div>
        <Link
          href="/jefe/servicios/nuevo"
          className="inline-flex min-h-touch items-center gap-1.5 rounded-xl bg-zelanda-verde-700 px-3.5 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
        >
          <Plus className="h-4 w-4" /> Nuevo
        </Link>
      </header>

      {servicios.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center">
          <Briefcase className="mx-auto h-8 w-8 text-zelanda-verde-700/40" />
          <p className="mt-3 font-serif text-base text-zelanda-verde-900">
            Sin servicios contratados
          </p>
          <p className="mt-1 text-sm text-zelanda-verde-700">
            Acá vas a llevar los contratos puntuales con contratistas: arreglar un puente, levantar
            una cerca, podar un sector. Cada uno con su monto pactado y pagos parciales.
          </p>
          <Link
            href="/jefe/servicios/nuevo"
            className="mt-4 inline-flex min-h-touch items-center gap-1.5 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
          >
            <Plus className="h-4 w-4" /> Registrar primer servicio
          </Link>
        </div>
      ) : (
        <>
          {abiertos.length > 0 ? (
            <section>
              <h2 className="mb-2 font-serif text-base text-zelanda-verde-900">
                Abiertos{' '}
                <span className="text-sm font-normal text-zelanda-verde-700">
                  ({abiertos.length})
                </span>
              </h2>
              <ul className="space-y-2">{abiertos.map((s) => fila(s))}</ul>
            </section>
          ) : null}
          {cerrados.length > 0 ? (
            <section>
              <h2 className="mb-2 font-serif text-base text-zelanda-verde-900">
                Cerrados{' '}
                <span className="text-sm font-normal text-zelanda-verde-700">
                  ({cerrados.length})
                </span>
              </h2>
              <ul className="space-y-2">{cerrados.map((s) => fila(s))}</ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
