'use client';

import { useActionState, useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { borrarLote, type EstadoBorradoLote } from '../acciones';

const ESTADO_INICIAL: EstadoBorradoLote = { error: null };

/**
 * Borrar un lote es soft-delete, pero se lleva por delante sus árboles y
 * esconde su histórico de la app. Por eso está detrás de dos puertas: abrir el
 * bloque y escribir el nombre del lote.
 */
export function ZonaPeligro({ loteId, nombre }: { loteId: string; nombre: string }) {
  const [estado, accion, pendiente] = useActionState(borrarLote, ESTADO_INICIAL);
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex min-h-touch w-full items-center justify-center gap-2 rounded-xl border border-estado-vencida/30 bg-white px-4 text-sm font-semibold text-estado-vencida transition hover:bg-estado-vencida/5"
      >
        <Trash2 className="h-4 w-4" />
        Borrar este lote
      </button>
    );
  }

  return (
    <form
      action={accion}
      className="space-y-4 rounded-2xl border border-estado-vencida/30 bg-estado-vencida/5 p-5"
    >
      <input type="hidden" name="lote_id" value={loteId} />

      <h2 className="flex items-center gap-2 font-serif text-base text-estado-vencida">
        <AlertTriangle className="h-4 w-4" />
        Borrar {nombre}
      </h2>

      <p className="text-sm text-zelanda-verde-800">
        El lote y sus árboles dejan de aparecer en la app. El histórico de cosechas y tareas no se
        borra de la base, pero deja de estar accesible.
      </p>

      <div>
        <label
          htmlFor="confirmacion"
          className="block text-[12px] font-semibold text-zelanda-verde-800"
        >
          Escribe <strong>{nombre}</strong> para confirmar
        </label>
        <input
          id="confirmacion"
          name="confirmacion"
          type="text"
          autoComplete="off"
          className="mt-1.5 block min-h-touch w-full rounded-[10px] border border-zelanda-beige-300 bg-white px-3 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-estado-vencida"
        />
      </div>

      {estado.error ? (
        <p role="alert" className="text-sm text-estado-vencida">
          {estado.error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="flex min-h-touch flex-1 items-center justify-center rounded-xl border border-zelanda-beige-300 bg-white px-4 font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-100"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pendiente}
          className="flex min-h-touch flex-1 items-center justify-center rounded-xl bg-estado-vencida px-4 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? 'Borrando…' : 'Borrar lote'}
        </button>
      </div>
    </form>
  );
}
