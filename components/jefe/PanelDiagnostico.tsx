import Link from 'next/link';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, ChevronRight } from 'lucide-react';
import type { Alerta, Severidad } from '@/lib/diagnostico';

const ESTILO: Record<
  Severidad,
  { icono: typeof AlertTriangle; caja: string; punto: string; etiqueta: string }
> = {
  CRITICO: {
    icono: AlertTriangle,
    caja: 'border-red-200 bg-red-50',
    punto: 'text-red-600',
    etiqueta: 'Crítico',
  },
  ALERTA: {
    icono: AlertCircle,
    caja: 'border-zelanda-ocre-200 bg-zelanda-ocre-50',
    punto: 'text-zelanda-ocre-600',
    etiqueta: 'Alerta',
  },
  AVISO: {
    icono: Info,
    caja: 'border-zelanda-beige-200 bg-zelanda-beige-50',
    punto: 'text-zelanda-verde-700',
    etiqueta: 'Aviso',
  },
};

function FilaAlerta({ alerta }: { alerta: Alerta }) {
  const estilo = ESTILO[alerta.severidad];
  const Icono = estilo.icono;

  const cuerpo = (
    <>
      <div className="flex items-start gap-2.5">
        <Icono className={`mt-0.5 h-4 w-4 shrink-0 ${estilo.punto}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70">
              {estilo.etiqueta}
            </span>
          </div>
          <p className="mt-0.5 font-serif text-[15px] leading-snug text-zelanda-verde-900">
            {alerta.titulo}
          </p>
          <p className="mt-1 text-[13px] leading-snug text-zelanda-verde-800">{alerta.evidencia}</p>
          <p className="mt-1.5 text-[13px] font-medium leading-snug text-zelanda-verde-700">
            {alerta.accion}
          </p>
        </div>
        {alerta.href ? (
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-zelanda-verde-600" aria-hidden />
        ) : null}
      </div>
    </>
  );

  const clases = `block rounded-xl border p-3 ${estilo.caja}`;

  return alerta.href ? (
    <Link href={alerta.href} className={`${clases} transition hover:brightness-[0.98]`}>
      {cuerpo}
    </Link>
  ) : (
    <div className={clases}>{cuerpo}</div>
  );
}

export function PanelDiagnostico({ alertas }: { alertas: Alerta[] }) {
  const criticas = alertas.filter((a) => a.severidad === 'CRITICO').length;

  return (
    <section className="rounded-2xl border border-zelanda-beige-200 bg-white p-5 shadow-suave">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-serif text-base text-zelanda-verde-900">Diagnóstico</h2>
        {criticas > 0 ? (
          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
            {criticas} {criticas === 1 ? 'crítica' : 'críticas'}
          </span>
        ) : null}
      </div>

      {alertas.length === 0 ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-zelanda-verde-200 bg-zelanda-verde-50 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-zelanda-verde-700" aria-hidden />
          <div>
            <p className="font-serif text-[15px] text-zelanda-verde-900">Sin alertas</p>
            <p className="text-[13px] text-zelanda-verde-700">
              No hay nada que requiera acción hoy.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {alertas.map((alerta) => (
            <FilaAlerta key={alerta.id} alerta={alerta} />
          ))}
        </div>
      )}
    </section>
  );
}
