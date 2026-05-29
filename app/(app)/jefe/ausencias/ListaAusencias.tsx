'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, UserMinus, Search, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ConfirmarBorrado } from '@/components/ui/ConfirmarBorrado';
import { borrarAusencia } from './acciones';

const ETIQUETA_TIPO: Record<string, string> = {
  FALTA_INJUSTIFICADA: 'Falta injustificada',
  INCAPACIDAD: 'Incapacidad',
  VACACIONES: 'Vacaciones',
  LICENCIA: 'Licencia',
  PERMISO: 'Permiso',
};

const ESTADO_BADGE: Record<string, 'aldia' | 'proxima' | 'vencida' | 'neutro'> = {
  FALTA_INJUSTIFICADA: 'vencida',
  INCAPACIDAD: 'neutro',
  VACACIONES: 'aldia',
  LICENCIA: 'proxima',
  PERMISO: 'proxima',
};

function fmtFecha(d: Date): string {
  return d.toLocaleDateString('es-CO', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
}

type Ausencia = {
  id: bigint;
  fecha: Date;
  tipo: string;
  descontable: boolean;
  observaciones: string | null;
  persona: { nombre_completo: string };
};

interface Props {
  ausencias: Ausencia[];
  totalMes: number;
}

export function ListaAusencias({ ausencias, totalMes }: Props) {
  const [busqueda, setBusqueda] = useState('');

  const lista = busqueda
    ? ausencias.filter((a) =>
        a.persona.nombre_completo.toLowerCase().includes(busqueda.toLowerCase())
      )
    : ausencias;

  if (ausencias.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-10 text-center">
        <UserMinus className="mx-auto h-8 w-8 text-zelanda-verde-700/40" />
        <p className="mt-3 font-serif text-base text-zelanda-verde-900">
          Sin ausencias registradas
        </p>
        <p className="mt-1 text-sm text-zelanda-verde-700">
          Registrá días no trabajados para que el cálculo de saldos de los fijos descuente los días
          que correspondan.
        </p>
        <Link
          href="/jefe/ausencias/nueva"
          className="mt-4 inline-flex min-h-touch items-center gap-1.5 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
        >
          <Plus className="h-4 w-4" /> Registrar primera
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-zelanda-verde-700">
        {ausencias.length} registradas · {totalMes} este mes
      </p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zelanda-verde-700/50" />
        <input
          type="search"
          placeholder="Buscar por persona…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full rounded-xl border border-zelanda-beige-200 bg-white py-2 pl-9 pr-3 text-[14px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
        />
      </div>

      {busqueda && (
        <p className="text-[12px] text-zelanda-verde-700">
          {lista.length} resultado{lista.length !== 1 ? 's' : ''}
        </p>
      )}

      {busqueda && lista.length === 0 ? (
        <p className="text-center text-sm text-zelanda-verde-700 py-6">
          Sin resultados para &ldquo;{busqueda}&rdquo;
        </p>
      ) : (
        <ul className="space-y-2">
          {lista.map((a) => {
            const estado = ESTADO_BADGE[a.tipo] ?? 'neutro';
            return (
              <li
                key={String(a.id)}
                className="rounded-xl border border-zelanda-beige-200 bg-white p-3.5 shadow-suave"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="m-0 font-serif text-[15px] text-zelanda-verde-900">
                      {a.persona.nombre_completo}
                    </p>
                    <p className="m-0 mt-0.5 text-[12.5px] text-zelanda-verde-700">
                      {fmtFecha(a.fecha)}
                      {a.descontable ? ' · Descuenta' : ' · No descuenta'}
                    </p>
                  </div>
                  <Badge estado={estado}>{ETIQUETA_TIPO[a.tipo] ?? a.tipo}</Badge>
                </div>
                {a.observaciones ? (
                  <p className="m-0 mt-2 rounded-[8px] bg-zelanda-beige-100 px-2.5 py-1.5 text-[11.5px] text-zelanda-verde-800">
                    {a.observaciones}
                  </p>
                ) : null}
                <div className="mt-2 flex items-center justify-end gap-2">
                  <Link
                    href={`/jefe/ausencias/${a.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-zelanda-beige-200 bg-white px-2.5 py-1 text-xs text-zelanda-verde-700 transition hover:bg-zelanda-beige-50"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Link>
                  <ConfirmarBorrado
                    action={borrarAusencia}
                    id={a.id}
                    mensaje={`¿Anular la ausencia de ${a.persona.nombre_completo}? El registro quedará para trazabilidad.`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
