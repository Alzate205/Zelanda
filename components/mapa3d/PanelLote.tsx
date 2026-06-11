'use client';

import Link from 'next/link';
import { X, Trees, AlertTriangle, Scale } from 'lucide-react';
import type { SnapshotJefe, PrediccionLoteResumen } from '@/lib/offline/tipos';
import type { GeoFinca } from '@/lib/geo-finca';
import { COLOR_ESTADO_LOTE, type EstadoLote } from '@/lib/mapa3d';

const ETIQUETA_ESTADO: Record<EstadoLote, string> = {
  aldia: 'Al día',
  proxima: 'Tarea próxima',
  vencida: 'Tarea vencida',
};

export function PanelLote({
  lote,
  estado,
  kgMes,
  alertas,
  trabajando,
  prediccion,
  onCerrar,
}: {
  lote: GeoFinca['lotesParaMapa'][number];
  estado: EstadoLote;
  kgMes: number;
  alertas: SnapshotJefe['vencidas'];
  trabajando: string[];
  prediccion?: PrediccionLoteResumen | null;
  onCerrar: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/60 bg-zelanda-beige-50/95 p-4 shadow-card backdrop-blur-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: COLOR_ESTADO_LOTE[estado] }}
              aria-hidden
            />
            <h2 className="m-0 truncate font-serif text-xl text-zelanda-verde-900">
              {lote.nombre}
            </h2>
          </div>
          <p className="m-0 mt-0.5 text-xs text-zelanda-verde-700">
            {ETIQUETA_ESTADO[estado]}
            {lote.hectareas != null ? ` · ${lote.hectareas.toFixed(1)} ha` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar panel"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zelanda-verde-700 hover:bg-zelanda-beige-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-zelanda-verde-800">
        <span className="flex items-center gap-1">
          <Trees className="h-3.5 w-3.5" aria-hidden />
          {lote.total_arboles.toLocaleString('es-CO')} árboles
        </span>
        <span className="flex items-center gap-1">
          <Scale className="h-3.5 w-3.5" aria-hidden />
          {Math.round(kgMes).toLocaleString('es-CO')} kg este mes
        </span>
      </div>

      {prediccion ? (
        <p className="m-0 mt-1.5 text-[12px] text-zelanda-verde-700">
          Próximo ciclo estimado: {prediccion.kg_min.toLocaleString('es-CO')}–
          {prediccion.kg_max.toLocaleString('es-CO')} kg
          <span className="text-zelanda-verde-700/70"> · confianza {prediccion.confianza}</span>
        </p>
      ) : null}

      {alertas.length > 0 ? (
        <ul className="mt-2.5 list-none space-y-1 p-0">
          {alertas.slice(0, 3).map((a) => (
            <li
              key={a.tipo_id}
              className="flex items-center gap-1.5 text-[12.5px] text-zelanda-verde-800"
            >
              <AlertTriangle
                className="h-3.5 w-3.5 shrink-0"
                style={{
                  color:
                    a.estado === 'proxima' ? COLOR_ESTADO_LOTE.proxima : COLOR_ESTADO_LOTE.vencida,
                }}
                aria-hidden
              />
              <span className="truncate">
                {a.tipo_nombre}
                {a.estado === 'vencida' && a.dias_para_proxima != null
                  ? ` · vencida hace ${Math.abs(a.dias_para_proxima)} d`
                  : a.estado === 'proxima' && a.dias_para_proxima != null
                  ? ` · en ${a.dias_para_proxima} d`
                  : ' · sin historial'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {trabajando.length > 0 ? (
        <p className="m-0 mt-2 text-[12px] text-zelanda-verde-700">Hoy: {trabajando.join(', ')}</p>
      ) : null}

      <div className="mt-3.5 flex gap-2">
        <Link
          href={`/jefe/asignaciones/nueva?lote_id=${lote.id}`}
          className="flex min-h-touch flex-1 items-center justify-center rounded-xl bg-zelanda-verde-700 px-3 text-[13.5px] font-semibold text-zelanda-beige-50"
        >
          Asignar tarea
        </Link>
        <Link
          href={`/jefe/lotes/${lote.id}`}
          className="flex min-h-touch flex-1 items-center justify-center rounded-xl border border-zelanda-verde-300 bg-white/70 px-3 text-[13.5px] font-semibold text-zelanda-verde-800"
        >
          Ver lote
        </Link>
      </div>
    </div>
  );
}
