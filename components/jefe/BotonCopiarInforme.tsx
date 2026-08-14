'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

/**
 * Copia el informe al portapapeles. Si el navegador lo bloquea (pasa en
 * contextos no seguros), el texto sigue visible y seleccionable abajo, así que
 * el fallo no deja al dueño sin salida: solo se lo decimos.
 */
export function BotonCopiarInforme({ texto }: { texto: string }) {
  const [estado, setEstado] = useState<'listo' | 'copiado' | 'error'>('listo');

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setEstado('copiado');
      setTimeout(() => setEstado('listo'), 2500);
    } catch {
      setEstado('error');
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={copiar}
        className="flex min-h-touch w-full items-center justify-center gap-2 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
      >
        {estado === 'copiado' ? (
          <>
            <Check className="h-[18px] w-[18px]" />
            Copiado
          </>
        ) : (
          <>
            <Copy className="h-[18px] w-[18px]" />
            Copiar informe
          </>
        )}
      </button>
      {estado === 'error' ? (
        <p role="alert" className="text-xs text-estado-vencida">
          El navegador no dejó copiar. Selecciona el texto de abajo y cópialo a mano.
        </p>
      ) : null}
    </div>
  );
}
