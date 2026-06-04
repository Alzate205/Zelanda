'use client';

import { Printer } from 'lucide-react';

export function BotonImprimir({ etiqueta = 'Imprimir / Guardar PDF' }: { etiqueta?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex min-h-touch items-center gap-2 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900)]"
    >
      <Printer className="h-4 w-4" /> {etiqueta}
    </button>
  );
}
