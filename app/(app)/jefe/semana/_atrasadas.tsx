'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, TriangleAlert } from 'lucide-react';
import type { TareaAtrasada } from '@/lib/jefe/semana';

/**
 * Lo que quedó atrás, plegado y arriba de la semana.
 *
 * Va aparte de los días a propósito: lo vencido no tiene "día de esta semana"
 * —ya pasó— y metido entre los días tapaba lo que viene, que es lo que sirve
 * para planificar. Arranca plegado porque son decenas.
 */
export function Atrasadas({
  atrasadas,
  sinEmpezar,
}: {
  atrasadas: TareaAtrasada[];
  sinEmpezar: number;
}) {
  const [abierto, setAbierto] = useState(false);

  if (atrasadas.length === 0 && sinEmpezar === 0) return null;

  const partes: string[] = [];
  if (atrasadas.length > 0) {
    partes.push(`${atrasadas.length} vencida${atrasadas.length === 1 ? '' : 's'}`);
  }
  if (sinEmpezar > 0) partes.push(`${sinEmpezar} sin empezar`);

  return (
    <section className="rounded-2xl border border-estado-vencida/30 bg-estado-vencida/5">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        disabled={atrasadas.length === 0}
        className="flex min-h-touch w-full items-center justify-between gap-2 px-3 py-2.5 text-left disabled:cursor-default"
      >
        <span className="flex items-center gap-2">
          <TriangleAlert className="h-4 w-4 shrink-0 text-estado-vencida" aria-hidden />
          <span className="text-[13px] font-medium text-estado-vencida">
            Atrasado · {partes.join(' · ')}
          </span>
        </span>
        {atrasadas.length > 0 ? (
          abierto ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-estado-vencida" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-estado-vencida" aria-hidden />
          )
        ) : null}
      </button>

      {abierto && atrasadas.length > 0 ? (
        <ul className="space-y-1.5 px-3 pb-3">
          {atrasadas.map((t) => (
            <li key={t.clave}>
              <Link
                href={`/jefe/asignaciones/nueva?lote_id=${t.lote_id}&tipo_tarea_id=${t.tipo_tarea_id}`}
                className="flex min-h-touch items-center justify-between gap-2 rounded-xl bg-white px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14px] text-zelanda-verde-900">
                    {t.tipo_nombre} · {t.lote_nombre}
                  </span>
                  <span className="block text-[11.5px] text-estado-vencida">
                    {t.dias_vencida === null
                      ? 'vencida'
                      : `hace ${Math.abs(t.dias_vencida)} día${
                          Math.abs(t.dias_vencida) === 1 ? '' : 's'
                        }`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {sinEmpezar > 0 ? (
        <p className="m-0 px-3 pb-3 text-[11.5px] text-zelanda-verde-700/70">
          Las &quot;sin empezar&quot; son tareas que ese lote nunca tuvo. Se ven en Alertas.
        </p>
      ) : null}
    </section>
  );
}
