'use client';

import { LayoutGrid } from 'lucide-react';
import type { SnapshotJefe } from '@/lib/offline/tipos';

export function DockKPIs({
  contadores,
  onAbrirPanel,
}: {
  contadores: SnapshotJefe['contadores'];
  onAbrirPanel: () => void;
}) {
  const celdas = [
    { valor: String(contadores.lotes_aldia), etiqueta: 'Al día', color: 'text-zelanda-verde-700' },
    {
      valor: String(contadores.lotes_proxima),
      etiqueta: 'Próximas',
      color: 'text-zelanda-ocre-600',
    },
    {
      valor: String(contadores.lotes_vencida),
      etiqueta: 'Vencidas',
      color: 'text-estado-vencida',
    },
    {
      valor: Math.round(contadores.cosecha_mes_kg).toLocaleString('es-CO'),
      etiqueta: 'kg mes',
      color: 'text-zelanda-verde-900',
    },
  ];
  return (
    <div className="flex items-stretch gap-2 rounded-2xl border border-white/60 bg-zelanda-beige-50/85 p-2.5 shadow-card backdrop-blur-md">
      {celdas.map((c) => (
        <div key={c.etiqueta} className="min-w-0 flex-1 text-center">
          <p className={`m-0 font-serif text-lg leading-tight ${c.color}`}>{c.valor}</p>
          <p className="m-0 text-[9.5px] uppercase tracking-[0.14em] text-zelanda-verde-700">
            {c.etiqueta}
          </p>
        </div>
      ))}
      <button
        type="button"
        onClick={onAbrirPanel}
        aria-label="Abrir panel del jefe"
        className="flex w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl bg-zelanda-verde-700 text-zelanda-beige-50"
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="text-[9px] font-semibold uppercase tracking-wide">Panel</span>
      </button>
    </div>
  );
}
