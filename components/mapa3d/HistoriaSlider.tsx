'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

const NOMBRES_MES = [
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

export function etiquetaMes(mes: string): string {
  const [anio, m] = mes.split('-').map(Number);
  return `${NOMBRES_MES[m - 1]} ${anio}`;
}

export function HistoriaSlider({
  meses,
  indice,
  onCambio,
  totalKg,
  tareas,
  novedades,
  cargando,
}: {
  meses: string[];
  indice: number;
  onCambio: (i: number) => void;
  totalKg: number;
  tareas: number;
  novedades: number;
  cargando: boolean;
}) {
  const mes = meses[indice];
  return (
    <div className="rounded-2xl border border-white/60 bg-zelanda-beige-50/95 p-4 shadow-card backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
          Máquina del tiempo
        </p>
        <p className="m-0 font-serif text-base text-zelanda-verde-900">{etiquetaMes(mes)}</p>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onCambio(Math.max(0, indice - 1))}
          disabled={indice === 0}
          aria-label="Mes anterior"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zelanda-verde-300 bg-white/70 text-zelanda-verde-800 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <input
          type="range"
          min={0}
          max={meses.length - 1}
          value={indice}
          onChange={(e) => onCambio(Number(e.target.value))}
          aria-label="Elegir mes"
          className="h-2 w-full cursor-pointer accent-zelanda-verde-700"
        />
        <button
          type="button"
          onClick={() => onCambio(Math.min(meses.length - 1, indice + 1))}
          disabled={indice === meses.length - 1}
          aria-label="Mes siguiente"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zelanda-verde-300 bg-white/70 text-zelanda-verde-800 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <p className="m-0 mt-2 text-center text-[12.5px] text-zelanda-verde-800">
        {cargando
          ? 'Cargando…'
          : `${Math.round(totalKg).toLocaleString(
              'es-CO'
            )} kg cosechados · ${tareas} tareas · ${novedades} novedades`}
      </p>
    </div>
  );
}
