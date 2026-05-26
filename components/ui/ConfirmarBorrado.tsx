'use client';

import { useRef } from 'react';
import { Trash2 } from 'lucide-react';

/**
 * Botón de borrado con confirmación nativa.
 * Envuelve una Server Action en un <form> y muestra un confirm() antes de enviar.
 * Uso: <ConfirmarBorrado action={borrarPago} id={pago.id} mensaje="¿Anular este pago?" />
 */
export function ConfirmarBorrado({
  action,
  id,
  mensaje = '¿Confirmar anulación? El registro quedará como borrado para trazabilidad.',
  etiqueta = 'Anular',
  variante = 'peligro',
}: {
  action: (formData: FormData) => Promise<void>;
  id: bigint;
  mensaje?: string;
  etiqueta?: string;
  variante?: 'peligro' | 'silencioso';
}) {
  const formRef = useRef<HTMLFormElement>(null);

  const estilos =
    variante === 'peligro'
      ? 'inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100'
      : 'inline-flex items-center gap-1 rounded-lg border border-zelanda-beige-200 bg-white px-2.5 py-1 text-xs text-zelanda-verde-700 transition hover:bg-zelanda-beige-50';

  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name="id" value={String(id)} />
      <button
        type="button"
        className={estilos}
        onClick={() => {
          if (window.confirm(mensaje)) {
            formRef.current?.requestSubmit();
          }
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
        {etiqueta}
      </button>
    </form>
  );
}
