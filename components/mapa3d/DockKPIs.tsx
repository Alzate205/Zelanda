'use client';

import type { SnapshotJefe } from '@/lib/offline/tipos';

/** El acceso al panel vive en el header; acá quedan sólo los números. */
export function DockKPIs({ contadores }: { contadores: SnapshotJefe['contadores'] }) {
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
    // Más baja y más angosta que antes: ocupaba tanto alto que tapaba los
    // controles de zoom del mapa, y el último número ("2.330 kg mes") no
    // entraba en su celda y salía cortado.
    <div className="mx-auto flex w-full max-w-md items-stretch gap-1 rounded-2xl border border-white/60 bg-zelanda-beige-50/85 px-2 py-1.5 shadow-card backdrop-blur-md">
      {celdas.map((c) => (
        <div key={c.etiqueta} className="min-w-0 flex-1 text-center">
          <p
            className={`m-0 truncate font-serif text-[15px] leading-tight tabular-nums ${c.color}`}
          >
            {c.valor}
          </p>
          <p className="m-0 truncate text-[8.5px] uppercase tracking-[0.1em] text-zelanda-verde-700">
            {c.etiqueta}
          </p>
        </div>
      ))}
    </div>
  );
}
