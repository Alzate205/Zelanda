'use client';

import type { ModoMapa } from './Mapa3D';

const MODOS: Array<{ id: ModoMapa; etiqueta: string }> = [
  { id: 'tareas', etiqueta: 'Tareas' },
  { id: 'cosecha', etiqueta: 'Cosecha' },
  { id: 'equipo', etiqueta: 'Equipo' },
  { id: 'historia', etiqueta: 'Historia' },
];

export function ChipsModos({
  modo,
  onCambio,
}: {
  modo: ModoMapa;
  onCambio: (m: ModoMapa) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {MODOS.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onCambio(m.id)}
          className={
            m.id === modo
              ? 'rounded-full bg-zelanda-verde-700 px-3.5 py-1.5 text-xs font-semibold text-zelanda-beige-50 shadow-card'
              : 'rounded-full border border-white/60 bg-zelanda-beige-50/85 px-3.5 py-1.5 text-xs font-medium text-zelanda-verde-800 shadow-suave backdrop-blur-md'
          }
        >
          {m.etiqueta}
        </button>
      ))}
    </div>
  );
}
