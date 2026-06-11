'use client';

import { Pause, Play, X } from 'lucide-react';
import { COLOR_ESTADO_LOTE, type EstadoLote } from '@/lib/mapa3d';
import type { LoteMapa3D } from './Mapa3D';

const ETIQUETA_ESTADO: Record<EstadoLote, string> = {
  aldia: 'Al día',
  proxima: 'Tarea próxima',
  vencida: 'Tarea vencida',
};

export function VueloDron({
  lote,
  numero,
  total,
  pausado,
  onPausar,
  onSalir,
}: {
  lote: LoteMapa3D;
  numero: number;
  total: number;
  pausado: boolean;
  onPausar: () => void;
  onSalir: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/60 bg-zelanda-beige-50/95 p-4 shadow-card backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Vuelo de dron · {numero}/{total}
        </p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onPausar}
            aria-label={pausado ? 'Reanudar vuelo' : 'Pausar vuelo'}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-zelanda-verde-700 text-zelanda-beige-50"
          >
            {pausado ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onSalir}
            aria-label="Salir del vuelo"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zelanda-verde-300 bg-white/70 text-zelanda-verde-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <h2 className="m-0 mt-1 font-serif text-xl text-zelanda-verde-900">{lote.nombre}</h2>
      <p className="m-0 mt-0.5 flex items-center gap-1.5 text-[12.5px] text-zelanda-verde-800">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: COLOR_ESTADO_LOTE[lote.estado] }}
          aria-hidden
        />
        {ETIQUETA_ESTADO[lote.estado]}
        {' · '}
        {Math.round(lote.kgMes).toLocaleString('es-CO')} kg este mes
        {lote.trabajandoHoy > 0 ? ` · ${lote.trabajandoHoy} trabajando hoy` : ''}
      </p>

      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-zelanda-beige-200">
        <div
          className="h-full rounded-full bg-zelanda-verde-600 transition-all duration-700"
          style={{ width: `${Math.round((numero / total) * 100)}%` }}
        />
      </div>
    </div>
  );
}
